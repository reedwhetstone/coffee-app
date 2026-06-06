# Single Persistent Chat MVP Direction

**Date:** 2026-06-06
**Status:** Proposed direction for chatbot overhaul
**Owner:** Purveyors coffee-app

## Decision

Replace the current multi-workspace chat model with one persistent ongoing dialog per user.

The MVP should remove user-facing workspaces entirely. The product should feel like a single durable agent relationship, not a set of manually managed chat folders. A user can keep talking in one ongoing chat, clear the visible dialog when they want a fresh start, and rely on the system to preserve useful long-term context through a manually editable memory file.

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
- Persistent chat history for the signed-in user.
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

Use one server-owned default chat container per user. This can initially reuse the existing `workspaces` table as an implementation detail:

- Create or fetch one default row per user.
- Stop surfacing the row as a workspace in the UI.
- Treat `workspace_messages` as the current `chat_messages` table in practice.
- Store persistent canvas state on the same default row for now.
- `Clear chat` should delete or archive visible messages for the default conversation, not delete the user's memory file or persistent canvas unless the UI explicitly says so.

This avoids a migration-heavy first PR while still moving the product direction decisively away from workspaces.

### Phase 2: rename the data model when stable

Once the UX is stable, rename the model to match the product:

- `workspaces` -> `chat_profiles`, `chat_threads`, or `user_agent_state`
- `workspace_messages` -> `chat_messages`
- `context_summary` -> `memory_summary` or `compact_context`
- `canvas_state` remains `canvas_state`

Do not burn time on a schema rename before the MVP proves the simpler UX.

## Memory file direction

The future memory system should be a markdown file per user, saved as part of user settings. Conceptually:

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

`workspace_messages.parts` is the durable structured representation of a chat message, not just the plain text.

In the Vercel AI SDK / AI SDK UI message model, a message can contain multiple parts. Examples:

- A text part: what the assistant actually says.
- A tool-call part: the assistant asked to run `coffee_catalog_search` with specific arguments.
- A tool-result part: the result returned by that tool.
- A reasoning/status/data part, depending on SDK features and app usage.
- UI-relevant structured data that lets the client reconstruct what happened.

The current table stores both:

- `content`: plain text fallback for easy display/search.
- `parts`: structured message payload for accurate replay, tool rendering, and canvas extraction.

Why this matters:

- If only `content` is persisted, the chat can show words but loses the tool history.
- If `parts` is persisted, the app can reload the conversation with tool calls/results intact.
- Canvas cards often come from tool parts, not from the final assistant prose.
- Future compaction can inspect tool calls and results instead of relying only on the assistant's narrative.

Plain English: `content` is the transcript. `parts` is the event record that explains how the assistant got there.

## Canonical message recommendation

Treat `parts` as canonical for durable chat replay, with `content` as a convenience fallback.

Implementation implications:

- Preserve the full AI SDK `UIMessage.parts` array when saving messages.
- Do not flatten tool interactions into text before persistence.
- Keep canvas mutations separately when they represent explicit canvas state changes.
- For memory compaction, include enough recent `parts` to understand tool-backed decisions, but summarize into markdown memory rather than storing all old parts in the prompt forever.

## First implementation slice

The first code PR should be boring and independently mergeable:

1. Replace the workspace sidebar/list UX with a single persistent chat shell.
2. Auto-create/fetch one default hidden workspace/conversation per user.
3. Load and save messages against that default conversation.
4. Keep the existing canvas persistence path, but remove workspace switching behavior.
5. Add a visible `Clear chat` action that clears the dialog history for the default conversation.
6. Keep backend model selection unchanged.
7. Update copy/docs so the surface is “Chat”, not “workspace”.

This PR should not implement dreaming, markdown memory, schema renames, or model selection changes. Those are follow-up slices.

## Follow-up implementation slices

### PR 2: memory markdown foundation

- Add a user settings field or table for editable markdown memory.
- Load the memory file into the chat system prompt.
- Add a settings editor for the memory file.
- Keep writes manual or explicitly confirmed at first.

### PR 3: compaction

- Trigger compaction after message count or token thresholds.
- Summarize recent chat into the memory markdown structure.
- Preserve user edits and avoid overwriting manually curated sections blindly.
- Record compaction metadata so the same turns are not compacted repeatedly.

### PR 4: dreaming/reflection

- Run a slower reflection pass over recent compacted history.
- Promote durable preferences, repeated goals, and unresolved questions.
- Keep it transparent: show proposed memory edits before automatic mutation unless confidence and safety are very high.

### PR 5: deeper canvas persistence

- Persist open tabs/cards/focus/layout as first-class canvas state.
- Let the agent focus or add, while user pruning remains authoritative.
- Consider canvas-history linkage only if users need to recover prior states.

## Open questions

- Should `Clear chat` preserve canvas by default? Recommendation: yes, with a separate `Clear canvas` action.
- Should memory edits be automatic or propose/confirm in MVP? Recommendation: manual editor first, proposed edits second, automatic edits later.
- Should old workspace rows be migrated, archived, or left as hidden legacy data? Recommendation: leave hidden initially, then migrate/archive once the new single-dialog flow is stable.
- Should the default hidden conversation be created at account creation or first chat visit? Recommendation: first chat visit.
