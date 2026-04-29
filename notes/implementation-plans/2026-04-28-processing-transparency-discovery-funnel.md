# Processing Transparency Discovery Funnel, Apr 28 Revalidation

**Date:** 2026-04-28
**Selected backlog target:** Priority 0, Public Catalog Access + Conversion Funnel
**Recommended shape:** Two-PR implementation program
**Recommended first PR:** PR 01, public catalog process-transparency facets and CoffeeCard analysis

## Feature or program

Turn the shipped processing transparency API contract into visible buyer and agent discovery value:

1. **PR 01, coffee-app:** expose structured process transparency on `/catalog` through URL-backed filters, compact advanced controls, and CoffeeCard process analysis.
2. **PR 02, purveyors-cli:** add structured process filters and raw process metadata parity to `purvey catalog search` for terminal and agent consumers.

This keeps one implementation target in focus: process transparency as a discovery and conversion funnel. It does not broaden into scraper extraction, supplier verification, paid entitlement changes, or new scoring models.

## Why now

- PR #289 shipped the schema/API layer for structured processing metadata and ADR-004 accepted the contract.
- Post-merge fixes on main tightened the backend filter contract, but the public catalog and CLI still do not expose the value clearly.
- Apr 28 checks show `CoffeeCard.svelte` still renders only the legacy `coffee.processing` label, `/catalog` still exposes only country/process/name controls, and CLI recent commits are docs/test cleanup rather than catalog process-filter parity.
- Recent blog strategy is converging on disclosure quality, schema-as-market, and agent-readable coffee data. This is the smallest product slice that makes those claims legible in the product.

## Strategy Alignment Audit

- **Canonical direction:** Strong alignment with `notes/PRODUCT_VISION.md`. The work strengthens the normalized coffee data moat, makes public product value visible before the paywall, and improves consistency across web, API, CLI, and agent surfaces.
- **Product principle supported:** Truthful coffee data beats marketing copy. The UI should show base method, fermentation type, additives, disclosure level, and confidence only when present, without converting absence into fake certainty.
- **Cross-surface effect:** `/v1/catalog` is already the canonical machine contract. PR 01 makes it useful on the public web surface; PR 02 brings the same contract to the CLI and agent path.
- **Public value legibility:** Strong. A visitor can see why Purveyors is more than a listing grid: it compares coffee process detail and disclosure quality, not just supplier copy.
- **Scope check:** Excludes raw evidence exposure, scraper extraction upgrades, supplier claim/verified badges, transparency scores, AI ranking, pricing changes, and paid entitlement work.

## Scope in / out

### In scope

- Add URL/state support for `processing_base_method`, `fermentation_type`, `process_additive`, `processing_disclosure_level`, and `processing_confidence_min`.
- Add compact advanced process filters on `/catalog` while preserving the existing simple country/process/name flow.
- Send canonical `/v1/catalog` query param names from the public catalog.
- Render structured process detail on CoffeeCard as plain-language analysis when `coffee.process` exists.
- Preserve legacy `processing` behavior and clean output when structured metadata is absent.
- Add focused tests for URL-state parsing/serialization, filter store plumbing, route query behavior, and CoffeeCard conditional rendering where practical.
- Add CLI option and output parity in PR 02 after or alongside PR 01.

### Out of scope

- No database migration.
- No scraper changes.
- No raw `processing_evidence` publication.
- No supplier verification workflow.
- No new entitlement gates.
- No AI search or ranking changes.
- No DEVLOG edits.

## Proposed UX or behavior

The public catalog should let users ask process-specific questions without knowing schema names. Keep the primary controls simple, then add an advanced process group with:

- base method
- fermentation type
- additives present or additive type
- disclosure level
- minimum confidence presets such as `0.6+`, `0.8+`, and `0.9+`

Coffee cards should keep the familiar processing line, then add a short process-analysis block when structured data exists. Use buyer-readable language such as high-detail disclosure or strong supplier evidence rather than leading with decimal confidence. If structured fields are absent, show the legacy process label only and avoid alarming placeholders.

The CLI should stay raw and machine-friendly. It should expose canonical filter names through ergonomic options and preserve nested process metadata in JSON output when the API returns it. It should not include web-style copy or opinionated transparency ranking.

## Files or systems likely to change

### coffee-app, PR 01

- `src/lib/catalog/urlState.ts`
- `src/lib/stores/filterStore.ts`
- `src/routes/catalog/+page.svelte`
- `src/lib/components/CoffeeCard.svelte`
- `src/routes/catalog/page.server.test.ts`
- URL-state and filter-store tests near the existing catalog test surface

