# Chat agent UI/UX and infrastructure red-team

**Date:** 2026-07-11  
**Reviewed:** `origin/main` at `64b2f7c`  
**Scope:** `/chat`, Ask Parchment drawer, canvas, GenUI/action cards, persistence, responsive behavior, accessibility, product positioning, and brand alignment  
**Disposition:** Corrections required

## Executive assessment

The persistent conversation plus evolving canvas is the right product shape. It aligns with the product belief that intelligence should replace navigation and gives Parchment Intelligence a plausible workbench rather than a generic chatbot shell.

The current implementation is not yet trustworthy enough for that positioning. Three state contracts can lose context, lose persistence, or permit duplicate writes. The visible experience also still presents itself as a broad coffee consultant, hides the strongest evidence behind a separate mobile overlay, and exposes implementation-model controls before the sourcing workflow is understood.

The canvas tab-removal defect was fixed separately in PR #453. This audit covers the rest of the chat-agent surface.

## Severity summary

- P0: 0
- P1: 6
- P2: 6

## P1 findings

### 1. Clearing a conversation strands subsequent messages outside persistence

**Evidence:** `src/lib/components/chat/ChatWorkspace.svelte:958-968`, `src/lib/stores/workspaceStore.svelte.ts:55-56`, `src/lib/stores/workspaceStore.svelte.ts:254-255`.

`clearConversation()` empties the local messages and deletes server rows, but it does not reset the workspace store's saved-message count. Persistence continues slicing new messages from the old count.

**Failure scenario:** Clear a 40-message thread, then send 1–39 new messages. Those messages are omitted from persistence and disappear on reload. The DELETE response is also unchecked, so a failed clear looks successful.

**Correction:** Make clearing a workspace-owned operation that checks the DELETE response, resets its saved count only after success, and leaves or restores the local thread on failure. Test hydrate N → clear → send one pair → reload.

### 2. Completed write actions can become executable again after canvas remount

**Evidence:** `src/lib/components/genui/blocks/ActionCardBlock.svelte:103-118`, `src/lib/components/chat/ChatWorkspace.svelte:1068-1077`.

Action execution status is component-local. It is not written back to the canvas block or protected by a server idempotency key.

**Failure scenario:** Execute an inventory, roast, or sale write from a mobile/drawer canvas; close and reopen the overlay. The action card remounts from its original `proposed` payload and offers Execute again, permitting a duplicate write.

**Correction:** Give each proposed write a durable action/idempotency ID. Persist execution status and result into canvas state, and make the server reject duplicate IDs. Test execute → remount → completed and non-executable.

### 3. Page-aware chat drops unchanged page context after the first request

**Evidence:** `src/lib/components/chat/ChatDrawer.svelte:43-45`, `src/lib/components/chat/ChatWorkspace.svelte:872-887`, `src/routes/api/chat/+server.ts:506-510`.

The drawer says it knows the current page, but the client sends page context only when its serialized value changes. The server builds a fresh prompt per request and does not retain omitted context.

**Failure scenario:** Ask for a shortlist from a filtered catalog, then ask a follow-up relative to the same view. The second request has no page context. Toggling page context off and back on can also fail to resend it.

**Correction:** Send the current opted-in bounded page-context snapshot on every request, or persist an explicit server-side context contract. Add repeat-send and off→on tests. Publish context from every surface that claims support; current publishers cover catalog, analytics, and dashboard, not beans, roast, or profit.

### 4. Long-running and failed turns have no stop/retry recovery path

**Evidence:** `src/lib/components/chat/ChatComposer.svelte:151-189`, `src/lib/components/chat/ChatWorkspace.svelte:892-927`, `src/routes/api/chat/+server.ts:56-60`.

The composer disables input for the whole active turn and replaces Send with a spinner. The submitted prompt is cleared before the request, while errors offer only Dismiss.

**Failure scenario:** A multi-tool market query stalls or fails. The user cannot cancel, refine, retry, or recover the submitted prompt without retyping it.

**Correction:** Expose an accessible Stop action during submitted/streaming states, retain the last submitted prompt, and offer Retry for recoverable failures. Distinguish timeout, access, no-results, tool, and persistence errors by next action.

### 5. Mobile hides the evidence behind a separate canvas viewer

**Evidence:** `src/lib/components/genui/GenUIBlockRenderer.svelte:37-57`, `src/lib/components/chat/ChatMessageList.svelte:303-321`, `src/lib/components/chat/ChatWorkspace.svelte:1008-1024`, `src/lib/components/chat/CanvasMobileOverlay.svelte:20-43`.

Chat-mode GenUI renders compact result pills. Full results live in a full-screen overlay.

**Failure scenario:** A phone user asks for a three-coffee sourcing comparison. The conversation shows only a result-count pill; inspecting supplier, price, score, and provenance requires leaving the conversational flow, then closing the canvas to continue.

**Correction:** Render evidence-rich, progressively disclosed blocks inline on small screens. Keep the canvas overlay for pinned multi-result comparison and workspace arrangement, not as the only way to see results.

### 6. The assistant identity is generic coffee consulting rather than supply-chain intelligence

**Evidence:** `src/routes/api/chat/+server.ts:21-24`, `src/routes/api/chat/+server.ts:117-120`, `src/lib/components/chat/ChatMessageList.svelte:153-203`.

