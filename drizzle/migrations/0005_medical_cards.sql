CREATE TABLE public.medical_cards (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  card jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_cards TO authenticated;
GRANT ALL ON public.medical_cards TO service_role;
ALTER TABLE public.medical_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own medical card" ON public.medical_cards FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE TRIGGER medical_cards_touch BEFORE UPDATE ON public.medical_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();