import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLlmGateway, LlmGatewayError } from '../_shared/llmGateway.js';
import { LLM_CONFIG } from '../_shared/llmConfig.js';
import { decryptApiKey } from '../_shared/apiKeyCrypto.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const gateway = createLlmGateway({
  getEnv: (key) => Deno.env.get(key),
  config: LLM_CONFIG,
  consumeRateLimit: async (userId, limit) => {
    if (!admin) throw new LlmGatewayError('AI service is not configured. Please try again later.', 503);
    const { data, error } = await admin.rpc('consume_llm_user_rate_limit', {
      p_user_id: userId,
      p_limit: limit,
    });
    if (error) throw new LlmGatewayError('AI request limits are temporarily unavailable.', 503);
    return data === true;
  },
  resolveUserProviderKey: async (userId, provider) => {
    if (!admin) throw new LlmGatewayError('AI service is not configured. Please try again later.', 503);
    const { data, error } = await admin.from('user_api_keys').select('encrypted_key,iv,auth_tag')
      .eq('user_id', userId).eq('provider', provider).eq('status', 'active').maybeSingle();
    if (error) throw new LlmGatewayError('Saved API keys are temporarily unavailable.', 503);
    if (!data) return null;
    try { return await decryptApiKey(data, Deno.env.get('KEY_ENCRYPTION_SECRET') || '', `${userId}:${provider}`); }
    catch { throw new LlmGatewayError('Secure API key storage is not configured. Please contact support.', 503); }
  },
  markUserProviderKeyInvalid: async (userId, provider) => {
    await admin?.from('user_api_keys').update({ status: 'invalid' }).eq('user_id', userId).eq('provider', provider);
  },
  markUserProviderKeyUsed: async (userId, provider) => {
    await admin?.from('user_api_keys').update({ last_used_at: new Date().toISOString() }).eq('user_id', userId).eq('provider', provider);
  },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!supabaseUrl || !anonKey || !admin) return json({ error: 'AI service is not configured. Please try again later.' }, 503);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Please sign in to use AI features.' }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Your session is no longer valid. Please sign in again.' }, 401);

  let body: { messages?: unknown; stream?: unknown; jsonSchema?: unknown; tools?: unknown; useOnlyMyKeys?: unknown };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 1_000_000) {
      return json({ error: 'The AI request is too large. Shorten the message and try again.' }, 400);
    }
    body = JSON.parse(raw);
  }
  catch { return json({ error: 'The AI request could not be processed.' }, 400); }

  try {
    const result = await gateway.llmChat({
      messages: body.messages,
      stream: body.stream === true,
      jsonSchema: body.jsonSchema,
      tools: body.tools,
      userId: user.id,
      signal: request.signal,
      useOnlyMyKeys: body.useOnlyMyKeys === true,
    });
    if (result.stream) {
      return new Response(result.stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-LLM-Provider': result.provider,
          'X-LLM-Model': result.model,
        },
      });
    }
    return json({
      text: result.text,
      provider: result.provider,
      model: result.model,
      functionCalls: result.toolCalls || [],
    });
  } catch (error) {
    if (error instanceof LlmGatewayError) return json({ error: error.message }, error.status);
    return json({ error: 'AI is temporarily unavailable. Please try again in a moment.' }, 503);
  }
});
