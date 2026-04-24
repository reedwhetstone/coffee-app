# PR #289 Processing Transparency Verification

**Date:** 2026-04-24
**Repo:** `/root/.openclaw/workspace/worktrees/coffee-app-processing-transparency-plan`
**PR:** https://github.com/reedwhetstone/coffee-app/pull/289
**Base:** `origin/main`
**Head:** `HEAD` / `feat/processing-transparency-schema-api`

## Operator summary

VERDICT: ready_with_fixes
P0: 0
P1: 1
P2: 1
P3: 2
NEXT_ACTION: patch_same_pr
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable_with_followups

## Validation status

- `SUPABASE_SERVICE_ROLE_KEY=dummy PUBLIC_SUPABASE_URL=http://localhost:54321 PUBLIC_SUPABASE_ANON_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy pnpm -s check`: VALIDATION_PASS, parent evidence, svelte-check 0 errors / 0 warnings.
- `vitest run --config .vitest.processing.config.ts src/lib/data/catalog.test.ts src/lib/server/catalogResource.test.ts src/routes/api/catalog/filters/filters.test.ts`: VALIDATION_PASS, parent evidence, 81 tests passed. Temporary config only bypassed stale cross-worktree `@testing-library/svelte` symlink and was not committed.

## Scope assessment

The PR is conceptually the right independently mergeable slice. It adds an ADR, an additive SQL migration, generated Supabase types, data-layer/API filters, a nested `/v1/catalog` `process` summary, filter metadata, and docs. It does not depend on scraper/UI follow-ups to be useful, and it does not require the agent to run production SQL.

The implementation is mostly aligned with `notes/PRODUCT_VISION.md`: it strengthens truthful coffee data, preserves provenance, and exposes machine-readable API fields. It also matches ADR-004's core decisions: legacy `processing` remains, raw `processing_evidence` is withheld from public responses, null metadata remains null, and explicit `none` is treated separately from unknown.

However, one API-route branch silently drops the new filter params for unpaginated dropdown requests. That is a contract bug, not a slice-boundary problem. Patch it in this PR and re-run the route/data-layer tests.

## Findings

### P1: Unpaginated `fields=dropdown` silently ignores the new processing transparency filters

**Evidence**

- `src/lib/server/catalogResource.ts:529-537` handles `fields=dropdown` with no explicit page/limit by calling `getCatalogDropdown(context.supabase, { stockedFilter, publicOnly, showWholesale, wholesaleOnly })` only.
- The same function passes the new filter params only in the paginated dropdown branch at `src/lib/server/catalogResource.ts:570-605` and in the full-row branch at `src/lib/server/catalogResource.ts:646-675`.
- `src/lib/data/catalog.ts:472-484` proves the dropdown data layer can filter by `processingBaseMethod`, `fermentationType`, `processAdditive`, `hasAdditives`, `processingDisclosureLevel`, and `processingConfidenceMin` when options reach it.
- Current tests cover full-row filter passthrough (`src/lib/server/catalogResource.test.ts:519-547`) and paginated dropdown routing, but not unpaginated dropdown plus processing filter params.

**Impact**

A caller can request `/v1/catalog?fields=dropdown&processing_base_method=Natural` and receive all stocked dropdown rows instead of Natural rows, with a 200 response and no warning. That violates the API-contract goal of catalog data-layer filters and is especially risky for agent/API consumers because it looks successful while returning wrong data.

This is partly an inherited route-shape issue, but this PR adds and documents new filter params, so it should not ship with a known silent-ignore path.

**Correction**

In the unpaginated dropdown branch, pass the same parsed filter options to `getCatalogDropdown` that the paginated branch passes to `searchCatalogDropdown`, minus `limit`/`offset` if preserving the unpaginated contract. Add a route test for at least:

- `/v1/catalog?fields=dropdown&processing_base_method=Natural&fermentation_type=Anaerobic&process_additive=hops&has_additives=true&processing_disclosure_level=high_detail&processing_confidence_min=0.8`
- Assert `mockGetCatalogDropdown` receives those parsed options.

