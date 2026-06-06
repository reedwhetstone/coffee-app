# Single Persistent Chat MVP Direction

**Date:** 2026-06-06
**Status:** Proposed direction for chatbot overhaul
**Owner:** Purveyors coffee-app

## Decision

Replace the current multi-workspace chat model with one persistent ongoing dialog per member user.

The MVP should remove member-facing workspaces entirely. The product should feel like a single durable agent relationship, not a set of manually managed chat folders. A member user can keep talking in one ongoing chat, clear the visible dialog when they want a fresh start, and rely on the system to preserve useful long-term context through a manually editable memory file.

## Why this changes the direction

The existing workspace model is clunky because it asks users to predict context boundaries up front. That does not match how useful agents preserve memory. Real agent memory is layered:

- Recent chat turns remain in the active context window.
- Durable distilled memory carries preferences, decisions, facts, and unresolved threads forward.
- Periodic compaction prevents the full transcript from becoming the product's long-term brain.
- Dreaming or reflection can promote patterns that were not obvious from a single turn.

Workspaces are an application taxonomy. Agent memory is a continuity system. For the Purveyors chat product, continuity is the higher-leverage primitive.

## MVP product shape

### Keep

- One `/chat` surface.
- Persistent chat history for the active member session.
- Persistent canvas state.
- Backend-owned model selection. Do not expose model selection in the UI yet.
- Existing tool/action-card safety model: write tools propose changes; user confirms execution.

### Remove or hide

- Workspace creation.
- Workspace switching.
- Workspace types as a visible user concept.
- Workspace title/rename/delete UI.
- Any UX that asks the user to decide whether they are in a sourcing, roasting, inventory, analysis, or general workspace before chatting.

### Add later, after the basic simplification lands

- Autocompaction into a durable memory markdown file.
- User-editable memory file stored with user settings.
- Dreaming/reflection pass that periodically rewrites or proposes updates to memory.
- Optional normal chat-session list only if there is a proven need. This should not be the default replacement for workspaces.

## Proposed persistence model

For the MVP, the cleanest path is to keep the database substrate mostly intact while changing the user-facing concept.

### Phase 1: one implicit default conversation

Use one server-owned default chat container per member user. This can initially reuse the existing `workspaces` table as an implementation detail, but only after the row is deterministic:

- Create or fetch the marked deterministic default row per member user only after the existing member entitlement check passes.
- Add a durable server-owned discriminator before removing workspace switching. Acceptable shapes are either a `workspaces` marker such as `purpose = 'default_chat'` / `is_default_chat = true`, or a dedicated per-user chat-state row with a `default_workspace_id` foreign key.
- Back the marker with a uniqueness guarantee, for example a partial unique index that permits at most one default chat workspace per member user, or a unique `user_chat_state.user_id` row. Fetch by this marker/key, never by `last_accessed_at`, title, workspace type, or “first row” ordering.
- Migration/backfill must be explicit. For existing members, create a new hidden default chat row when no marked row exists, or mark exactly one row only if a deliberate import rule chooses it. Do not silently promote an arbitrary legacy workspace. If multiple marked defaults are detected, fail closed and require repair rather than guessing.
- Keep legacy workspace rows recoverable during the transition. They may be hidden from the simplified chat UI, but the implementation must not strand prior conversations behind an unmarked default row.
- Stop surfacing the default row as a workspace in the UI.
- Treat `workspace_messages` as the current `chat_messages` table in practice.
- Store persistent canvas state on the same default row for now.
- `Clear chat` should archive or soft-hide visible messages for the default conversation, not physically delete rows that may be referenced by memory compaction metadata. The first slice should prefer a `hidden_after_clear_at` / `clear_epoch` style boundary over hard deletes. If the implementation truly must hard-delete message rows, it must also reset `agent_memory_compacted_through_message_id` to `null` and store a clear epoch so future compaction starts from the post-clear transcript instead of following a deleted boundary row. Clearing chat must not delete the user's memory file or persistent canvas unless the UI explicitly says so.