### purveyors-cli, PR 02

- Catalog search command option definitions
- Catalog API request-param construction
- Output serializers/types if nested process metadata is currently dropped
- Help, manifest, or docs contract fixtures
- CLI tests for option parsing, request params, and output stability

## API or data impact

- No new schema or breaking API change.
- PR 01 consumes the existing `/v1/catalog` process fields and filters.
- PR 02 maps CLI options to canonical API params rather than inventing CLI-only query names.
- Raw processing evidence stays unexposed by default, consistent with ADR-004.

## Mergeable-slice gate

- **PR 01 is independently mergeable.** It uses the already-shipped `/v1/catalog` process contract and improves public catalog discovery even if CLI parity never lands.
- **PR 02 is independently mergeable after or alongside PR 01.** It depends on the existing API contract, not on web UI changes.

## Candidate scoring summary

Selected candidate: **Processing Transparency Discovery Funnel**

- Priority score: 10, anchored to P0 Public Catalog Access + Conversion Funnel
- Complexity score: 6, medium because it spans URL state, filters, and card presentation but no schema work
- Risk penalty: 0, low because backend fields are additive and already merged
- Dependency penalty: 0, no blocker after PR #289 and follow-up backend fixes
- Strategic leverage bonus: 4, strong data-moat and cross-surface leverage
- Total: 20

Rejected near-term alternatives:

- **API key limits per tier:** viable easy win, but lower public proof value and weaker current strategy alignment.
- **Bean delete dependency handling:** DEVLOG appears stale; main already contains PR #133 and related delete fixes.
- **Mobile bottom bar refinement:** useful, but a UX polish slice rather than data-moat leverage.
- **Catalog/Core Web Vitals performance:** valuable, but needs measurement-first scoping before a clean implementation PR.

## Acceptance criteria

### Program-level

- Buyers and machine consumers can query structured process transparency through clear product surfaces.
- Existing public catalog access, anonymous preview behavior, pagination, legacy processing filters, and shareable URLs remain compatible.
- Missing process metadata never renders as explicit `none` or fake low confidence.
- Web copy remains explanatory; CLI and API outputs remain raw and machine-readable.

### PR 01

- New process filters parse from the URL on initial load.
- New process filters serialize back into shareable URLs.
- Catalog requests use canonical `/v1/catalog` query params.
- Filter controls can be set, combined, cleared, and used with existing country/source/process/name filters.
- CoffeeCard renders structured process analysis only when data exists.
- Anonymous catalog preview and signup CTA continue to work.
- Focused tests cover URL-state, store/query plumbing, and present/absent process metadata behavior.

### PR 02

- `purvey catalog search` accepts structured process filter options.
- Generated API requests use canonical query param names.
- JSON output preserves process metadata when returned.
- Human output stays readable without overstating missing metadata.
- Help/manifest/docs surfaces list the new options.
- Legacy `--process` behavior remains compatible.

## Test plan

### PR 01

- `pnpm check --fail-on-warnings`
- Focused URL-state parse/serialize tests for all new params.
- Catalog route or server tests proving canonical params are preserved.
- Filter-store tests proving process filters survive set, clear, and share-link flows.
- Component or manual browser smoke for `/catalog?fermentation_type=Anaerobic&processing_disclosure_level=high_detail`.

### PR 02

- Run the CLI repo's unit/contract test suite.
- Add focused tests for option parsing and canonical request-param generation.
- Update help/manifest snapshots if those contracts exist.
- Mock or dry-run API behavior so CI does not require live credentials.

## Risks and rollback

- **Risk:** Filter UI gets too dense. Mitigation: hide structured controls in a compact advanced process section.
- **Risk:** Confidence looks more precise than the data warrants. Mitigation: use plain-language web labels and reserve decimals for API/CLI data.
- **Risk:** Sparse data makes the feature feel empty. Mitigation: render opportunistically and keep legacy process display as the fallback.
- **Risk:** CLI option names drift from API params. Mitigation: test canonical request-param output explicitly.
- **Rollback:** PR 01 and PR 02 can each be reverted independently because they do not alter schema or persisted data.

## Open questions for Reed

1. Should PR 01 make advanced process filters visible by default, or tuck them behind an "Advanced process" disclosure for a cleaner public catalog first impression?
2. For web copy, should confidence be expressed as labels only, or should a small numeric confidence appear in a tooltip for power users?
3. Should PR 02 ship immediately after PR 01, or should the next coding run implement only PR 01 and wait for feedback before CLI parity?
