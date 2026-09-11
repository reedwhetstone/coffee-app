# Cherry inline coffee answers: slice 2 validation

## Outcome and boundary

Completed coffee search/rank results are usable directly in an answer before final completion. Canonical cards show three results initially, expand explicitly, and open the exact returned coffee in the shared detail sheet. Pending curation cannot hide results; completed curation replaces its source and any already-equivalent shortlist. An open detail snapshot survives curation and returns focus to the answer.

Stop and transport errors retain completed validated coffee evidence with an incomplete-answer label. Unfinished tools and proposals are omitted from the retained attempt. Request-only projection removes local status parts and unfinished calls without rewriting persisted history. Interrupted messages persist no canvas mutations. Access failures retain the prior rollback behavior. Unload/navigation saves only the finalized prefix; active-attempt crash recovery is not implemented.

This extends [the accepted overhaul plan](../implementation-plans/2026-09-11-cherry-agent-overhaul.md), after merged [coffee-app #606](https://github.com/reedwhetstone/coffee-app/pull/606) and [parchment-api #300](https://github.com/reedwhetstone/parchment-api/pull/300). Grounded prose references, other result families, and the shell redesign remain later slices.

## Validation

- `VALIDATION_PASS`: `pnpm check --fail-on-warnings` (zero errors/warnings).
- `VALIDATION_PASS`: `pnpm lint`.
- `VALIDATION_PASS`: `pnpm exec vitest run src/lib/components/chat src/lib/components/genui src/lib/components/CoffeeCard.svelte.test.ts src/lib/services/inlineCoffeeResults.test.ts src/lib/services/chatPersistence.test.ts src/lib/services/blockExtractor.test.ts src/lib/stores/canvasStore.svelte.test.ts src/routes/api/chat` (155 tests in 22 files).
- `VALIDATION_PASS`: local system-Chrome browser interaction at 1440×1000 and 390×844, mounting the actual ChatWorkspace with a controlled UI-message stream and synthetic catalog fixtures. Completed results precede final output; bounded results and exact detail work; curation leaves the inspected coffee open; closing reveals the curated result; stopping retains it and clears active status.
- `VALIDATION_PASS`: focused independent verify-pr review of the committed implementation. One P2 found cross-source curation could resurrect a deduplicated raw list. Fixed in the selector with regression coverage for equivalent lists, curation, and a subsequent distinct read. No P0/P1 findings.
- `VALIDATION_PASS`: `git diff --check` and changed-document relative links.

Checks ran under the available Node 24.19.0/pnpm 10.33.0; the repository requests Node 22.x. Static environment values were synthetic placeholders. No production model call, private catalog capture, credential, or authenticated deployment measurement was used. Production timing and the real authenticated drawer-to-page navigation remain unverified; local mounted-workspace, identity, drawer, and persistence tests are not claimed as deployed end-to-end proof.

## Inherited invariants

- **Live activity / thin BFF:** installed Chat transport, empty phases, early frames, stop/error and BFF relay tests pass. No runtime/model/authorization ownership change.
- **Evidence and action shelf:** pin preservation, action-state persistence, existing canvas dispatch/extractor and execution-route suites pass. Interrupted results cannot replay clear/replace or expose retained unfinished proposals for execution.
- **Append-only persistence:** actual ChatWorkspace tests cover stop save/reload, failure and retry with new IDs, unchanged earlier payloads, and active-unload exclusion of mutable IDs. Marker remains inside the existing opaque `parts` contract; no database migration.
- **Causal evidence:** missing, malformed, failed and future references cannot become usable coffee results; same-source and equivalent cross-source curation do not duplicate cards.
- **Mobile/keyboard:** canonical detail and catalog destination remain available without a shelf target; component tests check exact selected record, focus return and stable inspection. Browser checks confirm small-screen interaction and readable controls.

## Screenshots

These show synthetic coffee records in the actual workspace, not a new shell design. The temporary local preview route and browser driver are not shipped.

- [Desktop progressive shortlist](assets/cherry-inline-coffees/desktop.png)
- [Mobile progressive shortlist](assets/cherry-inline-coffees/mobile.png)
- [Desktop inspection during curation](assets/cherry-inline-coffees/desktop-detail.png)
- [Mobile inspection during curation](assets/cherry-inline-coffees/mobile-detail.png)
- [Desktop stopped answer](assets/cherry-inline-coffees/desktop-stopped.png)
- [Mobile stopped answer](assets/cherry-inline-coffees/mobile-stopped.png)
