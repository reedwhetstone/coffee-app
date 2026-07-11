# PR #302 Re-verification: ADR-005 access-tier alignment

**Date:** 2026-04-29
**Repo:** `reedwhetstone/coffee-app`
**PR:** https://github.com/reedwhetstone/coffee-app/pull/302
**Branch:** `feat/public-catalog-process-facets`
**Head:** `8a33f6a`
**Verifier:** OpenClaw verify-pr subagent

## Operator summary

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 2
NEXT_ACTION: merge
SCOPE_ASSESSMENT: mergeable

## Validation

- `pnpm exec vitest run src/lib/server/catalogAccess.test.ts src/routes/catalog/page.server.test.ts src/routes/catalog/page.svelte.test.ts src/routes/api/catalog/filters/filters.test.ts src/lib/server/catalogResource.test.ts src/lib/stores/filterStore.test.ts src/lib/catalog/urlState.test.ts src/lib/components/CoffeeCard.svelte.test.ts src/lib/catalog/processDisplay.test.ts`: VALIDATION_PASS, 9 files / 128 tests passed.
- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `pnpm check`: VALIDATION_BLOCKED_ENV. Exact blocker: the clean worktree lacks SvelteKit env exports for `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`, causing 8 `$env/static/*` missing-export diagnostics before typechecking can complete. This is an environment/export blocker, not an observed code failure.

## Context reviewed

- Verify artifacts in `.verify-pr/20260429T194615Z-feat-public-catalog-process-facets`: `metadata.txt`, `changed_files.txt`, `diffstat.txt`, `commits.txt`, and `full.diff`.
- Product and access strategy: `notes/PRODUCT_VISION.md`, `notes/decisions/005-catalog-access-level-positioning.md`, and `notes/implementation-plans/2026-04-29-adr005-pr302-access-tier-alignment.md`.
- Prior PR #302 audits: `notes/pr-audits/2026-04-28-pr-302-process-facets.md` and `notes/pr-audits/2026-04-28-pr-302-process-facets-reverify.md`.
- Changed code in repo context, especially `src/lib/server/catalogAccess.ts`, `src/routes/catalog/+page.server.ts`, `src/routes/catalog/+page.svelte`, `src/routes/api/catalog/filters/+server.ts`, `src/lib/server/catalogResource.ts`, `src/lib/catalog/catalogResourceItem.ts`, `src/lib/components/CoffeeCard.svelte`, and corresponding tests.

## Verdict rationale

PR #302 now satisfies the ADR-005 correction intent and is independently mergeable. The implementation separates process data visibility from process search leverage: CoffeeCards can still display structured process facts, while working process facet controls, direct `/catalog` process query params, `/api/catalog/filters` process metadata, and `/v1/catalog` process query params are all gated by a centralized catalog access capability.

The slice boundary is coherent. It fixes the process-facet entitlement problem without attempting the broader future refactor for every advanced catalog facet, semantic search, saved searches, exports, or drying-method normalization. That is the right boundary for making PR #302 mergeable under ADR-005.

## Intent coverage audit

### Central capability model

Satisfied. `src/lib/server/catalogAccess.ts:6-18` introduces `CatalogAccessCapabilities`, including `canUseProcessFacets` and `canViewPremiumFilterMetadata`. The resolver grants member/admin sessions and paid API plans (`member` / `enterprise`) the member-search-leverage capability, while anonymous, viewer, and API Green (`viewer`) callers do not receive it (`src/lib/server/catalogAccess.ts:84-105`). The same file centralizes process-facet param detection and 401/403 notice construction (`src/lib/server/catalogAccess.ts:37-44`, `109-134`).

### `/catalog` UI and direct URL params

Satisfied. The page server resolves catalog capabilities before search, strips process facet filters for unauthorized callers, and only passes authorized state into `searchCatalog` (`src/routes/catalog/+page.server.ts:44-78`). It returns a denial notice so the page can explain the member boundary instead of silently presenting working filters (`src/routes/catalog/+page.server.ts:51-60`, `91-97`). The Svelte page renders the working advanced process controls only when `data.catalogAccess?.canUseProcessFacets` is true (`src/routes/catalog/+page.svelte:284-389`); otherwise it shows member CTA copy and the denial message (`src/routes/catalog/+page.svelte:390-410`).

