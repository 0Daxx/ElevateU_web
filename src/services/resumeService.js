import { supabase } from '../config/supabaseClient';
import { CEREBRAS_KEYS, GROQ_KEYS, LLM_PROVIDER_ORDER } from '../config/env';

// Default AI provider credentials (from VITE_PUBLIC_GROQ_KEYS / VITE_PUBLIC_CEREBRAS_KEYS).
// The edge functions prefer dedicated server secrets when present and use these only as defaults.
const aiCredentialOverrides = () => ({
  ...(GROQ_KEYS ? { groqKeys: GROQ_KEYS } : {}),
  ...(CEREBRAS_KEYS ? { cerebrasKeys: CEREBRAS_KEYS } : {}),
  ...(LLM_PROVIDER_ORDER ? { providerOrder: LLM_PROVIDER_ORDER } : {}),
});

function mapMetadata(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    analyzedAt: row.created_at,
    atsScore: row.score,
  };
}

export async function getResumeHistory(userId) {
  if (!userId) return [];
  const { data, error } = await supabase.from('resume_analyses')
    .select('id,file_name,score,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapMetadata);
}

async function readFunctionError(error) {
  try {
    const payload = await error.context.json();
    return payload?.error || error.message;
  } catch { return error.message || 'Resume analysis could not be completed.'; }
}

export async function analyzeResume(file, userId, useOnlyMyKeys = false) {
  if (!userId) throw new Error('Sign in to analyze a resume.');
  const body = new FormData();
  body.append('file', file, file.name);
  body.append('useOnlyMyKeys', String(useOnlyMyKeys));
  const overrides = aiCredentialOverrides();
  if (Object.keys(overrides).length) body.append('aiConfig', JSON.stringify(overrides));
  const { data, error } = await supabase.functions.invoke('resume-analysis', { body });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.record?.id || !data?.analysis) throw new Error('Resume analysis returned an incomplete result. Please retry.');
  return { ...mapMetadata(data.record), result: data.analysis };
}

export async function getResumeAnalysis(id, userId) {
  const { data, error } = await supabase.from('resume_analyses')
    .select('id,file_name,score,created_at,result')
    .eq('id', id)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return { ...mapMetadata(data), result: data.result };
}

export async function deleteResumeAnalysis(id) {
  const { data, error } = await supabase.functions.invoke('resume-analysis', {
    body: { action: 'delete', id },
  });
  if (error) throw new Error(await readFunctionError(error));
  if (!data?.success) throw new Error('Could not delete this resume analysis.');
}
