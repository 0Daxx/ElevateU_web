CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('groq', 'cerebras')),
  encrypted_key text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  key_last4 text NOT NULL CHECK (char_length(key_last4) = 4),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invalid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own API key rows"
  ON public.user_api_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Browser roles receive no table privileges; only trusted server functions use service_role.
REVOKE ALL ON TABLE public.user_api_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_api_keys TO service_role;
