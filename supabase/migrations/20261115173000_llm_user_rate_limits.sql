-- Per-user rate limit state for the server-side LLM gateway.
CREATE TABLE IF NOT EXISTS public.llm_user_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

ALTER TABLE public.llm_user_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own LLM rate limit" ON public.llm_user_rate_limits;
CREATE POLICY "Users can view own LLM rate limit"
  ON public.llm_user_rate_limits FOR SELECT
  USING (auth.uid() = user_id);
GRANT SELECT ON public.llm_user_rate_limits TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_llm_user_rate_limit(p_user_id uuid, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', clock_timestamp());
  v_allowed boolean;
BEGIN
  IF p_user_id IS NULL OR p_limit < 1 THEN
    RETURN false;
  END IF;

  INSERT INTO public.llm_user_rate_limits (user_id, window_started_at, request_count)
  VALUES (p_user_id, v_window, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET window_started_at = CASE
          WHEN public.llm_user_rate_limits.window_started_at < v_window THEN v_window
          ELSE public.llm_user_rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN public.llm_user_rate_limits.window_started_at < v_window THEN 1
          ELSE public.llm_user_rate_limits.request_count + 1
        END
    WHERE public.llm_user_rate_limits.window_started_at < v_window
       OR public.llm_user_rate_limits.request_count < p_limit
  RETURNING true INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_llm_user_rate_limit(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_llm_user_rate_limit(uuid, integer) TO service_role;
