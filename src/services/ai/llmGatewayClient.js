import { supabase } from '../../config/supabaseClient';
import { useUserDataStore } from '../../store/userDataStore';

const GATEWAY_PATH = '/functions/v1/llm-chat';
const DEFAULT_ERROR = 'AI is temporarily unavailable. Please try again in a moment.';

/** Calls only ElevateU's authenticated Edge Function; provider keys never reach this module. */
export async function llmChat({ messages, stream = false, jsonSchema, tools, signal } = {}) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error('Please sign in to use AI features.');

  const response = await fetch(`${supabase.supabaseUrl}${GATEWAY_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabase.supabaseKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, stream, jsonSchema, tools, useOnlyMyKeys: useUserDataStore.getState().settings?.useOnlyMyKeys === true }),
    signal,
  });

  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch { /* Use the generic response below. */ }
    throw new Error(payload?.error || DEFAULT_ERROR);
  }

  if (stream) {
    return {
      provider: response.headers.get('x-llm-provider'),
      model: response.headers.get('x-llm-model'),
      stream: response.body,
    };
  }

  try { return await response.json(); }
  catch { throw new Error(DEFAULT_ERROR); }
}
