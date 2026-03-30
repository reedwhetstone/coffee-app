# PR #181 Audit: v1 Catalog Cutover (Final Rerun)

**Reviewer:** Claude Opus 4.6 (verify-pr subagent)
**Branch:** `origin/feat/v1-catalog-cutover` (d5540da)
**Base:** `origin/main` (afced96d)
**Repo:** `/root/.openclaw/workspace/repos/coffee-app`
**Generated:** 2026-03-27

---

## Metadata

- **Repo:** coffee-app
- **Base:** origin/main
- **Head:** origin/feat/v1-catalog-cutover
- **PR #:** 181
- **Reviewer model:** anthropic/claude-opus-4-6
- **Confidence:** High
- **Scope:** Full PR verification audit covering catalog canonical refactor, page auth alignment, and price filter deprecation contract

---

## Executive Verdict

- **Merge readiness:** Ready with documentation fixes (P2)
- **Intent coverage:** Full
- **Priority summary:** P0: 0, P1: 0, P2: 2, P3: 2

This PR implements the v1 catalog cutover cleanly. The canonical `/v1/catalog` resource is the real source of truth. Both legacy shims (`/api/catalog` and `/api/catalog-api`) delegate to shared logic. Page auth alignment correctly gates bearer-token auth out of page routes while allowing cookie sessions through. The `cost_lb_*` deprecation aliasing is correctly implemented and tested. Two P2 documentation issues should be fixed before or shortly after merge; nothing blocks.

---

## Intent Verification

**Stated intent:**
1. Make `/v1/catalog` the real canonical catalog resource.
2. Cut internal and external catalog usage over to shared logic/contract.
3. Turn `/api/catalog` and `/api/catalog-api` into explicit compatibility shims over the canonical service.
4. Absorb the remaining PR A page-auth alignment work where it naturally intersects catalog/page consumption.
5. Deprecation fix: `price_per_lb` is the source of truth; canonical params are `price_per_lb_min`/`price_per_lb_max`; `cost_lb_*` are compatibility aliases only.

**What was implemented:**
1. **New `catalogResource.ts`** (726 lines) contains three builder functions: `buildCanonicalCatalogResponse`, `buildLegacyAppCatalogResponse`, `buildLegacyExternalCatalogResponse`. All catalog routes delegate here.
2. **New `catalogVisibility.ts`** (33 lines) extracts the `hasPrivilegedCatalogSession` / `resolveCatalogVisibility` logic into a reusable module.
3. **New `pageAuth.ts`** (16 lines) extracts `getPageAuthState` for page server load functions, correctly stripping bearer session state and returning `viewer` when no cookie session exists.
4. **`hooks.server.ts`** updated to use normalized `event.locals.session` (set from principal resolution) instead of calling `safeGetSession()` inline in the auth guard.
5. **`/api/catalog`** shim: delegates to `buildLegacyAppCatalogResponse`, which calls the canonical builder and strips the meta wrapper for legacy callers.
6. **`/api/catalog-api`** shim: delegates to `buildLegacyExternalCatalogResponse`, which calls the canonical auth logic but uses the existing `getPublicCatalog` path with the legacy response shape.
7. **`/api/catalog/filters`** shim: now uses `resolveCatalogVisibility` and passes `publicOnly` correctly.
8. **Canonical price filter aliasing:** `parseCatalogQuery` in `catalogResource.ts` uses `parseOptionalNumberFromAliases` to prefer `price_per_lb_min/max` over `cost_lb_min/max`.
9. **`catalog.ts`**: `priceRange` comment updated from `cost_lb` to `price_per_lb`; `costLbMin`/`costLbMax` options removed; `pricePerLbMin`/`pricePerLbMax` added; `public_coffee` added to `CatalogDropdownItem` and `DROPDOWN_COLUMNS`.
10. **All page server loads** (`/beans`, `/roast`, `/profit`, `/catalog`, `+layout.server.ts`) now use `getPageAuthState` or `resolveCatalogVisibility`.

**Coverage gaps:** None found.

---

## Findings by Severity

### P0 (must fix before merge)

_None._

### P1 (should fix before merge)

**No P1 issues.**

### P2 (important improvements)

**P2-A: API docs page overstates authentication requirement for /v1/catalog**

- **Evidence:** `src/routes/api-dashboard/docs/+page.svelte` line 138-139:
  > "All API requests require authentication using Bearer token authentication with a valid API key."
  > "API keys are provided upon subscription activation"

- **Impact:** The `/v1/catalog` canonical endpoint accepts anonymous requests (returns public-only data). The docs page implies API key is required for all requests, which is only true for the legacy `/api/catalog-api` shim. Users reading the docs may not know they can query the canonical endpoint anonymously.

- **Correction:** Add a note clarifying that `/v1/catalog` supports anonymous access (public data only). The API key requirement applies to `/api/catalog-api` (the legacy external shim), which requires API key auth and always returns public-only data. Consider adding an "Authentication Modes" table that explains the three auth contexts: anonymous (public catalog), cookie session (internal visibility), and API key (legacy external).

