import { getProviderPriority, LLM_CONFIG } from './llmConfig.js';

const FRIENDLY_UNAVAILABLE = 'AI is temporarily unavailable. Please try again in a moment.';
const FRIENDLY_INTERRUPTED = 'The response was interrupted. Please retry.';
const FRIENDLY_BAD_REQUEST = 'The AI request could not be processed. Check the message format and context length.';

export class LlmGatewayError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.name = 'LlmGatewayError';
    this.status = status;
  }
}

class RetryableProviderError extends Error {
  constructor(kind, retryAfterMs = null) { super(kind); this.kind = kind; this.retryAfterMs = retryAfterMs; }
}
class ProviderHttpError extends Error {
  constructor(status, retryAfterMs = null) { super(`HTTP ${status}`); this.status = status; this.retryAfterMs = retryAfterMs; }
}
class ProviderTimeoutError extends Error {}

function retryAfterMilliseconds(value, fallbackMs, now) {
  if (!value) return fallbackMs;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : fallbackMs;
}

function toResponseFormat(jsonSchema) {
  if (!jsonSchema) return undefined;
  const normalized = jsonSchema.schema ? jsonSchema : { name: 'response', strict: true, schema: jsonSchema };
  return { type: 'json_schema', json_schema: normalized };
}

const encodeSse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function* readTextDeltas(body) {
  if (!body) throw new RetryableProviderError('empty_stream');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];
  let ended = false;
  const parseEvent = (lines) => {
    const data = lines.join('\n').trim();
    if (!data || data === '[DONE]') return { done: true };
    let payload;
    try { payload = JSON.parse(data); } catch { throw new RetryableProviderError('invalid_stream'); }
    if (payload.error) throw new RetryableProviderError('stream_error');
    const text = payload.choices?.[0]?.delta?.content;
    return typeof text === 'string' && text.length ? { text } : null;
  };
  try {
    while (!ended) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line === '') {
          const event = parseEvent(dataLines);
          dataLines = [];
          if (event?.done) { ended = true; break; }
          if (event?.text) yield event.text;
        } else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (done && !ended) {
        if (buffer.startsWith('data:')) dataLines.push(buffer.slice(5).trimStart());
        const event = parseEvent(dataLines);
        if (event?.text) yield event.text;
        ended = true;
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* Already released. */ }
  }
}

function makeAbortScope(signal) {
  const controller = new AbortController();
  let callerAborted = false;
  const onCallerAbort = () => { callerAborted = true; controller.abort(signal?.reason); };
  if (signal?.aborted) onCallerAbort();
  else signal?.addEventListener('abort', onCallerAbort, { once: true });
  return {
    signal: controller.signal,
    get callerAborted() { return callerAborted; },
    abort: (reason) => controller.abort(reason),
    cleanup: () => signal?.removeEventListener('abort', onCallerAbort),
  };
}

function withTimeout(promise, timeoutMs, scope) {
  let timer;
  let abortListener;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { scope.abort(); reject(new ProviderTimeoutError('Provider request timed out')); }, timeoutMs);
  });
  const aborted = new Promise((_, reject) => {
    abortListener = () => reject(scope.callerAborted ? new LlmGatewayError('Request cancelled.', 499) : new ProviderTimeoutError('Provider request timed out'));
    if (scope.signal.aborted) abortListener();
    else scope.signal.addEventListener('abort', abortListener, { once: true });
  });
  return Promise.race([promise, timeout, aborted]).finally(() => {
    clearTimeout(timer);
    scope.signal.removeEventListener('abort', abortListener);
  });
}

function validateRequest({ messages, userId }) {
  if (!userId) throw new LlmGatewayError('A signed-in account is required to use AI features.', 401);
  if (!Array.isArray(messages) || !messages.length || messages.length > 100) throw new LlmGatewayError(FRIENDLY_BAD_REQUEST, 400);
  const roles = new Set(['system', 'developer', 'user', 'assistant', 'tool']);
  const charCount = messages.reduce((total, message) => {
    if (!message || !roles.has(message.role) || typeof message.content !== 'string') throw new LlmGatewayError(FRIENDLY_BAD_REQUEST, 400);
    return total + message.content.length;
  }, 0);
  if (charCount > 100_000) throw new LlmGatewayError(FRIENDLY_BAD_REQUEST, 400);
}

function logOutcome(logger, provider, model, startedAt, outcome, now) {
  logger?.info?.('[llm-gateway]', { provider, model, latencyMs: Math.max(0, now() - startedAt), outcome });
}

