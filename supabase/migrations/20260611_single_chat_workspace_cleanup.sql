-- Collapse legacy multi-workspace chat data to the single continuous chat model.
--
-- Active chat persistence now expects one workspace row per user. This migration
-- removes old workspace rows from the active tables, but first archives the
-- removed workspace and message rows so the migration is auditable and
-- recoverable if useful history was misclassified as legacy noise.
--
-- Canonical workspace selection per user:
--   1. Highest message count, preserving the most substantive conversation.
--   2. Most recent activity across last_accessed_at, latest message, created_at.
--   3. Newest created_at / id as deterministic final tie-breakers.
--
-- Manual preflight, if desired before running migration:
-- SELECT user_id, count(*) AS workspace_count
-- FROM public.workspaces
-- GROUP BY user_id
-- HAVING count(*) > 1 OR user_id IS NULL
-- ORDER BY workspace_count DESC;

CREATE TABLE IF NOT EXISTS public.archived_chat_workspaces (
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  archive_reason text NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid,
  title text,
  type text,
  context_summary text,
  canvas_state jsonb,
  last_accessed_at timestamp with time zone,
  created_at timestamp with time zone,
  message_count integer NOT NULL DEFAULT 0,
  latest_message_at timestamp with time zone,
  CONSTRAINT archived_chat_workspaces_pkey PRIMARY KEY (workspace_id)
);

CREATE TABLE IF NOT EXISTS public.archived_chat_workspace_messages (
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  archive_reason text NOT NULL,
  message_id uuid NOT NULL,
  workspace_id uuid,
  role text NOT NULL,
  content text NOT NULL,
  parts jsonb,
  canvas_mutations jsonb,
  created_at timestamp with time zone,
  CONSTRAINT archived_chat_workspace_messages_pkey PRIMARY KEY (message_id)
);

WITH workspace_activity AS (
  SELECT
    w.id,
    w.user_id,
    w.title,
    w.type,
    w.context_summary,
    w.canvas_state,
    w.created_at,
    w.last_accessed_at,
    count(m.id)::integer AS message_count,
    max(m.created_at) AS latest_message_at,
    greatest(
      coalesce(w.last_accessed_at, '-infinity'::timestamptz),
      coalesce(max(m.created_at), '-infinity'::timestamptz),
      coalesce(w.created_at, '-infinity'::timestamptz)
    ) AS last_activity_at
  FROM public.workspaces w
  LEFT JOIN public.workspace_messages m ON m.workspace_id = w.id
  GROUP BY w.id, w.user_id, w.title, w.type, w.context_summary, w.canvas_state, w.created_at, w.last_accessed_at
), ranked_workspaces AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY
        message_count DESC,
        last_activity_at DESC,
        created_at DESC NULLS LAST,
        id DESC
    ) AS keep_rank
  FROM workspace_activity
  WHERE user_id IS NOT NULL
), workspaces_to_archive AS (
  SELECT
    id,
    user_id,
    title,
    type,
    context_summary,
    canvas_state,
    created_at,
    last_accessed_at,
    message_count,
    latest_message_at,
    last_activity_at,
    NULL::bigint AS keep_rank,
    'single-chat-workspace-cleanup:null-user'::text AS archive_reason
  FROM workspace_activity
  WHERE user_id IS NULL

  UNION ALL

  SELECT
    id,
    user_id,
    title,
    type,
    context_summary,
    canvas_state,
    created_at,
    last_accessed_at,
    message_count,
    latest_message_at,
    last_activity_at,
    keep_rank,
    'single-chat-workspace-cleanup:non-canonical'::text AS archive_reason
  FROM ranked_workspaces
  WHERE keep_rank > 1
), archived_workspaces AS (
  INSERT INTO public.archived_chat_workspaces (
    archive_reason,
    workspace_id,
    user_id,
    title,
    type,
    context_summary,
    canvas_state,
    last_accessed_at,
    created_at,
    message_count,
    latest_message_at
  )
  SELECT
    archive_reason,
    id,
    user_id,
    title,
    type,
    context_summary,
    canvas_state,
    last_accessed_at,
    created_at,
    message_count,
    latest_message_at
  FROM workspaces_to_archive
  ON CONFLICT (workspace_id) DO UPDATE SET
    archived_at = excluded.archived_at,
    archive_reason = excluded.archive_reason,
    user_id = excluded.user_id,
    title = excluded.title,
    type = excluded.type,
    context_summary = excluded.context_summary,
    canvas_state = excluded.canvas_state,
    last_accessed_at = excluded.last_accessed_at,
    created_at = excluded.created_at,
    message_count = excluded.message_count,
    latest_message_at = excluded.latest_message_at
  RETURNING workspace_id, archive_reason
), archived_messages AS (
  INSERT INTO public.archived_chat_workspace_messages (
    archive_reason,
    message_id,
    workspace_id,
    role,
    content,
    parts,
    canvas_mutations,
    created_at
  )
  SELECT
    aw.archive_reason,
    m.id,
    m.workspace_id,
    m.role,
    m.content,
    m.parts,
    m.canvas_mutations,
    m.created_at
  FROM public.workspace_messages m
  JOIN archived_workspaces aw ON aw.workspace_id = m.workspace_id
  ON CONFLICT (message_id) DO UPDATE SET
    archived_at = excluded.archived_at,
    archive_reason = excluded.archive_reason,
    workspace_id = excluded.workspace_id,
    role = excluded.role,
    content = excluded.content,
    parts = excluded.parts,
    canvas_mutations = excluded.canvas_mutations,
    created_at = excluded.created_at
  RETURNING message_id
)
DELETE FROM public.workspaces w
USING archived_workspaces aw
WHERE w.id = aw.workspace_id;

-- Prevent the obsolete multi-workspace API from re-accumulating rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspaces_one_per_user_key'
      AND conrelid = 'public.workspaces'::regclass
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_one_per_user_key UNIQUE (user_id);
  END IF;
END $$;
