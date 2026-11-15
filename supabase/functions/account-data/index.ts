import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Account data service is not configured' }, 500);

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: 'Invalid or expired session' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let action: string;
  try { ({ action } = await request.json()); }
  catch { return json({ error: 'Invalid request body' }, 400); }

  if (action === 'export') {
    const [profile, roadmapSelections, subtopicProgress, llmRateLimit, resumeAnalyses] = await Promise.all([
      admin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      admin.from('user_roadmap_selections').select('*').eq('user_id', user.id),
      admin.from('user_subtopic_progress').select('*').eq('user_id', user.id),
      admin.from('llm_user_rate_limits').select('*').eq('user_id', user.id).maybeSingle(),
      admin.from('resume_analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    const failure = profile.error || roadmapSelections.error || subtopicProgress.error || llmRateLimit.error || resumeAnalyses.error;
    if (failure) return json({ error: `Could not export account data: ${failure.message}` }, 500);
    return json({
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, createdAt: user.created_at },
      profiles: profile.data ? [profile.data] : [],
      user_roadmap_selections: roadmapSelections.data || [],
      user_subtopic_progress: subtopicProgress.data || [],
      llm_user_rate_limits: llmRateLimit.data ? [llmRateLimit.data] : [],
      resume_analyses: resumeAnalyses.data || [],
    });
  }

  if (action === 'delete') {
    const resumes = await admin.from('resume_analyses').select('file_path').eq('user_id', user.id);
    if (resumes.error) return json({ error: `Could not prepare resume files for deletion: ${resumes.error.message}` }, 500);
    if (resumes.data?.length) {
      const { error: storageError } = await admin.storage.from('resume-files').remove(resumes.data.map((row) => row.file_path));
      if (storageError) return json({ error: `Could not delete stored resume files: ${storageError.message}` }, 500);
      const { error: resumeError } = await admin.from('resume_analyses').delete().eq('user_id', user.id);
      if (resumeError) return json({ error: `Could not delete resume analysis rows: ${resumeError.message}` }, 500);
    }
    // Explicitly remove known user-owned rows before deleting auth.users. Other
    // auth-linked rows with ON DELETE CASCADE are removed by Supabase/Postgres.
    const selections = await admin.from('user_roadmap_selections').delete().eq('user_id', user.id);
    if (selections.error) return json({ error: `Could not delete roadmap selections: ${selections.error.message}` }, 500);
    const progress = await admin.from('user_subtopic_progress').delete().eq('user_id', user.id);
    if (progress.error) return json({ error: `Could not delete roadmap progress: ${progress.error.message}` }, 500);
    const profile = await admin.from('profiles').delete().eq('id', user.id);
    if (profile.error) return json({ error: `Could not delete profile: ${profile.error.message}` }, 500);
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return json({ error: `Could not delete authentication account: ${deleteError.message}` }, 500);
    return json({ success: true });
  }

  return json({ error: 'Unsupported account data action' }, 400);
});
