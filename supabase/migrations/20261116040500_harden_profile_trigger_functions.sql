-- Keep the profile helpers limited to their trigger use and browser-safe grants.
ALTER FUNCTION public.handle_new_user()
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

REVOKE ALL ON TABLE public.resume_analyses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.resume_analyses TO authenticated;
GRANT ALL ON TABLE public.resume_analyses TO service_role;