---

**P2-B: /api/catalog-api does not respect price_per_lb filtering parameters**

- **Evidence:** `src/routes/api/catalog-api/+server.ts` (line 4-5, new shim) calls `buildLegacyExternalCatalogResponse`, which in turn calls `getPublicCatalog(createAdminClient(), CATALOG_API_COLUMNS)`. This fetches ALL public coffees with a fixed column set and NO price filtering. Any `price_per_lb_min`, `cost_lb_min`, etc. query params in the URL are silently ignored.

- **Pre-refactor behavior:** The old `/api/catalog-api` also had no price filtering support. The only filter params were `showWholesale` and `wholesaleOnly` (implicitly via `publicOnly`). So this is not a regression from pre-refactor state.

- **Impact:** External API consumers using the `/api/catalog-api` legacy shim cannot filter by price. This is acceptable for a compatibility shim whose behavior is intentionally frozen. However, if the intent was to route ALL catalog queries through the canonical path (including price filtering), this is incomplete.

- **Correction:** If price filtering is a desired feature for `/api/catalog-api`, it should call `buildCanonicalCatalogResponse` and project the legacy response shape. If the shim is intentionally frozen at pre-refactor behavior, add a comment in the shim noting this limitation. Given this is a compatibility shim, a comment is sufficient (not a blocking fix).

---

### P3 (nice to have)

**P3-A: `coffee_user` field potentially exposed in /api/catalog response**

- **Evidence:** `buildLegacyAppCatalogResponse` in `catalogResource.ts` (line 504) calls `buildCanonicalCatalogResponse` and returns `body.data`. The canonical builder calls `searchCatalog` which fetches all columns (including `coffee_user` per the `CatalogItem` type). The legacy `/api/catalog` route historically never exposed `coffee_user`.

- **Impact:** Very low. The `coffee_user` field stores the owning user's ID and is unlikely to be populated in a general catalog search result. The beans page uses this data client-side and no consumer has been observed reading `coffee_user`. However, it is a data-leak risk surface area if any inventory rows happen to have `coffee_user` set.

- **Correction:** Consider projecting the `coffee_user` field out in `buildLegacyAppCatalogResponse` before returning, consistent with how `CATALOG_API_COLUMNS` excludes sensitive fields. Alternatively, confirm with a test that `coffee_user` is never populated in public catalog results.

---

**P3-B: Stale comment in filterStore.ts priceRange handling**

- **Evidence:** `src/lib/stores/filterStore.ts` line 17 comment says `showWholesale: boolean` but the comment for the range filter handling at line 113-119 still references `cost_lb`:
  > `// Handle range filters (score_value, cost_lb)`
  This comment refers to the filter key naming convention in the store, not the actual DB column. The store builds params like `price_per_lb_min`/`price_per_lb_max` (matching the canonical contract), so the comment is misleading.

- **Impact:** Low (cosmetic/misleading comment).

- **Correction:** Update the comment to reference `price_per_lb` instead of `cost_lb`.

---

## Assumptions Review

| Assumption | Validity | Why | Recommended action |
|---|---|---|---|
| `/api/catalog` is only used by internal UI pages (beans page) | Valid | Beans page is the only caller found via grep. `/api/catalog` requires a session cookie (no anonymous access possible). | None |
| `safeGetSession()` returns a singleton promise, so caching `event.locals.session` in hooks is safe | Valid | `safeGetSession` memoizes on `sessionContextPromise` within the request. Setting `event.locals.session` to the resolved value before the guard runs is equivalent. | None |
| `priceRange` in `catalog.ts` (the `[min, max]` tuple option) is used by internal callers that should be updated | Weak | Only one caller found: `src/routes/api/tools/coffee-catalog/+server.ts` (line 69). This is an internal tool. Whether it needs updating is unclear from this PR. | Verify `coffee-catalog` tool's `price_range` param maps correctly to `pricePerLbMin`/`pricePerLbMax` |
| The `ids` parameter support in the old `/api/catalog` route is unused | Valid | Grep found zero callers in the codebase. The function `getCatalogItemsByIds` is still exported from `catalog.ts` for direct use. | None |
| `CATALOG_API_COLUMNS` intentionally omits `price_per_lb` | Valid | The legacy external contract predates `price_per_lb`. The PR intentionally keeps the shim frozen. | Document the frozen nature in a comment |

---

## Tech Debt Notes

**Debt introduced:**
- `legacyCatalogApiCache` is a module-level mutable singleton in `catalogResource.ts`. It persists across requests but is not tied to any TTL cleanup beyond the `LEGACY_CATALOG_API_CACHE_TTL` check. This is inherited from the old `/api/catalog-api` pattern and not made worse.

**Debt worsened:**
- The `CatalogItem` type (`Database['public']['Tables']['coffee_catalog']['Row']`) includes `coffee_user`. All catalog queries return this type, which technically carries a sensitive field. This was already true before the PR.