### P2: The public docs example omits the new `process` object it says full rows include

**Evidence**

- `src/lib/docs/content.ts:354-356` says full catalog rows include legacy processing fields plus a nested `process` object and `process.evidence_available`.
- The immediately adjacent `GET /v1/catalog` example at `src/lib/docs/content.ts:363-366` still shows only `processing` and does not include `process`, `drying_method`, null-preserving process fields, or evidence availability.
- The implementation and tests do add this object: `src/lib/server/catalogResource.ts:283-303`; `src/lib/server/catalogResource.test.ts:256-288`.

**Impact**

This is not a runtime defect, but the docs page is part of the machine-consumer contract. The example now contradicts the prose and undersells the exact feature being shipped.

**Correction**

Update the full-row JSON example to include a representative `process` object. Include at least one null field and `evidence_available` so the null-preserving/provenance contract is visible. Do not include raw `processing_evidence`.

### P3: Constraint existence checks in the migration are only keyed by `conname`

**Evidence**

- `supabase/migrations/20260424_processing_transparency_fields.sql:16-44` checks `pg_constraint WHERE conname = ...` before adding each constraint.

**Impact**

In practice these names are likely unique in this app, so this is low risk. But `pg_constraint.conname` is not a table-specific predicate by itself. A same-named constraint elsewhere in the schema could make the migration skip the intended `coffee_catalog` constraint.

**Correction**

Tighten each existence check with `conrelid = 'public.coffee_catalog'::regclass`, or use an `ALTER TABLE ... ADD CONSTRAINT` block that catches duplicate-object only for that relation.

### P3: Anonymous exposure of all rich process filters is a product-tiering decision worth confirming

**Evidence**

- `notes/implementation-plans/2026-04-24-processing-transparency-schema-plan.md` says anonymous API should not receive all process filters by default and suggests starting with `processing_base_method` and maybe `fermentation_type`.
- The implemented docs say anonymous, viewer-session, and API-key requests share the full public query surface (`src/lib/docs/content.ts:378-380`), and route parsing passes all new filters for anonymous callers (`src/lib/server/catalogResource.test.ts:519-547`).

**Impact**

This may be an intentional product choice, and it is not a code correctness issue. It is only a strategy/tiering tension: additive-rich filters can be a public-value proof, but they also expose more of the data moat before API-key attribution.

**Correction**

If this was intentional, no code change needed. If not, gate richer filters by auth/plan and document the narrower anonymous subset. Do not block this PR on this unless Reed wants the stricter plan behavior now.

## Confirmed strengths

- The migration is additive and backward-compatible. It adds nullable columns and safe numeric/disclosure constraints without destructive data writes.
- `processing_evidence` is not exposed in `/v1/catalog` responses; only `process.evidence_available` is exposed (`src/lib/server/catalogResource.ts:283-303`, test at `src/lib/server/catalogResource.test.ts:256-288`).
- Null process metadata remains null instead of being converted to placeholders (`src/lib/server/catalogResource.test.ts:291-325`).
- `has_additives=false` uses explicit `['none']` containment and does not collapse unknown/unspecified rows into false (`src/lib/data/catalog.ts:265-272`; test at `src/lib/data/catalog.test.ts:132-140`).
- New filter metadata fields are exposed for UI/API filter discovery without fetching full rows (`src/routes/api/catalog/filters/+server.ts:34-56`).

## Recommended disposition

Patch same PR for the unpaginated dropdown filter passthrough and docs example. Re-run:

1. `SUPABASE_SERVICE_ROLE_KEY=dummy PUBLIC_SUPABASE_URL=http://localhost:54321 PUBLIC_SUPABASE_ANON_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy pnpm -s check`
2. `vitest run --config .vitest.processing.config.ts src/lib/data/catalog.test.ts src/lib/server/catalogResource.test.ts src/routes/api/catalog/filters/filters.test.ts`

After that, this should be mergeable without waiting for UI or scraper follow-ups.
