import { supabase } from '../config/supabaseClient';

const API_KEYS_PATH = '/functions/v1/api-keys';

async function apiKeyRequest(method, body) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error('Please sign in again to manage API keys.');
  const response = await fetch(`${supabase.supabaseUrl}${API_KEYS_PATH}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabase.supabaseKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload;
  try { payload = await response.json(); } catch { throw new Error('Could not process the API key service response.'); }
  if (!response.ok) throw new Error(payload?.error || 'Could not manage your API key.');
  return payload;
}

export async function listUserApiKeys() {
  const payload = await apiKeyRequest('GET');
  return Array.isArray(payload.keys) ? payload.keys : [];
}

export async function saveUserApiKey(provider, key, action = 'save') {
  return apiKeyRequest('POST', { provider, key, action });
}

export async function deleteUserApiKey(provider) {
  return apiKeyRequest('DELETE', { provider });
}
