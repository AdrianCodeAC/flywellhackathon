CREATE TABLE public.content_cache (
  cache_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.content_cache TO service_role;
ALTER TABLE public.content_cache ENABLE ROW LEVEL SECURITY;