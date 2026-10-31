CREATE TABLE public.trip_conversations (user_id uuid PRIMARY KEY, messages jsonb NOT NULL DEFAULT '[]'::jsonb, trip_input jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_conversations TO authenticated;
GRANT ALL ON public.trip_conversations TO service_role;
ALTER TABLE public.trip_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trip conversation" ON public.trip_conversations FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE TABLE public.trip_search_cache (cache_key text PRIMARY KEY, value jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.trip_search_cache TO service_role;
ALTER TABLE public.trip_search_cache ENABLE ROW LEVEL SECURITY;