**Suggested follow-up tickets:**
- [ ] Audit `coffee-catalog` tool's price_range param for correct canonical mapping
- [ ] Consider adding `price_per_lb` to `CATALOG_API_COLUMNS` as a non-breaking field addition
- [ ] Add E2E smoke tests for `/v1/catalog` anonymous, cookie-session, and API-key paths

---

## Product Alignment Notes

**Alignment wins:**
- The canonical `/v1/catalog` response shape is clean and well-structured with `data`, `pagination`, and `meta` top-level keys.
- The `X-Purveyors-Canonical-Resource: /v1/catalog` header on all three routes signals the architecture clearly to API consumers.
- The `/v1/+server.ts` root resource correctly lists `/v1/catalog` as live and marks legacy aliases.

**Misalignments:**
- The API docs page (`/api-dashboard/docs`) still references `/api/catalog-api` as the primary example URL (line 127: `>https://purveyors.io/api/catalog-api`), which is the OLD canonical URL. It was partially updated (lines 192, 366, 391 reference `/v1/catalog`), but the Rate Limits section (line 422-424) correctly explains the canonical vs. legacy distinction.
- The marketing page (`/api/+page.svelte`) correctly shows `/v1/catalog` in the request preview.

---

## Test Coverage Assessment

**Existing tests that validate changes:**
- `src/lib/server/catalogResource.test.ts` (424 lines): Excellent coverage of canonical response building, price aliasing (both canonical and deprecated paths), member session visibility, bearer-session public-only enforcement, API-key rate limiting and row limiting, legacy external projection and cache behavior. Tests are well-structured with clear descriptions.
- `src/routes/api/catalog/catalog.test.ts` (33 lines): Tests delegation pattern for `/api/catalog` shim.
- `src/routes/v1/catalog/catalog.test.ts` (33 lines): Tests delegation pattern for `/v1/catalog` route.
- `src/routes/api/catalog-api/catalog-api.test.ts` (145 lines): Tests delegation and auth for legacy external shim.
- `src/routes/api/catalog/filters/filters.test.ts` (121 lines): Tests anonymous/public-only enforcement on filter metadata endpoint.
- `src/routes/catalog/page.server.test.ts` (102 lines): Tests public catalog SSR for viewer and member sessions.
- `src/hooks.server.test.ts` (172 lines): Tests auth guard with bearer session, invalid auth headers, and cookie session cases.
- `src/lib/server/pageAuth.test.ts` (34 lines): Tests `getPageAuthState` role stripping behavior.

**Missing tests:**
- No integration test for the full `/api/catalog` shim response shape with actual Supabase data (the shim's `legacyBody` unwrapping logic is only tested indirectly).
- No test for the `/api/catalog-api` price filtering behavior (either confirming it ignores params or confirming it doesn't support them).
- No test for the `/api/catalog` shim with pagination vs. non-pagination path.

**Suggested test additions:**
1. `buildLegacyAppCatalogResponse` test: verify non-paginated response returns a plain array (not wrapped in `{data, pagination}`), and paginated response returns `{data, pagination}`.
2. `buildLegacyExternalCatalogResponse` test: confirm that query params (continent, country, price) are ignored and the full public catalog is returned.

---

## Minimal Correction Plan

1. **[P2-A] Fix API docs page authentication claim.** Add a note in the authentication section explaining that `/v1/catalog` accepts anonymous requests (public data) while `/api/catalog-api` requires an API key. Update line 138-139 to reflect the actual behavior.

2. **[P2-B] Add clarifying comment to `buildLegacyExternalCatalogResponse`.** Add a comment noting that the legacy external shim intentionally does not support query parameter filtering (sorting, price, geography). This documents the frozen behavior so future developers do not spend time debugging "why doesn't `country` filter work on `/api/catalog-api`?"

3. **[P3-B] Fix misleading `cost_lb` comment in filterStore.ts.** Line 113: change `// Handle range filters (score_value, cost_lb)` to `// Handle range filters (score_value, price_per_lb)`.

---

## Optional Patch Guidance

### P2-A Fix (api-dashboard docs)

In `src/routes/api-dashboard/docs/+page.svelte`, add a note after line 139:

```svelte
<p class="mb-4 text-text-secondary-light">
  All API requests require authentication using Bearer token authentication with a valid
  API key. The canonical <code>/v1/catalog</code> endpoint also accepts anonymous
  requests and returns public catalog data. The legacy <code>/api/catalog-api</code>
  shim requires a valid API key for all requests.
</p>
```

### P2-B Fix (comment addition)

In `src/routes/api/catalog-api/+server.ts`, add after the function signature comment or at the top of the builder:

```typescript
// NOTE: This legacy external shim intentionally ignores all query parameters
// (filters, sorting, pagination). It serves the full public catalog with no
// client-driven filtering. Behavior is frozen at pre-refactor state.
```

### P3-B Fix (filterStore comment)

In `src/lib/stores/filterStore.ts` line 113:
```typescript
// Handle range filters (score_value, price_per_lb)
```

---

*Report generated by verify-pr subagent. No fixes were applied.*