The system prompt defines an enthusiastic expert coffee consultant for enthusiasts and professionals. Onboarding leads with broad topics such as flavor profiles, processing, and roasting.

**Failure scenario:** A green buyer opens Parchment Intelligence and encounters positioning that could describe any general coffee chatbot.

**Correction:** Center the identity on source, compare, track, benchmark, and decide. Lead with live stocked supply, supplier breadth, provenance, pricing, Market Index context, and explicit uncertainty. Keep roasting advice as Mallard Studio context rather than the umbrella identity.

## P2 findings

### 7. Workspace initialization can fail invisibly while chat remains usable

**Evidence:** `src/lib/stores/workspaceStore.svelte.ts:88-150`, `src/lib/components/chat/ChatWorkspace.svelte:524-527`.

Workspace load/create/switch errors stay in the store and are not rendered. With no workspace ID, sending remains enabled while autosave exits early.

**Consequence:** A user can build a long apparently normal thread that vanishes on navigation.

**Correction:** Gate sending on workspace readiness and expose a retryable initialization error.

### 8. Modal and overlay focus behavior is incomplete

**Evidence:** `src/lib/components/chat/ChatDrawer.svelte:25-40`, `src/lib/components/chat/CanvasMobileOverlay.svelte:20-44`, `src/lib/components/canvas/CanvasBlockDetail.svelte:36-52`.

Drawer and mobile canvas lack modal semantics, initial focus, focus trapping, inert background behavior, and reliable focus return. The detail dialog has partial semantics but is not programmatically focused.

**Correction:** Move these surfaces onto the shared overlay/dialog primitive and test keyboard traversal, Escape, and focus return.

### 9. Streaming, status, and failures are largely silent to assistive technology

**Evidence:** `src/lib/components/chat/ChatMessageList.svelte:147-148`, `src/lib/components/genui/InlineStatusLine.svelte:20-45`, `src/lib/components/chat/ChatComposer.svelte:60-89`.

**Correction:** Use a named `role="log"` with controlled live behavior, `role="status"` for summarized generation state, and `role="alert"` for failures without announcing every streamed token.

### 10. The workbench height conflicts with the authenticated app shell

**Evidence:** `src/routes/+layout.svelte:166-173`, `src/lib/components/chat/ChatWorkspace.svelte:973-976`.

The shell adds navigation/padding while the nested workbench claims `h-screen`, producing outer and inner scrolling and mobile keyboard instability.

**Correction:** Give `/chat` a dedicated remaining-height shell slot using `100dvh` and `min-h-0`; validate mobile dynamic viewport and desktop navigation states.

### 11. Advanced implementation controls crowd the primary workflow

**Evidence:** `src/lib/components/chat/ChatToolbar.svelte:28-70`, `src/lib/components/chat/ChatComposer.svelte:121-147`, `src/lib/components/canvas/Canvas.svelte:77-144`.

Memory, workspace memory, context switches, canvas counts, four layout icons, export, clear, and destructive actions appear before a new user understands the sourcing workflow.

**Correction:** Keep current-view grounding visible, move memory/export/clear to a labeled overflow or workspace settings surface, and reveal layout controls only in canvas review mode. Make destructive scopes explicit.

### 12. Copy and visual semantics leak generic and legacy identity

**Evidence:** `src/lib/components/chat/ChatWorkspace.svelte:930-952`, `src/lib/components/canvas/Canvas.svelte:166`, `src/lib/components/canvas/Canvas.svelte:234-238`, `src/lib/components/chat/ChatMessageList.svelte:153`, `src/lib/components/chat/ChatDrawer.svelte:43`.

Exports use “Coffee Chat,” the empty canvas refers to “AI blocks,” naming alternates between Parchment Intelligence Chat and Ask Parchment, and selected canvas state uses hard-coded indigo outside the current warm brand tokens. Uppercase/wide-tracked micro-labels and stroke-2 icons also drift from the July 2026 brand rules.

**Correction:** Establish one hierarchy: Parchment Intelligence is the product, Ask Parchment is the action, and the canvas is the evidence/research workspace. Rename exports and empty states, use role-based brand tokens, sentence-case micro-labels, and the standard 1.5-stroke icon treatment.

## Recommended correction sequence

### PR 1: Trust and data safety

- post-clear persistence bookkeeping and failure handling
- durable/idempotent action execution
- page-context contract on every opted-in request

This slice should ship first. It addresses silent loss, duplicate writes, and misleading context grounding.

### PR 2: Agent control and resilient session startup

- stop/retry and prompt recovery
- workspace readiness gate and initialization retry
- differentiated error states

### PR 3: Mobile evidence and accessibility

- inline mobile GenUI with canvas as optional review mode
- shared overlay/dialog focus behavior
- live-log/status/alert semantics
- shell-height contract

### PR 4: Product and brand coherence

- supply-chain-intelligence system identity and onboarding
- context-aware capability framing and provenance cues
- progressive disclosure for workbench controls
- naming, exports, tokens, micro-labels, and icon-weight alignment

## Validation limits

This was a source-level red-team against current `origin/main`. Browser validation was attempted but blocked by the host browser profile failing to start Chromium as root without `--no-sandbox`; changing OpenClaw browser configuration was outside this audit's approval boundary. The audit reviewers' targeted test command was also blocked in the detached worktree because dependencies were not installed. Findings above are grounded in traced code paths; responsive visual polish should receive a rendered follow-up during implementation.
