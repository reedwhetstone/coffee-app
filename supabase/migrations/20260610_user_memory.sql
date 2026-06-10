-- User memory: a persistent, user-editable context document that the chat
-- agent always sees and periodically maintains ("dreaming" compaction).
-- One document per user, shared across all conversations.

CREATE TABLE IF NOT EXISTS public.user_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'user' CHECK (updated_by IN ('user', 'agent'))
);

COMMENT ON TABLE public.user_memory IS
  'Persistent per-user context document injected into every chat request and maintained by the agent via periodic compaction.';
COMMENT ON COLUMN public.user_memory.updated_by IS
  'Who last wrote the document: user (manual edit) or agent (dream/compaction pass).';

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_memory'
      AND policyname = 'Users manage their own memory'
  ) THEN
    CREATE POLICY "Users manage their own memory" ON public.user_memory
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_memory TO authenticated;
GRANT ALL ON public.user_memory TO service_role;
