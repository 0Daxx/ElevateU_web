import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { LLM_CONFIG } from '../_shared/llmConfig.js';
import { encryptApiKey } from '../_shared/apiKeyCrypto.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const providers = new Set(['groq', 'cerebras']);

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function verifiedUser(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey || !admin) return null;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  return error ? null : user;
}

async function requestProviderTest(provider: string, key: string) {
  const config = LLM_CONFIG.providers[provider];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    return await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: 'Reply OK.' }], max_tokens: 1 }),
    });
  } finally { clearTimeout(timeout); }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405);
  if (!admin) return json({ error: 'API key storage is not configured.' }, 503);
  const user = await verifiedUser(request);
  if (!user) return json({ error: 'Please sign in again to manage API keys.' }, 401);

  if (request.method === 'GET') {
    const { data, error } = await admin.from('user_api_keys')
      .select('provider,key_last4,status,created_at,last_used_at').eq('user_id', user.id);
    if (error) return json({ error: 'Could not load your saved API keys.' }, 500);
    return json({ keys: data || [] });
  }

  let body: { provider?: unknown; key?: unknown; action?: unknown };
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 4096) return json({ error: 'The API key request is too large.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'The request could not be processed.' }, 400); }

  const provider = typeof body.provider === 'string' ? body.provider.toLowerCase() : '';
  if (!providers.has(provider)) return json({ error: 'Choose Groq or Cerebras.' }, 400);

  if (request.method === 'DELETE') {
    const { error } = await admin.from('user_api_keys').delete().eq('user_id', user.id).eq('provider', provider);
    if (error) return json({ error: 'Could not remove this API key.' }, 500);
    return json({ message: `${provider === 'groq' ? 'Groq' : 'Cerebras'} key removed.` });
  }

  if (body.action !== 'save' && body.action !== 'replace') return json({ error: 'Choose save or replace.' }, 400);
  if (typeof body.key !== 'string' || !body.key.trim() || body.key.length > 512 || /[\r\n]/.test(body.key)) {
    return json({ error: 'Enter a valid API key.' }, 400);
  }
  const apiKey = body.key.trim();
  let validation: Response;
  try { validation = await requestProviderTest(provider, apiKey); }
  catch { return json({ error: 'Could not reach the provider to verify this key. Please try again.' }, 503); }
  if (!validation.ok) {
    if ([401, 403].includes(validation.status)) return json({ error: 'The provider rejected this key. Check it and try again.' }, 400);
    if (validation.status === 429) return json({ error: 'The provider is rate limiting key checks. Please try again shortly.' }, 429);
    return json({ error: 'The provider could not verify this key. Check that it is active and try again.' }, 400);
  }

  const secret = Deno.env.get('KEY_ENCRYPTION_SECRET') || '';
  let encrypted: Awaited<ReturnType<typeof encryptApiKey>>;
  try { encrypted = await encryptApiKey(apiKey, secret, `${user.id}:${provider}`); }
  catch { return json({ error: 'Secure API key storage is not configured. Please contact support.' }, 503); }

  const values = {
    user_id: user.id, provider, ...encrypted,
    key_last4: apiKey.slice(-4), status: 'active', created_at: new Date().toISOString(),
  };
  if (body.action === 'save') {
    const { error } = await admin.from('user_api_keys').insert(values);
    if (error?.code === '23505') return json({ error: 'A key for this provider already exists. Use Replace to update it.' }, 409);
    if (error) return json({ error: 'Could not save your API key.' }, 500);
  } else {
    const { error } = await admin.from('user_api_keys').upsert(values, { onConflict: 'user_id,provider' });
    if (error) return json({ error: 'Could not replace your API key.' }, 500);
  }
  return json({ message: `${provider === 'groq' ? 'Groq' : 'Cerebras'} key verified and saved.` });
});