This avoids a full schema rename in the first PR while still moving the product direction decisively away from workspaces. It does not avoid the small migration/index needed to identify the hidden default conversation safely.

### Phase 2: rename the data model when stable

Once the UX is stable, rename the model to match the product:

- `workspaces` -> `chat_profiles`, `chat_threads`, or `user_agent_state`
- `workspace_messages` -> `chat_messages`
- `context_summary` -> `memory_summary` or `compact_context`
- `canvas_state` remains `canvas_state`

Do not burn time on a schema rename before the MVP proves the simpler UX.

## Memory file direction

The future memory system should be a markdown file per member user, saved as part of user settings. Conceptually:

```markdown
# Purveyors Chat Memory

## User preferences
- ...

## Coffee sourcing preferences
- ...

## Roasting context
- ...

## Inventory and business facts
- ...

## Open questions
- ...

## Recent durable decisions
- ...
```

Rules:

- The user can manually edit this file.
- The agent may propose or apply additive updates, depending on future product safety choices.
- Compaction should summarize the conversation into durable facts, preferences, decisions, and unresolved tasks, not copy chat logs.
- Dreaming should be a slower reflection pass that finds patterns across recent chats and updates memory only when the pattern is useful.
- Clearing chat should not clear memory by default. Memory is the relationship layer, not the transcript layer.

## Memory and compaction MVP

Memory and compaction should be part of the MVP direction, but the first implementation should stay intentionally small: one editable markdown file per member user, one deterministic compaction endpoint, and no vector database or multi-layer retrieval stack.

Recent OpenAI memory direction validates the broad shape: useful assistant memory needs to carry forward user preferences and relevant context, and newer background synthesis work points toward asynchronous consolidation rather than storing raw chat forever. OpenClaw's own long-running memory/dreaming pattern points the same way: persistent editable files plus periodic distillation beat a giant transcript.

### Source of truth

Add one user-editable markdown document, stored in user settings or a dedicated profile table field:

- `agent_memory_md text not null default <template>`
- `agent_memory_updated_at timestamptz`
- `agent_memory_compacted_through_message_id uuid null`
- `agent_memory_revision integer not null default 0` for optimistic locking across manual saves and background compaction

This markdown file is the canonical durable memory. It is passed into the chat system prompt every turn. It is not a transcript and not a process log.

All writes to this file must be compare-and-swap writes in the first writable-memory slice: manual `Save memory`, manual `Update memory now`, and background compaction all read the current revision and update only when that revision still matches. On conflict, the server should not last-write-wins overwrite the markdown. Manual saves should return a conflict state that lets the user review the newer memory. Background compaction should either retry from the newest memory plus the same uncompacted messages, or degrade to a proposed update for user review.

### Recommended template

```markdown
# Purveyors Chat Memory

## Operating instructions
- Stable user instructions, response preferences, and constraints.

## User and business context
- Durable facts about the user's coffee work, business, inventory habits, and goals.

## Coffee preferences
- Origins, processes, flavor profiles, price ranges, suppliers, and quality markers the user prefers or avoids.

## Current working context
- Short-term active threads that should survive chat clearing: open decisions, active sourcing hunts, beans under consideration, roast experiments, follow-ups.

## Long-term ideals and strategy
- Durable strategic direction, product/business philosophy, recurring evaluation criteria.

## Decisions and constraints
- Explicit decisions, hard constraints, and defaults that should guide future answers.

## Ignore / do not remember
- User-corrected false memories, stale facts, and topics the user does not want personalized.
```

### Compaction trigger

Start with one simple trigger:

- After every assistant response, if there are at least 8 new messages since `agent_memory_compacted_through_message_id`, call `/api/chat/memory/compact` in the background.
- Also expose a manual `Update memory now` button in settings.

Do not compact every turn. Do not run a cron at first. Do not block the chat response on compaction.

The compaction boundary must remain valid across `Clear chat`. If clear chat archives/soft-hides rows, compaction can continue from `agent_memory_compacted_through_message_id` while filtering by the current clear epoch for visible history. If clear chat hard-deletes rows, reset the compacted-through marker during the same transaction and compact only messages created after the clear epoch. Do not leave `agent_memory_compacted_through_message_id` pointing at a deleted `workspace_messages` row.

