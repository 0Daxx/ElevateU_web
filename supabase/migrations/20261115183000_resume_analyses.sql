CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  extracted_text text NOT NULL,
  result jsonb NOT NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS resume_analyses_user_created_idx
  ON public.resume_analyses (user_id, created_at DESC);

ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own resume analyses" ON public.resume_analyses;
CREATE POLICY "Users can view their own resume analyses"
  ON public.resume_analyses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.resume_analyses FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.resume_analyses TO authenticated;
GRANT ALL ON TABLE public.resume_analyses TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resume-files', 'resume-files', false, 5242880,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can read their own resume files" ON storage.objects;
CREATE POLICY "Users can read their own resume files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resume-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload their own resume files" ON storage.objects;
CREATE POLICY "Users can upload their own resume files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resume-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own resume files" ON storage.objects;
CREATE POLICY "Users can delete their own resume files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resume-files' AND (storage.foldername(name))[1] = auth.uid()::text);
