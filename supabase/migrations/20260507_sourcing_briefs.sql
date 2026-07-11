-- Saved sourcing brief contract for procurement workflows.
-- Briefs are user-owned durable criteria. Match results are computed live from coffee_catalog.

CREATE TABLE IF NOT EXISTS public.sourcing_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  criteria jsonb NOT NULL,
  cadence text NOT NULL DEFAULT 'manual',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT sourcing_briefs_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT sourcing_briefs_cadence_check CHECK (cadence = 'manual'),
  CONSTRAINT sourcing_briefs_criteria_object_check CHECK (jsonb_typeof(criteria) = 'object')
);

CREATE INDEX IF NOT EXISTS sourcing_briefs_user_created_idx
  ON public.sourcing_briefs (user_id, created_at DESC)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.set_sourcing_briefs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sourcing_briefs_set_updated_at ON public.sourcing_briefs;
CREATE TRIGGER sourcing_briefs_set_updated_at
  BEFORE UPDATE ON public.sourcing_briefs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_sourcing_briefs_updated_at();

ALTER TABLE public.sourcing_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sourcing briefs" ON public.sourcing_briefs;
CREATE POLICY "Users can view own sourcing briefs" ON public.sourcing_briefs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sourcing briefs" ON public.sourcing_briefs;
CREATE POLICY "Users can insert own sourcing briefs" ON public.sourcing_briefs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sourcing briefs" ON public.sourcing_briefs;
CREATE POLICY "Users can update own sourcing briefs" ON public.sourcing_briefs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sourcing briefs" ON public.sourcing_briefs;
CREATE POLICY "Users can delete own sourcing briefs" ON public.sourcing_briefs
  FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.sourcing_briefs TO authenticated;
GRANT ALL ON public.sourcing_briefs TO service_role;
