CREATE TABLE public.overpass_cache (
  cache_key text PRIMARY KEY,
  places jsonb NOT NULL,
  radius_m integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.overpass_cache TO service_role;
ALTER TABLE public.overpass_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only the backend (service role) reads and writes this shared cache.