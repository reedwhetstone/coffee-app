-- Lot watchlist for intelligence users.
-- Tracks lots a user has flagged for monitoring; context is computed live against coffee_catalog.

CREATE TABLE IF NOT EXISTS public.tracked_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_id integer NOT NULL,
  tracked_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  notes text,
  CONSTRAINT tracked_lots_user_catalog_unique UNIQUE (user_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS tracked_lots_user_idx
  ON public.tracked_lots (user_id, tracked_at DESC);

ALTER TABLE public.tracked_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tracked lots" ON public.tracked_lots;
CREATE POLICY "Users can view own tracked lots" ON public.tracked_lots
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tracked lots" ON public.tracked_lots;
CREATE POLICY "Users can insert own tracked lots" ON public.tracked_lots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tracked lots" ON public.tracked_lots;
CREATE POLICY "Users can delete own tracked lots" ON public.tracked_lots
  FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.tracked_lots TO authenticated;
GRANT ALL ON public.tracked_lots TO service_role;
