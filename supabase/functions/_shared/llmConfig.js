export const LLM_CONFIG = Object.freeze({
  providers: Object.freeze({
    groq: Object.freeze({ baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', apiKeyEnv: 'GROQ_API_KEY' }),
    cerebras: Object.freeze({ baseUrl: 'https://api.cerebras.ai/v1', model: 'qwen-3.8-27b', apiKeyEnv: 'CEREBRAS_API_KEY' }),
  }),
  priority: Object.freeze(['groq', 'cerebras']),
  timeoutMs: 15_000,
  fallbackCooldownMs: 30_000,
  requestsPerMinute: 12,
});

export function getProviderPriority(value, fallback = LLM_CONFIG.priority) {
  if (!value) return [...fallback];
  const valid = value.split(',').map((provider) => provider.trim().toLowerCase())
    .filter((provider) => Object.hasOwn(LLM_CONFIG.providers, provider));
  return valid.length ? [...new Set(valid)] : [...fallback];
}
