# Grounded coffee references — slice 3a

## Outcome and sequence

Coffee names linked in Cherry prose can open the exact retained coffee record in the canonical detail sheet, without opening a canvas or fetching a new record. The link label uses the returned name, not an unverified model alias. Closing returns keyboard focus to the originating reference.

This follows merged [coffee-app #608](https://github.com/reedwhetstone/coffee-app/pull/608) and implements the coffee portion of [slice 3](../implementation-plans/2026-09-11-cherry-agent-overhaul.md). [Parchment #301](https://github.com/reedwhetstone/parchment-api/pull/301) adds writing guidance for `[returned coffee name](/catalog?coffee=<id>)`. The consumer independently enforces grounding. Both changes use existing Markdown, tool output and storage contracts; no new SDK publication or migration is required. Either can deploy first: the old UI treats these URLs as ordinary catalog links, and the new UI preserves plain names until link-writing behavior arrives.

The next UX slice is the integrated shell/evidence workspace. Non-coffee object references remain work for their family slices, not a hidden promise of this change.

## Evidence and route inventory

- **Search/rank coffee rows:** completed assistant `coffee_catalog_search` and `catalog_rank` output contains full coffee rows; the upstream model projection retains catalog ID/name. Existing `/catalog?coffee=<id>` routing opens that exact lot, including off-page deep-link loading. These are the only promoted prose references in this slice.
- **Presentation:** `present_results` echoes selection IDs and is not independent read evidence. It cannot authorize a reference by itself.
- **Similarity:** matches use `coffee_id`/`coffee_name` with a different target/match shape; explicitly excluded until its projection is defined. Do not confuse matching with canonical identity.
- **Inventory, roast, tasting, tables, actions:** existing block/detail and canvas interactions remain unchanged. No shared arbitrary-reference schema or executable prose form is introduced.
- **Page context:** current typed coffee/inventory/roast/supplier entities are descriptive, opt-in request context. They cannot grant detail evidence or bypass the owning API.

## Lifetime and failure behavior

`coffeeReferencesThroughPart` is a derived view of the already authorized transcript, not a second durable store. It scans only completed valid assistant coffee reads positioned before the specific text part. This is transcript-prefix ordering, not a wall-clock assertion about when prose was generated: an earlier pending tool part becomes eligible when its output completes, consistently on reload. The most recent prior observation of a catalog ID wins. User parts, unfinished/failed/malformed reads, presentation-only IDs and future turns are excluded.

Inspection freezes the selected JSON snapshot. Later reads cannot change an open sheet or an older answer's resolution. A visible detail notice distinguishes retained observations from current price/availability; no retrieval date is invented when the record does not supply one. “View in catalog” is an explicit transition to current catalog data, without rewriting historical prose.

First-party catalog links with absent/invalid evidence render readable names with “details unavailable,” not a clickable guessed record. External and ordinary navigation links remain links; code spans are not reference targets. Active URL schemes are not rendered as Markdown links. Raw HTML renderer behavior is unchanged and is not claimed as a new HTML sanitization boundary.

No intermediary card previews are restored. A reference may be explicitly inspected while its prose streams; no detail or canvas opens automatically. Normal final curated cards and stop/error recovery remain intact. Existing API, workspace authorization, retention/deletion and context opt-in rules are unchanged.

## Validation

- `VALIDATION_PASS`: `pnpm lint`.
- `VALIDATION_PASS`: `pnpm check --fail-on-warnings`.
- `VALIDATION_PASS`: `pnpm exec vitest run src/lib/components/chat src/lib/components/genui src/lib/components/CoffeeCard.svelte.test.ts src/lib/services/coffeeReferences.test.ts src/lib/services/inlineCoffeeResults.test.ts src/lib/services/chatPersistence.test.ts src/lib/services/blockExtractor.test.ts src/lib/stores/canvasStore.svelte.test.ts src/routes/api/chat` (169 tests, 24 files).
- `VALIDATION_PASS`: causal/historical resolution, malformed/forged IDs, user-part exclusion, link origin and scheme boundaries, exact returned labels, no-fetch inspection, Escape/focus return, stable open snapshots, JSON restoration, actual ChatWorkspace drawer-to-saved-page restoration, and inherited activity/recovery/canvas tests.
- `VALIDATION_PASS`: isolated system Chrome, 1440×1000 desktop and 390×844 mobile, mounting actual ChatMessageList and detail components. Keyboard activation, correct catalog destination, explicit second-reference selection, unavailable fallback, Escape/return, reload and no horizontal overflow passed. No raw cards appear without curation.
- `VALIDATION_PASS`: `git diff --check` and changed-document relative links.

Local Node 24.19.0/pnpm 10.33.0 versus requested Node 22.x; synthetic static env and coffee fixtures only. Browser screenshots are a deterministic mounted component harness, not a deployed authenticated session. Live-model link frequency, production timing, real authenticated catalog navigation and current-data access-loss handling remain unverified. The route's existing authorization/deep-link behavior is not changed here.

## Focused review

Read-only consumer review confirmed the grounding, snapshot, Svelte reactivity and no-fetch boundaries. Its timing concern is resolved by documenting and testing transcript-prefix semantics explicitly; no new timing/persistence contract is claimed. Multiple simultaneous canonical detail sheets remain an existing workspace limitation, to be addressed by the integrated-shell slice.

## Screenshots

- [Desktop answer](assets/cherry-references/desktop-answer.png) / [mobile answer](assets/cherry-references/mobile-answer.png)
- [Desktop detail](assets/cherry-references/desktop-detail.png) / [mobile detail](assets/cherry-references/mobile-detail.png)

The temporary local harness is not shipped.