### Compaction input

Pass only:

- Current `agent_memory_md`
- New user and assistant `content` since the last compacted message
- Selected tool-result summaries when they directly affected a decision
- Current `canvas_state` summary, because the canvas may contain active working context

Do not pass old reasoning/status/process parts. Do not ask the model to preserve tool traces.

### Compaction output

Ask the model for a full replacement markdown file in the same template, plus a tiny change summary for logging. The instruction should be conservative:

- preserve user-written instructions unless clearly superseded
- add only durable or currently useful facts
- move active but temporary details to `Current working context`
- remove stale short-term details when they are resolved
- record corrections in `Ignore / do not remember` when relevant
- never preserve private/sensitive details unless the user explicitly asked to remember them
- never preserve agent chain-of-thought, tool traces, or process chatter

Apply the replacement only through the `agent_memory_revision` compare-and-swap path. If the revision changed while the compactor was running, do not overwrite the newer memory. Re-run compaction against the latest memory or surface the replacement as a proposed diff.

### Dreaming MVP

For MVP, dreaming should be a slower reflection pass over the same markdown memory, not a separate architecture.

Recommended first version:

- Run only when the user opens settings and clicks `Reflect on memory`, or after a large threshold such as 50 compacted messages.
- Input: current memory file, compacted change summaries, and recent active context headings.
- Output: proposed markdown diff or full replacement memory.
- UI: show a preview and let the user accept/reject.

This captures the value of dreaming: pattern detection, staleness cleanup, and promotion of repeated themes, without building a hidden autonomous memory engine on day one.

### Prompt integration

Every chat request should include:

```text
USER MEMORY
The following is the user's editable Purveyors Chat Memory. Treat it as durable context. If it conflicts with the current user message, obey the current message and consider whether memory needs correction.

<agent_memory_md>
```

Keep the system prompt simple. The memory markdown should carry personalization.

### User controls

Settings should include:

- Markdown editor for the memory file.
- `Save memory` button.
- `Update memory now` button.
- `Reflect on memory` button, optional for the first PR if time is tight.
- `Clear memory` danger action, separate from `Clear chat`.

Clearing chat should not clear memory. Clearing canvas should not clear memory.

### Red-team conclusion

The main risk is over-engineering. A vector store, multiple memory tables, automatic hidden edits, and elaborate provenance tracking would recreate the same clunkiness as workspaces. The MVP should make the memory legible and user-editable first. If a single markdown file starts to strain, that is useful evidence for the next layer.

The second risk is treating memory as a dumping ground. The compactor must be ruthless: preserve canonical direction, useful short-term context, long-term ideals, preferences, decisions, and constraints; delete fleeting details.

## Canvas direction

The canvas should be persistent and shared between user and bot.

Recommended behavior:

- The user owns closing tabs/cards/blocks they no longer want.
- The agent should be additive by default when the current task relates to existing canvas contents.
- The agent can change focus, layout, highlighted items, and presented tabs when it improves the task.
- The agent should replace or clear only when the topic clearly shifts or when the user asks.
- Canvas state should be saved independent of visible chat history.

This means the current prompt's canvas lifecycle guidance should be softened. The existing “do not accumulate more than 5-6 items” rule is too aggressive for the new direction. The agent should avoid clutter, but the user should be in charge of pruning.

## What `workspace_messages.parts` means

`workspace_messages.parts` is the structured AI SDK representation of a chat message. It can include text, tool calls, tool results, and UI/data fragments. `content` is the plain-text transcript fallback.

Important distinction: `parts` is not the memory system and should not become long-term agent memory. It is an operational replay/debug record for recent chat turns. The future memory system should distill useful direction into markdown and deliberately discard fleeting process.

`parts` can matter for canvas only because some current canvas cards are derived from tool results or presentation tool parts. That is an implementation coupling, not the desired architecture. Canvas persistence should not depend on replaying every old message part.

Plain English:

