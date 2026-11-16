import { describe, expect, it, vi } from 'vitest';
import { createLlmGateway } from '../../../../supabase/functions/_shared/llmGateway.js';
import { LLM_CONFIG } from '../../../../supabase/functions/_shared/llmConfig.js';

const messages = [{ role: 'user', content: 'test prompt' }];
const success = (content = 'answer') => new Response(JSON.stringify({
  choices: [{ message: { role: 'assistant', content } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('server LLM gateway environment credentials', () => {
  it('uses VITE_PUBLIC_* env vars as default provider credentials', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('bad key', { status: 401 }))
      .mockResolvedValueOnce(success('from Cerebras via public key'));
    const gateway = createLlmGateway({
      getEnv: (key) => ({
        VITE_PUBLIC_GROQ_KEYS: 'public-groq-key',
        VITE_PUBLIC_CEREBRAS_KEYS: 'public-cerebras-key',
      })[key],
      config: LLM_CONFIG,
      fetchImpl,
      consumeRateLimit: async () => true,
    });

    const result = await gateway.llmChat({ messages, userId: 'user-1' });
    expect(result).toMatchObject({ provider: 'cerebras', text: 'from Cerebras via public key' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer public-groq-key');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer public-cerebras-key');
  });

  it('prefers dedicated server secrets over VITE_PUBLIC_* fallbacks', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(success('ok'));
    const gateway = createLlmGateway({
      getEnv: (key) => ({
        GROQ_API_KEY: 'server-groq-key',
        VITE_PUBLIC_GROQ_KEYS: 'public-groq-key',
      })[key],
      config: LLM_CONFIG,
      fetchImpl,
      consumeRateLimit: async () => true,
    });

    await gateway.llmChat({ messages, userId: 'user-1' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer server-groq-key');
  });

  it('tries every comma-separated key before falling back to the next provider', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('r1', { status: 429 }))
      .mockResolvedValueOnce(new Response('r2', { status: 500 }))
      .mockResolvedValueOnce(success('third key works'));
    const gateway = createLlmGateway({
      getEnv: (key) => ({
        GROQ_API_KEY: 'groq-key-1, groq-key-2, groq-key-3',
        CEREBRAS_API_KEY: 'cerebras-key',
      })[key],
      config: LLM_CONFIG,
      fetchImpl,
      consumeRateLimit: async () => true,
    });

    const result = await gateway.llmChat({ messages, userId: 'user-1' });
    expect(result).toMatchObject({ provider: 'groq', text: 'third key works' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('accepts request-level provider key overrides and order from trusted callers', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(success('fallback worked'));
    const gateway = createLlmGateway({
      getEnv: () => undefined,
      config: LLM_CONFIG,
      fetchImpl,
      consumeRateLimit: async () => true,
    });

    const result = await gateway.llmChat({
      messages,
      userId: 'user-1',
      providerKeys: { groq: 'client-groq-key', cerebras: 'client-cerebras-key' },
      providerOrder: 'groq,cerebras',
    });
    expect(result).toMatchObject({ provider: 'cerebras', text: 'fallback worked' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer client-groq-key');
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBe('Bearer client-cerebras-key');
  });
});
