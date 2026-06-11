# PR #387 Verify Audit: CLI-Owned Catalog Agent Tools

**Date:** 2026-06-11  
**Repo:** `coffee-app`  
**Branch:** `feat/cli-owned-catalog-intelligence`  
**Verdict:** `ready_with_fixes`  
**Next action:** `patch_same_pr`

## Scope reviewed

Artifacts reviewed from `.verify-pr/20260611T190358Z-feat-cli-owned-catalog-intelligence/`:

- `metadata.txt`
- `changed_files.txt`
- `diffstat.txt`
- `commits.txt`
- `full.diff`
- `pr.json`

Code and context reviewed:

- `src/lib/services/marketTools.ts`
- `src/lib/services/marketTools.test.ts`
- `src/lib/services/tools.ts`
- `src/lib/services/toolModelOutput.ts`
- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/006-cli-owned-portable-agent-tools.md`
- `node_modules/@purveyors/cli/dist/lib/catalog.js`
- `node_modules/@purveyors/cli/dist/lib/catalog.d.ts`
- PR metadata/body from `pr.json`

## Executive summary

The core architectural move is correct: coffee-app now delegates `catalog_facets`, `supplier_list`, and `catalog_rank` data/tool semantics to `@purveyors/cli/catalog`, while retaining chat-facing schemas, snake_case mapping, cache policy, model-output slimming, and presentation. ADR-006 is directionally strong and aligns with `PRODUCT_VISION.md` and ADR-002.

The PR is not quite merge-ready because `supplier_list` now exposes legacy compatibility fields that look precise but are no longer true. In particular, `non_wholesale_listings` is synthesized as `supplier.total` for every supplier, even when the list was not filtered to non-wholesale rows, and `total_suppliers` is actually the number returned after the limit, not the total supplier universe. The tests encode this regression by expecting 30 generated suppliers to report `total_suppliers: 25` and `truncated: false`.

This is a chat-agent correctness problem, not just typing polish: the model can use these fields to answer supplier coverage questions with false counts. The fix should stay in this PR because the stated slice must be independently mergeable even if no future CLI/app cleanup ships.

## Intent coverage

### Satisfied

- `package.json` and `pnpm-lock.yaml` consume `@purveyors/cli` `^0.20.1` / `0.20.1`.
- `catalog_facets` delegates facet fields, counts, scope, sampling, and truncation to `listCatalogFacets`.
- `catalog_rank` delegates objectives and ranking to `rankCatalog`.
- `supplier_list` delegates aggregate construction and query filters to `supplierList`.
- `nonWholesaleOnly` and `country` supplier filters are applied inside CLI query construction before aggregation. Confirmed in `@purveyors/cli/dist/lib/catalog.js` via `fetchSupplierAggregateRows()` -> `buildCatalogIntelligenceQuery()`.
- Non-positive `max_price` and `min_purveyor_score` rank filters are ignored by the coffee-app adapter before calling CLI.
- Ranking uses CLI `getPurveyorScoreValue()` / `coffee_catalog.purveyor_score`, not local `score_value` ranking semantics.
- Coffee-app keeps appropriate adapter responsibilities: snake_case input mapping, Svelte/chat schemas, process-wide cache, output compaction, and canvas/card preservation.

### Not fully satisfied

- “Legacy output aliases where harmless” is not met for supplier aliases. Some compatibility fields are now actively misleading.
- The PR body is stale and contradicts the final architecture by saying `supplier_list` remains app-owned and linking/describing the wrong CLI/ADR version details.

## Findings

### P1: `supplier_list` compatibility fields report false counts

**Confirmed defect.**  
File: `src/lib/services/marketTools.ts`

`toSupplierSummary()` maps the CLI aggregate back to legacy fields:

```ts
non_wholesale_listings: supplier.total,
```

That is only true when the entire CLI query was filtered with `nonWholesaleOnly: true`. For the default `supplier_list` call, `supplier.total` includes wholesale and non-wholesale rows. The output field name says non-wholesale count, so the model can answer with a false number.

The same adapter also sets:

```ts
total_suppliers: response.meta.returned,
truncated: response.meta.truncated,
```

In CLI `0.20.1`, `supplierList()` slices aggregates to the requested limit before returning and reports `meta.returned` as the returned row count. `meta.truncated` is always `false` for supplier aggregates. The updated test `caps the returned supplier count at the requested limit` proves this: 30 generated suppliers with `limit: 100` are clamped to 25, and the test now expects `total_suppliers` to be 25 and `truncated` false.

That means the LLM-facing tool can understate the supplier universe and claim no truncation. This conflicts with the tool description: “List the supplier universe with aggregate signals per supplier.”

**Why it matters:** Supplier grounding is explicitly meant to prevent agent guessing. False coverage/count metadata is exactly the kind of subtle tool-output error that makes the agent confidently wrong.

**Correction guidance:**

- Do not synthesize `non_wholesale_listings` from `supplier.total` unless the query was actually `nonWholesaleOnly`; either remove this alias from the output/interface, make it nullable when unavailable, or rename it to an accurate CLI-owned field such as `listings` / `total`.
- Do not expose `total_suppliers` as if it is the full supplier universe unless CLI supplies a true pre-limit total. If CLI cannot provide that in `0.20.1`, rename/model it as `returned_suppliers` or make the legacy alias clearly represent returned rows only.
- Do not pass through `truncated: false` as meaningful supplier-universe completeness when CLI cannot detect post-limit truncation. Either omit it, mark it unknown, or patch CLI first and bump again.
- Update `marketTools.test.ts` to assert that these fields cannot lie. A good regression test is the current 30-supplier case: the output must not call 25 the full total without an explicit caveat.

### P2: `supplier_list` still advertises average supplier cup score, but the field is always null

**Confirmed defect / product-copy mismatch.**  
Files: `src/lib/services/marketTools.ts`, `src/lib/services/tools.ts`

The tool description says `supplier_list` returns “average supplier cup score,” while `toSupplierSummary()` now always returns:

```ts
avg_cup_score: null,
```

Removing local `score_value` aggregation is directionally correct because the PR intent says to use canonical `purveyor_score`, not `score_value`, for ranking and portable semantics. The problem is leaving a field and description that imply a real metric exists.

**Correction guidance:**

- Remove “average supplier cup score” from the `supplier_list` tool description unless CLI actually owns and returns that metric.
- Prefer the CLI-owned `score` object and `avg_purveyor_score` alias for compatibility.
- If keeping `avg_cup_score` for legacy shape, mark it nullable/deprecated in comments/tests and do not mention it in user/model-facing descriptions.

### P2: PR body is stale and contradicts the code and ADR

**Confirmed documentation/handoff issue.**  
File: `.verify-pr/.../pr.json` body

The PR body says:

- “bump `@purveyors/cli` to `^0.20.0`” while the branch uses `^0.20.1`.
- “keep `supplier_list` app-owned because it is still a chat/app-specific aggregate surface,” while the code and ADR now delegate supplier aggregates to CLI.
- ADR path is described as `006-cli-owned-catalog-intelligence.md`, but the actual file is `006-cli-owned-portable-agent-tools.md`.
- Related release link points at `v0.20.0`, not the consumed `0.20.1` package.

**Correction guidance:** Update the PR body before merge so it describes the final architecture: CLI owns `catalog_facets`, `supplier_list`, and `catalog_rank`; coffee-app owns chat scaffolding and presentation.

### P3: Local sanitize helper claims CLI parity but does not match CLI sanitize behavior

**Confirmed minor maintainability issue.**  
File: `src/lib/services/marketTools.ts`

The local helper comment says “CLI parity,” but coffee-app replaces `[%_,()]` with spaces while CLI `sanitizeFilterValue()` removes `[(),.*%]`. Since rank filters are passed to CLI directly and supplier country is sanitized again by CLI, this is not currently a functional issue. It is still a footgun for future adapter work.

**Correction guidance:** Import/use CLI `sanitizeFilterValue` or change the comment to avoid claiming exact parity.

## Validation performed

- `pnpm exec vitest run src/lib/services/marketTools.test.ts`  
  **VALIDATION_PASS:** 13 tests passed.

- `pnpm test -- --run src/lib/services/marketTools.test.ts`  
  **VALIDATION_PASS:** Full suite ran despite the awkward argument shape. 83 files passed, 1 skipped; 776 tests passed, 11 skipped. Console showed expected local-dev fetch `ECONNREFUSED :3000` noise from unrelated tests, but Vitest exited 0.

- `pnpm lint`  
  **VALIDATION_PASS:** Prettier check and ESLint passed.

- `pnpm check`  
  **VALIDATION_BLOCKED_ENV:** Failed because clean worktree lacks SvelteKit env exports: `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. This is environment/export failure, not evidence of a PR code failure.

## Slice assessment

`SCOPE_ASSESSMENT: right_boundary_needs_patch`

The PR boundary is basically right. The implementation should stay in this PR rather than rescope or supersede. The one required patch is to make the `supplier_list` adapter’s legacy fields and descriptions truthful now that CLI owns the underlying semantics.

## Operator summary

VERDICT: ready_with_fixes  
P0: 0  
P1: 1  
P2: 2  
P3: 1  
NEXT_ACTION: patch_same_pr  
TOP_FIXES:

- Fix `supplier_list` output aliases so `non_wholesale_listings`, `total_suppliers`, and `truncated` cannot report false coverage/counts from limited CLI results.
- Remove or relabel the always-null `avg_cup_score` claim in the tool description/output contract.
- Update the PR body to match the final CLI-owned `supplier_list` architecture and `@purveyors/cli ^0.20.1` bump.