export function createLlmGateway({
  getEnv = () => undefined,
  config = LLM_CONFIG,
  fetchImpl = globalThis.fetch,
  consumeRateLimit = async () => true,
  resolveUserProviderKey = async () => null,
  markUserProviderKeyInvalid = async () => {},
  markUserProviderKeyUsed = async () => {},
  logger = console,
  now = Date.now,
} = {}) {
  const invalidKeys = new Set();
  const cooldowns = new Map();

  function platformKeysForProvider(providerConfig, overrideValue = null) {
    // Each configured env var may hold one key or a comma-separated list; every value
    // becomes its own candidate so a bad key falls through to the next one/provider.
    // A request-level override (e.g. client defaults from VITE_PUBLIC_* keys) is tried
    // first, but server-side secrets still get their own candidates afterwards.
    const envNames = providerConfig.apiKeyEnvs || (providerConfig.apiKeyEnv ? [providerConfig.apiKeyEnv] : []);
    const sources = [];
    if (typeof overrideValue === 'string' && overrideValue.trim()) sources.push(overrideValue);
    for (const envName of envNames) {
      const raw = getEnv(envName);
      if (raw) sources.push(raw);
    }
    const keys = [];
    for (const source of sources) {
      for (const key of String(source).split(',')) {
        const trimmed = key.trim();
        if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
      }
    }
    return keys;
  }

  async function providerCandidates(userId, priority, useOnlyMyKeys, requestOverrides = {}) {
    const candidates = [];
    for (const provider of priority) {
      const providerConfig = config.providers[provider];
      if (!providerConfig) continue;
      const userKey = await resolveUserProviderKey(userId, provider);
      if (userKey) candidates.push({ provider, key: userKey, source: 'user' });
      if (!useOnlyMyKeys) {
        for (const key of platformKeysForProvider(providerConfig, requestOverrides[provider])) {
          candidates.push({ provider, key, source: 'platform' });
        }
      }
    }
    return candidates;
  }

  async function requestProvider(candidate, options) {
    const { messages, stream, jsonSchema, tools, signal, userId } = options;
    const providerConfig = config.providers[candidate.provider];
    const model = providerConfig.model;
    const cooldownKey = `${candidate.provider}:${candidate.key}`;
    const startedAt = now();
    const scope = makeAbortScope(signal);
    const payload = { model, messages, stream: Boolean(stream) };
    const responseFormat = toResponseFormat(jsonSchema);
    if (responseFormat) payload.response_format = responseFormat;
    if (tools?.length) payload.tools = tools;

    try {
      const response = await withTimeout(fetchImpl(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${candidate.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: scope.signal,
      }), config.timeoutMs, scope);
      if (response.status === 401 || response.status === 403) {
        invalidKeys.add(candidate.key);
        logOutcome(logger, candidate.provider, model, startedAt, 'invalid_key', now);
        throw new ProviderHttpError(response.status);
      }
      if (response.status === 429) {
        const cooldown = retryAfterMilliseconds(response.headers.get('Retry-After'), config.fallbackCooldownMs, now);
        cooldowns.set(cooldownKey, now() + cooldown);
        logOutcome(logger, candidate.provider, model, startedAt, 'rate_limited', now);
        throw new ProviderHttpError(429, cooldown);
      }
      if (response.status === 408) {
        logOutcome(logger, candidate.provider, model, startedAt, 'timeout', now);
        throw new RetryableProviderError('timeout');
      }
      if (response.status >= 400 && response.status < 500) {
        logOutcome(logger, candidate.provider, model, startedAt, 'request_rejected', now);
        throw new LlmGatewayError(FRIENDLY_BAD_REQUEST, 400);
      }
      if (response.status >= 500) throw new ProviderHttpError(response.status);

      if (!stream) {
        const data = await withTimeout(response.json(), config.timeoutMs, scope);
        const message = data.choices?.[0]?.message;
        const text = typeof message?.content === 'string' ? message.content : '';
        const toolCalls = (message?.tool_calls || []).map((call) => {
          let args = {};
          try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* Keep invalid arguments empty. */ }
          return { name: call.function?.name, args };
        });
        if (!text && !toolCalls.length) throw new RetryableProviderError('invalid_response');
        if (candidate.source === 'user') await markUserProviderKeyUsed(userId, candidate.provider).catch(() => {});
        logOutcome(logger, candidate.provider, model, startedAt, 'success', now);
        scope.cleanup();
        return { provider: candidate.provider, model, text, toolCalls };
      }

      const iterator = readTextDeltas(response.body)[Symbol.asyncIterator]();
      let first;
      try { first = await withTimeout(iterator.next(), config.timeoutMs, scope); }
      catch (error) {
        if (error instanceof LlmGatewayError) throw error;
        throw new RetryableProviderError(error instanceof ProviderTimeoutError ? 'timeout' : 'stream_before_first_token');
      }
      if (first.done || !first.value) throw new RetryableProviderError('empty_stream');
      if (candidate.source === 'user') await markUserProviderKeyUsed(userId, candidate.provider).catch(() => {});

      let finished = false;
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        start(controller) { controller.enqueue(encoder.encode(encodeSse('token', { text: first.value }))); },
        async pull(controller) {
          if (finished) return;
          try {
            const next = await withTimeout(iterator.next(), config.timeoutMs, scope);
            if (next.done) {
              finished = true;
              controller.enqueue(encoder.encode(encodeSse('done', {})));
              controller.close();
              logOutcome(logger, candidate.provider, model, startedAt, 'success', now);
              scope.cleanup();
            } else controller.enqueue(encoder.encode(encodeSse('token', { text: next.value })));
          } catch {
            finished = true;
            if (scope.callerAborted) controller.close();
            else {
              controller.enqueue(encoder.encode(encodeSse('error', { error: FRIENDLY_INTERRUPTED })));
              controller.close();
              logOutcome(logger, candidate.provider, model, startedAt, 'stream_error', now);
            }
            scope.cleanup();
          }
        },
        async cancel() {
          finished = true; scope.abort(); scope.cleanup();
          try { await iterator.return?.(); } catch { /* Stream was already closed. */ }
        },
      });
      return { provider: candidate.provider, model, stream: readable };
    } catch (error) {
      scope.cleanup();
      if (error instanceof ProviderHttpError && error.status >= 500) {
        logOutcome(logger, candidate.provider, model, startedAt, 'server_error', now);
        throw new RetryableProviderError('server_error');
      }
      if (error instanceof ProviderHttpError && error.status === 429) throw new RetryableProviderError('rate_limited', error.retryAfterMs);
      if (error instanceof ProviderHttpError && [401, 403].includes(error.status)) throw new RetryableProviderError('invalid_key');
      if (error instanceof LlmGatewayError) throw error;
      if (scope.callerAborted) throw new LlmGatewayError('Request cancelled.', 499);
      if (error instanceof ProviderTimeoutError) {
        logOutcome(logger, candidate.provider, model, startedAt, 'timeout', now);
        throw new RetryableProviderError('timeout');
      }
      if (error instanceof RetryableProviderError) {
        if (!['rate_limited', 'timeout'].includes(error.kind)) logOutcome(logger, candidate.provider, model, startedAt, error.kind, now);
        throw error;
      }
      logOutcome(logger, candidate.provider, model, startedAt, 'network_error', now);
      throw new RetryableProviderError('network_error');
    }
  }

  async function llmChat({ messages, stream = false, jsonSchema, userId, signal, tools, useOnlyMyKeys = false, providerKeys = null, providerOrder = null } = {}) {
    validateRequest({ messages, userId });
    if (!await consumeRateLimit(userId, config.requestsPerMinute)) {
      throw new LlmGatewayError('You have reached the AI request limit. Please try again in a minute.', 429);
    }
    const priority = getProviderPriority(providerOrder || getEnv('LLM_PROVIDER_ORDER'), config.priority);
    const overrides = providerKeys && typeof providerKeys === 'object' ? providerKeys : {};
    const candidates = await providerCandidates(userId, priority, useOnlyMyKeys, overrides);
    if (!candidates.length && useOnlyMyKeys) {
      throw new LlmGatewayError('Add and verify a Groq or Cerebras key in Settings, or turn off “Use only my keys.”', 400);
    }
    let lastError = null;
    for (const candidate of candidates) {
      if (invalidKeys.has(candidate.key)) continue;
      if ((cooldowns.get(`${candidate.provider}:${candidate.key}`) || 0) > now()) continue;
      try { return await requestProvider(candidate, { messages, stream, jsonSchema, tools, signal, userId }); }
      catch (error) {
        if (error instanceof LlmGatewayError) throw error;
        if (candidate.source === 'user' && error instanceof RetryableProviderError && error.kind === 'invalid_key') {
          await markUserProviderKeyInvalid(userId, candidate.provider).catch(() => {});
        }
        lastError = error;
      }
    }
    if (useOnlyMyKeys) throw new LlmGatewayError('Your saved API keys could not complete this request. Check their status in Settings or turn off “Use only my keys.”', 503);
    if (!candidates.length) logger?.info?.('[llm-gateway]', { provider: 'none', model: 'none', latencyMs: 0, outcome: 'unconfigured' });
    else if (!lastError) logger?.info?.('[llm-gateway]', { provider: 'none', model: 'none', latencyMs: 0, outcome: 'providers_unavailable' });
    throw new LlmGatewayError(FRIENDLY_UNAVAILABLE, 503);
  }
  return { llmChat };
}
