# Cherry AI: connected conversation and evidence workspace

**Date:** 2026-09-11
**Status:** Accepted scope via [PR #605](https://github.com/reedwhetstone/coffee-app/pull/605); slice 1 merged; slice 2 implemented for review
**Owner:** coffee-app for human experience; Parchment for shared runtime and durable contracts

## Goal and accepted direction

Make Cherry AI a first-class way to use Purveyors: an answer should contain enough connected evidence to make a decision, and expanding that evidence should continue the same task rather than open a disconnected artifact browser.

This plan owns the human-experience overhaul and its delivery sequence. It does not design a new agent framework, change the deployed model, or define a new shared persistence protocol.

Governing direction:

- [Product vision](../PRODUCT_VISION.md): intelligence replaces navigation; Cherry AI is grounded in product context.
- [Brand](../BRAND.md) and [UI framework](../UI-FRAMEWORK.md): calm operational UI, warm surfaces, consistent typography, restrained accents, no agent persona.
- [ADR-009](../decisions/009-progressive-depth-task-parity.md): complete decision paths on mobile and desktop.
- [ADR-013](../decisions/013-active-scene-evidence-shelf.md): one active scene, retained evidence, protected pins, and persistent action state.
- [Thin-BFF cutover](2026-08-29-complete-sdk-thin-bff-cutover.md) and [current architecture](../ARCHITECTURE.md): Parchment owns orchestration, authorization, and durable application state; coffee-app owns presentation and session brokerage.

The July [conversation-first redesign](2026-07-13-chat-conversation-first-redesign.md) and [scene implementation](2026-07-14-active-scene-evidence-shelf.md) remain historical delivery records. This plan extends their useful focus and continuity guarantees, but deliberately replaces the implemented rule that chat only shows compact links to full canvas evidence. It does not restore multiple floating windows or automatically resize the conversation whenever a tool finishes.

## Delivery status

Slice 1 merged in [coffee-app #606](https://github.com/reedwhetstone/coffee-app/pull/606) and [parchment-api #300](https://github.com/reedwhetstone/parchment-api/pull/300). It implements continuous client activity through the pending, empty-assistant, tool-input, and answer-text phases, including `present_results` preparation. It removes unused reconstructed activity timestamps and uses neutral progress copy rather than implying a private research plan. Stop and both protocol/transport errors clear the live indicator.

Controlled tests exercise the real Svelte Chat transport and status component, BFF stream relay, and Parchment runtime/HTTP/SDK delivery. They withhold terminal frames until the consumer observes early output; runtime coverage includes a real multi-step tool round-trip. The implementation does not change model orchestration, credentials, persistence, action execution, or whole-turn evidence-preview gates.

A local Chrome harness passed empty-assistant activity, tool preparation before completion, and Stop at desktop and 390px mobile widths. [Desktop fixture](../pr-audits/assets/cherry-live-activity/desktop.png) and [mobile fixture](../pr-audits/assets/cherry-live-activity/mobile.png) show the actual message/status components; Send/Stop/status text above them is test-only harness chrome, not a product redesign. The temporary preview route is not shipped.

Authenticated deployed-network timing remains unverified. This slice proves and repairs local activity behavior, not the reported production regression's root cause. Slice 2 now implements bounded inline coffee results using the canonical card and detail sheet. Completed reads appear before final prose, completed curation replaces equivalent raw views, and inspection remains stable while that view changes. Historical coffee evidence stays usable without a shelf target.

Stopped and failed coffee answers retain validated completed reads and a persisted interruption label. Incomplete tools and proposals are removed; retained interrupted answers do not replay canvas mutations. Finalized messages keep their original IDs, while retry appends a new attempt. The existing Parchment opaque message-parts contract carries the label; no shared schema, SDK release, or new store is needed. Active navigation/unload saves only finalized earlier messages, not the mutable attempt; this slice does not promise crash recovery for an unfinished turn.

[Slice 2 validation and screenshots](../pr-audits/2026-09-11-cherry-inline-coffees.md) cover actual ChatWorkspace stop/error/retry/reload behavior, progressive streaming, shared cards, and inherited canvas/action safeguards. Slices 3 through 5 remain unimplemented. The next slice is grounded references and cross-platform continuity, with missing shared contracts owned by Parchment.

## Planning baseline and limits

Source inspected at coffee-app `0805a495b886174cdd02f54cdbd46aaf2be5988f` and Parchment `2f9f6457c472f5055a97b10f369e50758ae1c5e3` on September 11. These are historical planning-baseline observations, not proof of deployed revisions. Delivery status above records which limitations the implementation slices change.

1. [ChatMessageList](../../src/lib/components/chat/ChatMessageList.svelte) renders assistant text separately from tool-derived results. All inline result previews are behind `!isStreaming`, so a completed search remains invisible while the rest of the turn runs.
2. [GenUIBlockRenderer](../../src/lib/components/genui/GenUIBlockRenderer.svelte) explicitly restricts chat to compact canvas links. It disables non-error previews without a canvas target. [CoffeeCardPreview](../../src/lib/components/genui/previews/CoffeeCardPreview.svelte) shows one name/origin or a count, not a useful comparison.
3. [ChatWorkspace](../../src/lib/components/chat/ChatWorkspace.svelte) skips canvas dispatch while `isActive`. It defaults the evidence pane closed, uses a 60/40 split when opened, and routes mobile/drawer evidence to an overlay.
4. [Canvas](../../src/lib/components/canvas/Canvas.svelte) and [CanvasLayout](../../src/lib/components/canvas/CanvasLayout.svelte) already implement the active scene and horizontal shelf. Inactive action cards remain mounted to preserve edits and in-flight state. [CoffeeCardsBlock](../../src/lib/components/genui/blocks/CoffeeCardsBlock.svelte) already reuses the platform CoffeeCard; do not replace that reuse with a separate coffee design system.
5. Activity is derived from tool parts. The initial indicator is limited to submitted requests whose last message is a user message; an active assistant message without tool activity can lack a visible working indicator. The renderer does not provide a reasoning-part view. Provider reasoning, tool activity, and completed evidence are different signals, not interchangeable definitions of “thinking.”
6. The BFF returns the SDK's upstream Response, and the SDK uses streaming fetch. Source inspection found no body buffering there. The preview gates and initial-status limitation existed before the runtime cutover. The reported regression remains real user evidence, but attributing it to the thin BFF is not yet supported.
7. [Page context](../../src/lib/stores/pageContextStore.svelte.ts) already carries typed coffee, inventory, roast, and supplier references. [ChatDrawer](../../src/lib/components/chat/ChatDrawer.svelte) already keeps the conversation mounted after first opening. Extend these existing paths rather than starting a second copilot subsystem.
8. [Parchment runtime](https://github.com/reedwhetstone/parchment-api/blob/2f9f6457c472f5055a97b10f369e50758ae1c5e3/packages/api/src/chat/runtime.ts#L928) awaits context enrichment before constructing the stream. This is a possible pre-stream latency source, not a measured bottleneck. Tool activity timestamps in the UI are reconstructed with `new Date()`, so they are not timing evidence. `present_results` also omits input-phase activity.
9. [Chat recovery](../../src/lib/components/chat/chatRecovery.ts) rolls a failed attempt back to the pre-submission message count. Preserving completed partial evidence after an error is a behavior change requiring explicit recovery and persistence tests, not something achieved simply by showing previews sooner.

The live browser could reach Purveyors but `/chat` resolved to the signed-out catalog. No authenticated production turn, paid model call, private conversation capture, or before/after timing measurement was performed. Authenticated visual and streaming verification remains a delivery gate, not a claimed pass.

## Target experience

### 1. Answers are useful without opening the workspace

A sourcing answer contains a concise recommendation, the named coffees behind it, a compact comparison of decision-relevant facts, and sources next to the claims they support. Price units, quantity tiers, availability, and observation dates remain visible where supplied. Unknown data is shown as unknown, not filled by the model.

Use three coordinated representations of the same evidence:

- **Reference:** a named coffee, roast, inventory item, or supported analytical scope in prose. Activate by keyboard, click, or tap to inspect its identity and relevant facts. Hover is optional enhancement, never the only path.
- **Inline result:** a compact shortlist, comparison, chart, or action summary that answers the question in the transcript. Bound its initial size and expand deliberately; do not render every raw tool response as a dashboard.
- **Expanded evidence:** the deeper scene for comparison, chart exploration, detail inspection, and supported actions. Preserve the originating answer and selected item when opening and returning.

Clearing an unpinned workspace item must not erase the usefulness of a past answer. Separate transcript evidence readability from whether an item is currently on the shelf. Historical observations must remain distinguishable from refreshed current data; expired access or deleted records get explicit unavailable states. Do not imply indefinite retention beyond Parchment's existing retention and deletion rules.

### 2. GenUI is composed from Purveyors capabilities

The agent selects and arranges supported, typed product components for the task. It does not generate arbitrary executable HTML or invent routes. Coffee identity, comparisons, chart formatting, trust labels, and actions reuse canonical platform components and data semantics.

Begin with the current rendered families: coffees, inventory, roast profiles/charts, tasting, tables, and action proposals. This is a starting inventory, not an exhaustive contract. Verify actual tool outputs, stable identities, sources, and existing routes before specifying additional families.

References must resolve against authorized tool/page evidence, not guessed names or IDs. Parchment owns any new shared reference or presentation contract; coffee-app resolves supported references to existing app interactions. Do not turn fuzzy catalog similarity into canonical identity. Preserve plain-text and legacy-message fallbacks.

### 3. The workspace continues the conversation

Keep one active scene and retained evidence. Improve selection, context, and space usage before introducing more containers:

- Open the exact referenced coffee, comparison, chart, or action, with a clear path back to its answer.
- Give a comparison a comparison view; do not require swiping through individual coffee cards to understand a shortlist.
- Keep pinning, removal, source navigation, and expansion in one consistent control area. Shelf labels describe the task/evidence, not raw tool names.
- Support focused expansion on desktop and a full-height detail sheet on mobile. Preserve transcript position, focus return, and selected evidence.
- Do not change the user's active scene or overwrite edited action fields as unrelated results arrive. Preserve pin protections and the existing execution ledger.
- Treat shelf search/grouping as evidence-driven follow-up if long-conversation testing demonstrates a need, not prerequisite infrastructure.

### 4. Live activity is truthful and continuous

Show an immediate pending state, actual tool progress as received, completed useful evidence before the whole turn ends, and a distinct final/error/stopped state. Keep activity compact with optional detail. Expose supported user-facing reasoning summaries only when actually provided; do not fabricate private reasoning or theatrical progress messages.

Do not just delete the current completion guards. Incremental rendering must respect causal tool order, `present_results` selection, stable result identity, deduplication, cancellation, and persistence. A partially streamed argument is not a completed result or executable proposal.

### 5. One cohesive product shell

Use the existing app navigation, fonts, surfaces, borders, and role naming. Keep one compact identity/context header, an adaptable reading column, and one anchored composer. Let comparisons use extra width without stretching every paragraph. Reduce duplicate drawer/workspace headers and scattered evidence controls.

Show selected coffees and page scope as removable, inspectable composer context. Carry selected identity and filters from catalog/Market Index/roast surfaces through a follow-up and back to the source page. Preserve context opt-in and entitlements. Do not promise actions that the active agent role cannot perform.

## Representative acceptance journeys

1. **Source coffee:** enter from a filtered catalog with a selected lot; compare three eligible alternatives; understand the tradeoff and price basis inline; open one exact lot; return to the same answer and selection.
2. **Explain market movement:** enter from a scoped Market Index view; inspect an inline trend and its period/sample/source caveats; open the same supported analytical scope without losing filters. No invented per-lot provenance for aggregate data.
3. **Apply roastery context:** compare an owned coffee and roast evidence; inspect a proposed supported change; confirm explicitly; reopen the conversation and see its canonical execution outcome without duplicate writes.
4. **Long conversation:** remove unpinned shelf evidence, keep a pin, reload, and revisit an old answer. Retained transcript evidence remains meaningful without depending on the removed shelf entry.
5. **Interrupted turn:** stop after a search completes but before final prose. Completed read evidence remains usable; incomplete proposals cannot execute; retry does not duplicate artifacts or actions.

Run each applicable path on desktop, 390px mobile, keyboard-only navigation, and the drawer-to-full-workspace transition. Include Green-only, Roast-only, combined, and lost-access states.

## Delivery sequence

### Slice 1: Restore observable work and establish timing evidence

**Repos:** coffee-app; Parchment only where runtime/stream proof or defects require changes.

Add controlled delayed-stream tests with an early tool event, a deliberately blocked final response, and assertions that the early event is rendered before release. Cover the empty-assistant interval, slow tools, `present_results` input, no-tool responses, errors, and abort. Exercise the runtime, SDK/BFF relay, and actual browser Chat transport rather than only mocking rendered props. Existing tests that consume a prebuilt Response with `.text()` are not incremental-delivery proof.

Fix the continuous activity indicator locally and any reproduced upstream transport defect at its owner. Separately capture authenticated direct-upstream versus same-origin/browser timings before claiming a production buffering fix. Record request acceptance, first frame, first activity, first useful result, first answer text, and completion without logging private payloads.

**Acceptance:** no blank active interval in deterministic tests; early activity arrives while final output remains blocked; stop clears active status. This slice is independently useful and does not depend on a new evidence schema or full visual redesign.

### Slice 2: Ship useful inline coffee answers

**Repo:** coffee-app; depends on slice 1's incremental harness, not a new model.

Replace coffee count links with a bounded, shared-component shortlist/comparison and exact coffee inspection. Render completed read evidence progressively in causal order, retaining explicit expansion into the active scene. Keep old messages readable when their shelf target is absent. Use existing authorized tool output first; do not create a parallel durable store.

**Acceptance:** sourcing journey passes; no whole-turn wait for completed evidence; `present_results` does not cause duplicate or contradictory cards; removed shelf entries do not disable the answer's retained read evidence; reload and stop/retry preserve identity. Test partial completion followed by both abort and transport failure against the current whole-attempt rollback, including persistence and explicit stopped/error labeling. If current persisted output cannot support this, the missing upstream contract becomes an explicit dependency before consumer implementation.

### Slice 3: Add grounded references and cross-platform continuity

**Repos:** Parchment contract first if required, then SDK and coffee-app consumer.

Inventory current tool evidence and route capabilities, then review only the missing shared contract. Define typed references to actual returned evidence and source observations, including unresolved/stale behavior and backward-compatible persistence. Exact schemas and lifecycle changes belong in Parchment, not this UI plan. Use existing page context and canonical detail components for navigation and composer selection.

**Acceptance:** prose references resolve to the intended authorized object; forged/missing IDs cannot expose records; old messages remain readable; reload and drawer/full-page transitions preserve references; refreshed values do not silently rewrite historical claims. Publish/deploy any required SDK/API addition before enabling its consumer.

### Slice 4: Integrate the shell and evidence workspace

**Repo:** coffee-app; depends on the inline/reference interaction shapes from slices 2 and 3.

Deliver the header, transcript hierarchy, composer context, focused expansion, shelf controls, and mobile sheet as one coherent UX slice. Use a deterministic populated harness for design review, not empty-state screenshots alone. Include shortlist, long answer, chart, edited proposal, error, and long-history states.

**Acceptance:** all representative navigation paths pass; no unintended auto-open/scene replacement; pins, edited proposals, in-flight execution, scroll restoration, and focus return survive switching and reload. Attach desktop/mobile screenshots and interaction evidence to the implementation PR. No runtime ownership moves into the BFF.

### Slice 5: Extend the verified pattern to analytical and operational answers

**Repos:** coffee-app plus only the Parchment contracts found missing in the family inventory.

Apply the same reference/inline/expanded representations to supported market, inventory, roast, tasting, and action flows. Reuse shared chart semantics and canonical mutation outcomes. Keep one executable proposal identity across appearances; secondary appearances reflect its state rather than creating independent execution forms.

**Acceptance:** market and roastery journeys pass with source/trust parity, accessible small-screen forms, owner/entitlement negatives, and existing action-ledger regression coverage. This completes the overhaul's initial scope; arbitrary page generation, multi-window canvases, new tools without callers, model research, and generalized dashboard builders are excluded.

## Validation, rollout, and retirement

- UI/code slices run `pnpm lint`, `pnpm check --fail-on-warnings`, focused component/stream tests, and relevant end-to-end journeys. Use `verify-pr` for shared authorization, persistence/concurrency, or action-execution changes as required by workspace policy. A docs-only plan does not claim these runtime checks.
- Measure time to first useful evidence separately from final answer latency. Deterministic tests must observe early events before the final-frame barrier is released; production targets are set from the authenticated baseline, not invented here.
- Roll out compatible upstream contracts before consumers. Each UI slice must remain usable if later slices never ship. Do not combine this overhaul with a destructive schema migration or remove legacy replay support on first release.
- Roll back presentation independently while retaining readable persisted messages and canonical action outcomes. New contract writers require a compatible old-reader path or an explicitly reviewed migration before activation.
- Retire compact-link-only rendering and whole-turn read-result gates only after progressive rendering, legacy restoration, and accessibility checks pass. Preserve the shelf, pin safeguards, canonical action ledger, and thin-BFF boundary. Remove any temporary fallback only after supported historical messages and deployed consumers are inventoried.

Priority remains in [DEVLOG](../DEVLOG.md). This sequence orders work inside the overhaul, not unrelated Purveyors programs.