Tests cover anonymous stripping, viewer stripping with 403 notice, and member/admin pass-through in `src/routes/catalog/page.server.test.ts`; component tests cover hidden vs enabled process controls in `src/routes/catalog/page.svelte.test.ts`.

### `/api/catalog/filters` metadata

Satisfied for the requested process metadata. The route resolves the same access capabilities and only includes `processing_base_method`, `fermentation_type`, `process_additives`, and `processing_disclosure_level` inside the `canViewPremiumFilterMetadata` branch (`src/routes/api/catalog/filters/+server.ts:7-67`). Anonymous and viewer tests assert those keys are omitted, while member/admin tests assert they are included when present.

### `/v1/catalog` process query enforcement

Satisfied. `/v1/catalog` resolves the normalized principal, API key access, API rate/row limits, and catalog access capabilities in one path (`src/lib/server/catalogResource.ts:409-479`). Before calling `queryCatalogData`, it checks requested process facet params and throws `AuthError` with the centralized 401/403 status when unauthorized (`src/lib/server/catalogResource.ts:763-775`); the catch block returns explicit `Authentication required` or `Insufficient permissions` responses (`src/lib/server/catalogResource.ts:822-834`). Tests cover anonymous rejection, viewer session rejection, member session pass-through, API Green rejection, and paid API pass-through.

### CoffeeCard process display and raw evidence exposure

Satisfied. `toCatalogResourceItem()` omits `processing_evidence`, `processing_evidence_available`, and `processing_evidence_schema_version` from the top-level resource object while adding a sanitized `process` summary (`src/lib/catalog/catalogResourceItem.ts:16-30`, `35-61`). The data query selects `processing_evidence_available` but not raw `processing_evidence` (`src/lib/data/catalog.ts:141-153`). CoffeeCard rendering still uses `coffee.process` and normalizes placeholder values before display (`src/lib/components/CoffeeCard.svelte:95-156`, `417-464`). This preserves public process fact visibility without exposing raw evidence by default.

## Findings

### P3: `/api/catalog/filters` lacks API-key matrix tests for premium metadata

**Status:** coverage concern, not a confirmed defect.

The production route should support paid API principals because it passes `locals.principal` into `resolveCatalogAccessCapabilities()` (`src/routes/api/catalog/filters/+server.ts:7-13`), and the shared resolver explicitly allows paid API plans (`src/lib/server/catalogAccess.ts:87-103`). However, `src/routes/api/catalog/filters/filters.test.ts` only covers anonymous, viewer session, member session, and admin session. It does not assert API Green omission or API Origin/Enterprise inclusion for filter metadata.

This is not merge-blocking because `/v1/catalog`, the canonical API query path, has the API Green and paid API tests, and the route implementation uses the same helper. Still, adding two focused metadata tests would reduce future drift risk.

### P3: `filterStore` remains capability-agnostic and can serialize process filters if called directly

**Status:** defense-in-depth concern, not a bypass.

`filterStore.setFilter()` and URL serialization can still emit process facet query params when called directly from client code; the store tests intentionally verify serialization of process params. This is acceptable because the actual UI hides the controls for unauthorized users and the trusted server/API boundary strips or denies those params. It does mean the client store is not itself an entitlement boundary. That is fine under ADR-005, but future client work should avoid treating store-level availability as proof of access.

## Scope assessment

`SCOPE_ASSESSMENT: mergeable`.

The PR can pass the mergeable-slice gate even if the next planned entitlement or normalization PR never ships:

- Process facts remain visible on CoffeeCards.
- Anonymous and viewer callers lose working process search leverage.
- API Green loses working process search leverage.
- Member/admin sessions and paid API tiers can use process facets.
- Raw process evidence remains hidden by default.
- The broader catalog capability roadmap can proceed separately.

## Required next action

Merge PR #302 after CI confirms the environment-backed checks. No P0/P1/P2 fixes are required in this PR.
