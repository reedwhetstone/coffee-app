ALTER TABLE public.workspace_messages
  ADD COLUMN IF NOT EXISTS client_message_id text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_messages_workspace_client_message_id_unique'
      AND conrelid = 'public.workspace_messages'::regclass
  ) THEN
    ALTER TABLE public.workspace_messages
      ADD CONSTRAINT workspace_messages_workspace_client_message_id_unique
      UNIQUE (workspace_id, client_message_id);
  END IF;
END $$;