- `content` = what the user/assistant said.
- `parts` = structured event payload for recent UI replay, tool rendering, and debugging.
- `canvas_state` = the durable source of truth for what is on the canvas.
- `memory.md` = the durable source of truth for what the agent should remember.

## Canonical message recommendation

Do not treat `parts` as canonical long-term memory. Treat it as short-term operational data.

Recommended persistence policy:

- Persist `content` for visible chat history.
- Persist `canvas_state` as first-class state, independent of chat replay.
- Persist explicit `canvas_mutations` only when useful for debugging or short-term recovery.
- Persist `parts` only for recent messages where it is needed for UI replay, tool-result rendering, or compaction input.
- Exclude reasoning/process/status fragments from durable memory.
- Let compaction read recent content, selected tool results, and canvas state, then write distilled markdown memory.
- Add retention/compaction later so old `parts` can be pruned or archived after their useful window closes.

Final position: process is useful as a short-term event log, not as long-term memory. The product should remember outcomes, preferences, decisions, constraints, active context, and durable ideals, not the agent's internal path to get there.

## First implementation slice

The first code PR should still be boring and independently mergeable, but it should include the memory foundation because memory is central to the single-dialog product direction:

1. Replace the workspace sidebar/list UX with a single persistent chat shell.
2. Add the deterministic hidden-default marker or chat-state mapping, backfill it safely, enforce one default per member user, then auto-create/fetch that marked default hidden workspace/conversation after the existing member entitlement check passes.
3. Load and save messages against that default conversation.
4. Keep the existing canvas persistence path, but remove workspace switching behavior.
5. Add a visible `Clear chat` action that clears the dialog history for the default conversation.
6. Implement clear-chat as archive/soft-hide with a durable clear epoch, or reset the compaction marker transactionally if hard deletes are retained.
7. Add one editable `agent_memory_md` field in settings, include required `agent_memory_revision` conflict protection, and inject the memory into the chat prompt.
8. Add a simple background compaction endpoint triggered after a small threshold of new messages, with the same conflict-safe write path as manual memory saves.
9. Keep backend model selection unchanged.
10. Update copy/docs so the surface is “Chat”, not “workspace”.

This PR should not implement schema renames, vector retrieval, hidden autonomous memory writes, or public model selection changes. Dreaming can start as a manual or thresholded reflection action after the markdown memory foundation exists.

## Follow-up implementation slices

### PR 2: memory UX hardening

- Add diff preview for compaction updates.
- Add `Reflect on memory` for dreaming-style cleanup and pattern promotion.
- Improve conflict UX for manual user edits while compaction is running, for example a merge view or proposed diff recovery. The core revision check belongs in PR 1.
- Add clear separation between `Clear chat`, `Clear canvas`, and `Clear memory`.

### PR 3: retention and pruning

- Prune or archive old `parts` after compaction.
- Keep message `content` history according to product retention choices.
- Store compacted-through metadata so the same turns are not compacted repeatedly.

### PR 4: dreaming/reflection automation

- Run a slower reflection pass after larger thresholds.
- Promote durable preferences, repeated goals, long-term ideals, and unresolved questions.
- Keep it transparent: show proposed memory edits before automatic mutation unless confidence and safety are very high.

### PR 5: deeper canvas persistence

- Persist open tabs/cards/focus/layout as first-class canvas state.
- Let the agent focus or add, while user pruning remains authoritative.
- Consider canvas-history linkage only if users need to recover prior states.

## Open questions

- Should `Clear chat` preserve canvas by default? Recommendation: yes, with a separate `Clear canvas` action.
- Should memory edits be automatic or propose/confirm in MVP? Recommendation: manual editor first, proposed edits second, automatic edits later.
- Should old workspace rows be migrated, archived, or left as hidden legacy data? Recommendation: leave legacy rows recoverable and hidden from the simplified chat UI initially; create or mark the deterministic default conversation separately, then migrate/archive legacy rows once the new single-dialog flow is stable.
- Should the default hidden conversation be created at account creation or first eligible member chat visit? Recommendation: first eligible member chat visit.
