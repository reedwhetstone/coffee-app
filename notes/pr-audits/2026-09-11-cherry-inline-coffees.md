# Cherry inline coffee answers: slice 2 validation

## Revised outcome and boundary

Scope revised with Reed on September 11: active turns show compact progress without intermediary coffee cards. A normally completed answer shows only grounded `present_results` selections, using canonical cards and exact detail inspection independently of the canvas. Raw search/rank output does not become automatic answer cards. No new search-exploration disclosure is included.

Stop and transport errors retain completed validated coffee evidence under an incomplete-answer label, including raw reads when no selection completed. The recovery implementation is unchanged by this revision: unfinished tools and proposals are omitted, request projection does not rewrite persisted history, interrupted messages persist no canvas mutations, and retry appends fresh IDs. Access failures retain the previous rollback. Navigation/unload saves only the finalized prefix, not the active attempt.

This revises slice 2 of [the overhaul plan](../implementation-plans/2026-09-11-cherry-agent-overhaul.md), after merged [coffee-app #606](https://github.com/reedwhetstone/coffee-app/pull/606) and [parchment-api #300](https://github.com/reedwhetstone/parchment-api/pull/300). Grounded references are next; the integrated shell and other result families remain later slices.

## Current-head validation

- `VALIDATION_PASS`: `pnpm lint`.
- `VALIDATION_PASS`: `pnpm check --fail-on-warnings` (zero errors/warnings).
- `VALIDATION_PASS`: `pnpm exec vitest run src/lib/components/chat src/lib/components/genui src/lib/components/CoffeeCard.svelte.test.ts src/lib/services/inlineCoffeeResults.test.ts src/lib/services/chatPersistence.test.ts src/lib/services/blockExtractor.test.ts src/lib/stores/canvasStore.svelte.test.ts src/routes/api/chat` (158 tests, 22 files).
- `VALIDATION_PASS`: installed Chat transport with controlled completion barrier: raw and curated tool output produces progress but no cards while active; only the curated selection appears after completion.
- `VALIDATION_PASS`: actual ChatWorkspace save/reload for curated final cards; stop/error recovery, retry identity, unchanged saved history, and active-unload exclusion. Missing, future, failed, and malformed references cannot produce curated cards. Later raw reads do not replace a selection.
- `VALIDATION_PASS`: isolated local system-Chrome checks at 1440×1000 and 390×844 using actual ChatMessageList and canonical detail components with synthetic props. Verified active card suppression, curated final cards, exact detail opening/return, and labeled interrupted results. The mounted browser fixture does not claim transport or persistence proof; those are covered by the tests above.
- `VALIDATION_PASS`: `git diff --check` and relative document links.

The original implementation received independent verify-pr review; its cross-source deduplication fix and regression coverage remain. This focused revision changes only card selection/display and supporting tests/docs; recovery and persistence code are unchanged. No fresh independent reviewer verdict is claimed.

Checks used Node 24.19.0/pnpm 10.33.0 (repo requests Node 22.x), synthetic static environment placeholders, and no production model calls or private fixtures. Authenticated production timing and real drawer-to-page navigation remain unverified.

## Inherited invariants

- Continuous activity and thin-BFF streaming proof remain intact.
- Shelf pinning, action state, companion-block mapping, and interrupted canvas-mutation suppression remain covered.
- Earlier messages retain their IDs; retry appends rather than rewriting saved answers.
- Final curated cards and interrupted evidence remain usable without a canvas target. Legacy raw-only completed messages retain prose/activity and existing canvas behavior, not automatic inline raw cards.

## Revised screenshots

Synthetic records in the actual message renderer; the small control strip is test-only, not product UI. Temporary harness and driver are not shipped.

- [Desktop working](assets/cherry-inline-coffees/desktop-working.png) / [mobile working](assets/cherry-inline-coffees/mobile-working.png)
- [Desktop curated answer](assets/cherry-inline-coffees/desktop.png) / [mobile curated answer](assets/cherry-inline-coffees/mobile.png)
- [Desktop detail](assets/cherry-inline-coffees/desktop-detail.png) / [mobile detail](assets/cherry-inline-coffees/mobile-detail.png)
- [Desktop stopped answer](assets/cherry-inline-coffees/desktop-stopped.png) / [mobile stopped answer](assets/cherry-inline-coffees/mobile-stopped.png)
