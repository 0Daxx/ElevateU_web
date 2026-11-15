import { describe, expect, it, vi } from 'vitest';
import { createLlmGateway, LlmGatewayError } from '../../../../supabase/functions/_shared/llmGateway.js';
import { LLM_CONFIG } from '../../../../supabase/functions/_shared/llmConfig.js';

const messages = [{ role: 'user', content: 'private test prompt' }];
const success = (content = 'answer') => new Response(JSON.stringify({
  choices: [{ message: { role: 'assistant', content } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

function makeGateway(fetchImpl, options = {}) {
  const logger = { info: vi.fn() };
  const gateway = createLlmGateway({
    getEnv: (key) => ({ GROQ_API_KEY: 'groq-test-key', CEREBRAS_API_KEY: 'cerebras-test-key' })[key],
    config: { ...LLM_CONFIG, timeoutMs: options.timeoutMs ?? 100 },
    fetchImpl,
    consumeRateLimit: options.consumeRateLimit || vi.fn(async () => true),
    logger,
  });
  return { ...gateway, logger };
}

describe('server LLM gateway failover', () => {
  it('backs off Groq on 429 and returns the Cerebras response', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: { 'Retry-After': '60' } }))
      .mockResolvedValueOnce(success('from Cerebras'))
      .mockResolvedValueOnce(success('still on Cerebras'));
    const gateway = makeGateway(fetchImpl);

    const first = await gateway.llmChat({ messages, userId: 'user-1' });
    const second = await gateway.llmChat({ messages, userId: 'user-1' });

    expect(first).toMatchObject({ provider: 'cerebras', text: 'from Cerebras' });
    expect(second.provider).toBe('cerebras');
    expect(fetchImpl.mock.calls.filter(([url]) => url.startsWith(LLM_CONFIG.providers.groq.baseUrl))).toHaveLength(1);
  });

  it('returns a friendly error when both providers are down', async () => {
    const gateway = makeGateway(vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
    await expect(gateway.llmChat({ messages, userId: 'user-1' })).rejects.toMatchObject({
      status: 503,
      message: 'AI is temporarily unavailable. Please try again in a moment.',
    });
  });

  it('times out the first provider and falls back to the next provider', async () => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(success('after timeout'));
    const gateway = makeGateway(fetchImpl, { timeoutMs: 10 });
    const result = await gateway.llmChat({ messages, userId: 'user-1' });
    expect(result).toMatchObject({ provider: 'cerebras', text: 'after timeout' });
  });

  it('sends a clean error event after a stream fails mid-response without switching providers', async () => {
    const encoder = new TextEncoder();
    let firstChunkSent = false;
    const failedBody = new ReadableStream({
      pull(controller) {
        if (!firstChunkSent) {
          firstChunkSent = true;
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"first token"}}]}\n\n'));
        } else controller.error(new Error('network broke mid-stream'));
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(failedBody, { status: 200 }));
    const gateway = makeGateway(fetchImpl);
    const result = await gateway.llmChat({ messages, userId: 'user-1', stream: true });
    const reader = result.stream.getReader();
    const decoder = new TextDecoder();
    let output = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
    }

    expect(result.provider).toBe('groq');
    expect(output).toContain('first token');
    expect(output).toContain('event: error');
    expect(output).toContain('The response was interrupted. Please retry.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry a rejected 400-class request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
    const gateway = makeGateway(fetchImpl);
    await expect(gateway.llmChat({ messages, userId: 'user-1' })).rejects.toBeInstanceOf(LlmGatewayError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
