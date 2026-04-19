# PR Verification Report: Full Parchment Platform Refactor Audit

## Metadata

- **Repo:** coffee-app (reedwhetstone/coffee-app)
- **Base:** c32cf62 (pre-refactor main)
- **Head:** origin/main (all Parchment Platform PRs merged)
- **PRs covered:** #180, #181, #182, #183, #186, #187, #188
- **Reviewer model:** anthropic/claude-opus-4-6
- **Confidence:** High on auth/catalog/docs correctness. Medium on full UI regression surface (no browser testing; review is code-level only).
- **Scope note:** 65 files changed, ~5,283 insertions / ~4,035 deletions across 14 commits.

## Executive Verdict

- **Merge readiness:** Merged (post-merge audit)
- **Overall quality:** Strong. The refactor sequence is well-architected, well-tested, and achieves its stated goals.
- **Intent coverage:** Full for all 7 combined intents
- **Priority summary:** P0: 0, P1: 3, P2: 6, P3: 4

No blocking defects found. The P1 issues are user-facing docs inaccuracies introduced by the refactor that should be corrected in a follow-up.

---

## Intent Verification

### 1. Establish one canonical versioned API surface under `/v1/*`

**Status: PASS**

- `/v1/+server.ts` serves a JSON discovery document listing the catalog resource and legacy aliases.
- `/v1/catalog/+server.ts` delegates to `buildCanonicalCatalogResponse()` from the shared `catalogResource.ts`.
- The canonical response shape (`CanonicalCatalogResponse`) includes `meta.namespace: '/v1/catalog'` and `meta.version: 'v1'`.
- Legacy routes (`/api/catalog`, `/api/catalog-api`) delegate to the same `catalogResource.ts` with adapter functions that reshape output for backward compatibility.
- All three route files are thin one-liners, with all logic centralized in `catalogResource.ts`. Clean single-source-of-truth.

### 2. Unify auth via `resolvePrincipal()` for session-cookie and bearer API key callers

**Status: PASS**

- `principal.ts` (576 lines) implements a comprehensive discriminated union type system: `AnonymousPrincipal | SessionPrincipal | ApiKeyPrincipal`.
- `resolvePrincipal()` resolves auth from Authorization headers first (API key prefix detection vs bearer session JWT), then falls back to cookie session via `safeGetSession()`.
- `hooks.server.ts` calls `resolvePrincipal()` eagerly and sets `event.locals.principal` plus legacy locals via `getLegacyAuthState()`.
- Auth module (`auth.ts`) is fully refactored to delegate to principal functions: `requireAuth`, `requireUserAuth`, `requireMemberRole`, `requireAdminRole`, `requireApiKeyAuth`, `requireApiKeyAccess` all go through the principal.
- Cross-origin mutation guard (`isTrustedMutationRequest`) correctly applies only to session principals, not API key principals.
- The caching pattern (`event.locals.principal` memoization) prevents redundant resolution within a request.

### 3. Separate app roles (viewer/member/admin) from API plans/entitlements

**Status: PASS**

- `UserRole` type narrowed to `'viewer' | 'member' | 'admin'` only.
- `normalizeRoleValue()` explicitly drops pseudo-roles (`api-member`, `api-enterprise`, `ppi-member`) from the app roles array.
- `ApiPlan` type (`'viewer' | 'member' | 'enterprise'`) is separate from UserRole.
- `getUserEntitlements()` reads `api_plan` and `ppi_access` columns with graceful fallback to role-derived values when columns are missing (pre-migration).
- `deriveApiPlanFromRoles()` and `derivePpiAccessFromRoles()` handle backward compatibility during migration.
- Admin users are hard-coded to `enterprise` API plan in `resolveApiPlan()`.

### 4. Consolidate docs under `/docs` with data-driven content system

**Status: PASS**

- `content.ts` (993 lines) provides a structured data model: `DocsPage`, `DocsNavSection`, `DocsNavItem`, `DocsContentSection` with code blocks, tables, callouts, and related links.
- 13 docs pages covering API overview, catalog, analytics, roast profiles, inventory, errors/auth, and CLI (overview, catalog, inventory, roast, sales, tasting, agent integration).
- `DocsShell.svelte` (208 lines) renders the data model into a consistent layout with sidebar nav, prev/next links, code blocks, and callouts.
- `/docs/+page.svelte` serves as the docs home with section cards.
- `/docs/[section]/+page.server.ts` redirects to the first slug in each section.
- `/docs/[section]/[slug]/+page.server.ts` loads the specific page from content.ts.
- `/api-dashboard/docs` redirects to `/docs` (307).
- hooks.server.ts authGuard also redirects `/api-dashboard/docs` to `/docs` (307).

### 5. Apply Parchment Platform branding

**Status: PASS**

- Navbar.svelte: "Parchment Console" label for `/api-dashboard`.
- Dashboard quickstart: "Parchment Console" for API keys card.
- api-dashboard pages: titles use "Parchment Console", meta descriptions reference "Parchment API".
- API product page (`/api`): consistently uses "Parchment API", "Parchment Platform", "Parchment Console".
- docs pages: eyebrow text uses "Parchment Platform", "Parchment CLI".
- llms.txt: "Parchment API", "Parchment Console".
- sitemap.xml: "Parchment Console" comment.
- No instances of old "API Dashboard" branding found in user-facing copy.

### 6. Clean up catalog contract: canonical field names, narrow filter queries

**Status: PASS**

- `parseCatalogQuery()` in `catalogResource.ts` uses `parseOptionalNumberFromAliases()` to prefer `price_per_lb_min`/`price_per_lb_max` over deprecated `cost_lb_min`/`cost_lb_max`.
- Test coverage confirms canonical params take precedence when both are present.
- Test coverage confirms deprecated params still work as fallback.
- Filter route (`/api/catalog/filters`) uses `resolveCatalogVisibility()` to enforce narrow queries: anonymous and viewer sessions get `publicOnly: true, showWholesale: false`.
- The `searchCatalog` function receives `pricePerLbMin`/`pricePerLbMax` instead of the old `cost_lb` equivalents.

### 7. Production-quality public-facing copy

**Status: PASS with minor issues (see P1 findings)**

- API page (`/api`) has enterprise-quality copy: clear value prop, honest positioning about what's public vs internal, clean tier table, FAQ section with structured data.
- Docs home and individual pages are well-written with appropriate callouts distinguishing internal vs external surfaces.
- README completely rewritten with clean structure, accurate route map, and honest API layer description.
- AGENTS.md rewritten from ~1,019 lines of implementation detail to ~153 lines of concise contributor guidance.

---

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix soon; user-facing inaccuracies)

#### P1-1: Docs content.ts references stale pseudo-role names

**Evidence:** `src/lib/docs/content.ts:192` says:

> "Viewer users get the free Explorer tier automatically. Higher tiers come from user roles such as api-member and api-enterprise."

Additionally, `content.ts:278` and `content.ts:284` list `api-member` and `api-enterprise` as tier names in the tier behavior table.

**Impact:** Users reading the public docs will see references to deprecated pseudo-role names that no longer map to any clean UserRole. The entire point of PR #183 was to separate app roles from API plans. The docs should reference the `ApiPlan` values (viewer/member/enterprise) or the marketing tier names (Explorer/Roaster+/Enterprise), not the old pseudo-roles.

**Correction:** Update the three references in content.ts to use the new ApiPlan terminology. The auth model section should say something like "API plan levels (viewer, member, enterprise) determine rate limits and row caps."

#### P1-2: Docs example response shows deprecated `cost_lb` field name

**Evidence:** `src/lib/docs/content.ts:262` includes this in the example JSON response:

```json
"cost_lb": 7.5
```

**Impact:** PR #188's intent was canonical `price_per_lb` naming. The example response in official docs still shows the deprecated field name, which will mislead external developers.

**Correction:** Replace `"cost_lb": 7.5` with `"price_per_lb": 7.5` in the example response, and ideally add `price_per_lb` to the full field list elsewhere if not already present.

#### P1-3: Sitemap does not include `/docs` routes

**Evidence:** `src/routes/sitemap.xml/+server.ts` has no entries for `/docs`, `/docs/api/*`, or `/docs/cli/*`.

**Impact:** The unified docs tree is a major new public surface (PR #182). Without sitemap entries, search engines will rely on internal link crawling, which is slower and less reliable for deep pages. Given that the docs are the primary reference destination from the API product page, this is a meaningful SEO gap.

**Correction:** Add `/docs` plus each section/slug combination from `DOCS_NAV` to the sitemap generator.

### P2 (important improvements)

#### P2-1: Cookie-session principal path makes a redundant DB query

**Evidence:** In `principal.ts:resolvePrincipal()`, the cookie-session branch (starting around the `sessionContext.session` check):

1. Derives roles from `sessionContext.roles` (already fetched by `safeGetSession`)
2. Then immediately calls `getUserEntitlements(adminSupabase, sessionContext.user.id)` which queries the DB again

For pre-migration schemas (no `api_plan`/`ppi_access` columns), this is two DB round-trips per cookie-session request.

**Impact:** Performance overhead on every authenticated page load. The first query (safeGetSession) already fetched `user_role`. The second query re-fetches it plus the new columns.

**Correction:** For the common case where `safeGetSession` has already loaded roles, the principal could derive entitlements from the existing session context roles without a second DB call, only falling back to the explicit `getUserEntitlements()` when the new columns are available.

#### P2-2: ~51 routes still use `safeGetSession()` directly

**Evidence:** `grep -rn "safeGetSession" src/ | wc -l` returns 51 callsites. Major examples:

- `/api-dashboard/+page.server.ts`
- `/api-dashboard/keys/+page.server.ts`
- `/api-dashboard/usage/+page.server.ts`
- `/api/roast-profiles/+server.ts` (5 occurrences)
- `/api/beans/+server.ts`
- Several more across the codebase

**Impact:** These routes work correctly because `hooks.server.ts` already resolves the principal and sets legacy locals. But they bypass the principal abstraction, which means:

- They don't get automatic cross-origin mutation protection
- They don't benefit from the `ApiPlan`/scope model
- Future auth changes need to update both paths

**Correction:** Migrate high-traffic and mutation routes to use `requireUserAuth(event)` or similar principal-based helpers. This is a tracking debt item, not an urgent fix. The bridge via legacy locals prevents any correctness issue.

#### P2-3: `classify-roast` uses dynamic import for principal functions

**Evidence:** `src/routes/api/ai/classify-roast/+server.ts:43`:

```typescript
const { principalHasRole, resolvePrincipal } = await import('$lib/server/principal');
```

**Impact:** Dynamic imports prevent tree-shaking and add unnecessary runtime overhead. All other routes use static imports.

**Correction:** Move to a static import at the top of the file, consistent with every other route in the codebase.

#### P2-4: Admin discrepancy endpoint manipulates raw role arrays

**Evidence:** `src/routes/api/admin/stripe-role-discrepancies/+server.ts` POST handler:

```typescript
updatedRoles = currentRoles.filter((role: string) => role !== 'member');
if (updatedRoles.length === 0) {
	updatedRoles = ['viewer'];
}
```

**Impact:** This admin-only endpoint directly manipulates the `user_role` array without going through the new entitlement model. It could inadvertently strip or preserve pseudo-roles in the array because it doesn't use `normalizeRoleValue()`. Since it's admin-only and the pseudo-roles are just ignored by `normalizeRoleValue`, this isn't a security issue, but it's inconsistent with the new model.

**Correction:** Consider using the principal/entitlement model for admin role changes, or at minimum normalize the role array before writing.

#### P2-5: `hooks.server.ts` eagerly resolves principal for ALL requests

**Evidence:** Line 96 of `hooks.server.ts`:

```typescript
const principal = await resolvePrincipal(event);
```

This runs for every request, including static assets, public pages, etc.

**Impact:** For anonymous requests, this is lightweight (no Bearer header, no cookie session = anonymous principal). But for any request with cookies (most browser requests from logged-in users), it triggers `safeGetSession()` which calls Supabase auth, then triggers `getUserEntitlements()` which queries `user_roles`. That's 2-3 DB calls per page navigation.

**Correction:** Consider lazy principal resolution (resolve on first access rather than eagerly). The current approach prioritizes correctness over performance, which is the right initial choice, but should be optimized as traffic grows.

#### P2-6: Analytics page migration comment should be tracked

**Evidence:** `src/routes/analytics/+page.server.ts:99`:

```typescript
// Falls back to ppi-member pseudo-role detection during the migration period.
```

**Impact:** This is intentional migration code, but without a tracking issue, it could remain indefinitely. The principal correctly handles this fallback, but it represents transition-period code that should be cleaned up after all users have been migrated to explicit `ppi_access` entitlements.

**Correction:** Create a tracking issue for post-migration cleanup of `ppi-member` pseudo-role fallback code.

### P3 (nice to have)

#### P3-1: `database.types.ts` enum still lists deprecated pseudo-roles

**Evidence:** Lines 1207 and 1342 include `'api_viewer' | 'api_member' | 'api_enterprise'` in the type union.

**Impact:** These are auto-generated from the Supabase schema, not hand-maintained. No code change needed here; this is resolved by a future DB migration that removes those enum values from the PostgreSQL type.

#### P3-2: `/api-dashboard/docs` redirect uses 307 (temporary) instead of 301

**Evidence:** `src/routes/api-dashboard/docs/+page.server.ts:5` uses `redirect(307, '/docs')`. Similarly, `hooks.server.ts:117` uses `redirect(307, '/docs')`.

**Impact:** Since this is a permanent replacement (docs consolidated under `/docs`), a 301 would be more SEO-appropriate. 307 tells search engines the old URL may come back.

**Correction:** Change both redirects to 301 for permanent redirect semantics.

#### P3-3: No test for `/v1` root discovery endpoint

**Evidence:** `/v1/+server.ts` returns a JSON discovery document but has no `v1.test.ts` or similar test file. All three catalog route adapters have tests, but the root `/v1` does not.

**Impact:** Low risk (it's a static JSON response), but inconsistent with the testing pattern established for the catalog routes.

**Correction:** Add a simple test asserting the discovery document shape.

#### P3-4: DocsShell sidebar nav could benefit from current-page highlighting

**Evidence:** Reviewing `DocsShell.svelte` (208 lines), the sidebar navigation lists all items but there is no visual indicator for which page the user is currently viewing beyond the page title match.

**Impact:** Minor UX polish. The component renders section items as a list; highlighting the active slug would improve navigation clarity.

---

## Assumptions Review

| #   | Assumption                                                                  | Validity             | Notes                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `api_plan` and `ppi_access` columns may not exist yet                       | Valid                | Explicit fallback for pre-migration schemas with error code 42703 handling in `getUserEntitlements()`. Defensive and correct.                                                                                             |
| 2   | Cookie sessions always have `safeGetSession` context                        | Valid                | Provided by `hooks.server.ts` handleSupabase middleware. The function is memoized per-request.                                                                                                                            |
| 3   | Admin users always get enterprise API access                                | Valid                | Explicitly coded in `resolveApiPlan()`: `if (rawRoles.includes('admin')) return 'enterprise'`. Reasonable business rule.                                                                                                  |
| 4   | Bearer tokens that aren't API key prefixed are Supabase JWTs                | Valid                | Consistent with Supabase auth model. `bearerToken.startsWith(API_KEY_PREFIX)` is the discriminator.                                                                                                                       |
| 5   | Legacy catalog-api cache is per-instance                                    | Weak                 | Module-level `let legacyCatalogApiCache` is per-process. Fine for single-instance Vercel, but multi-instance deployments would have inconsistent cache state. Should be documented or moved to a shared cache if scaling. |
| 6   | `normalizeRoleValue()` returning null for pseudo-roles is safe              | Valid                | Pseudo-roles are consumed by `deriveApiPlanFromRoles()` and `derivePpiAccessFromRoles()` before being dropped. The raw role array is preserved for those derivation functions.                                            |
| 7   | The docs `redirect(307)` for sections without explicit slugs is intentional | Valid but suboptimal | Section-level redirects to first slug are correct behavior. Using 307 vs 301 is a minor SEO choice (see P3-2).                                                                                                            |

---

## Tech Debt Notes

### Debt Introduced

1. **Dual auth path**: `safeGetSession()` and `resolvePrincipal()` coexist. Legacy locals bridge prevents divergence, but ~51 routes still use the old path directly.
2. **Redundant DB query**: Cookie-session principal resolution queries `user_roles` twice (once via session middleware, once via `getUserEntitlements`).
3. **Eager principal resolution**: All requests pay the principal resolution cost even when no auth check is needed.

### Debt Reduced

1. **Auth consolidation**: 5 separate auth check patterns (raw role checks, safeGetSession inline, custom middleware, etc.) are now unified behind `resolvePrincipal()` + auth module helpers.
2. **Catalog fragmentation**: 3 separate catalog implementations are now a single `catalogResource.ts` with route-specific adapters.
3. **Docs sprawl**: Multiple disconnected docs/API pages replaced with a single data-driven content system.
4. **AGENTS.md bloat**: Reduced from 1,019 lines of implementation details to 153 lines of actionable contributor guidance.

### Suggested Follow-up Tickets

1. **Migrate high-priority routes from `safeGetSession()` to principal-based auth** (api-dashboard, beans, roast-profiles, workspaces)
2. **Optimize cookie-session principal to avoid redundant `getUserEntitlements()` query**
3. **Add `/docs` pages to sitemap.xml** (P1-3)
4. **Fix stale pseudo-role references in docs content.ts** (P1-1, P1-2)
5. **Post-migration cleanup: remove `ppi-member` pseudo-role fallback code** (P2-6)
6. **Change `/api-dashboard/docs` redirect from 307 to 301** (P3-2)
7. **Static import for principal in classify-roast endpoint** (P2-3)

---

## Product Alignment Notes

### Alignment Wins

- The separation of "what is public today" vs "what stays internal" is honest and well-executed across API page, docs, README, and sitemap. No over-promising.
- Parchment Platform branding is consistent across all user-facing surfaces.
- The docs content accurately describes current behavior rather than aspirational architecture.
- Tier pricing table, FAQs, and structured data on the API page are production-quality marketing.
- The cross-linking between docs, CLI, API, and console surfaces creates a cohesive information architecture.

### Misalignments

- Stale pseudo-role names in docs (P1-1) contradict the role simplification intent.
- `cost_lb` in example response (P1-2) contradicts the canonical naming intent.
- Missing sitemap entries for docs (P1-3) undermine the docs consolidation effort.

### Suggested Product Checks

- Verify the `/api-dashboard/docs` redirect works in production (double redirect: hooks guard + page server load).
- Confirm the `/docs` tree renders correctly on mobile (DocsShell sidebar behavior).
- Check that the API page structured data (pricing, FAQ) appears correctly in Google Search Console.

---

## Test Coverage Assessment

### Existing Tests That Validate Changes

| Test File                             | Coverage Area                                                                                                                                                           | Quality                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `principal.test.ts` (253 lines)       | Role normalization, priority, scopes, plan hierarchy, legacy state derivation, trusted mutation checks                                                                  | Strong. Covers pseudo-role dropping, plan hierarchy, cross-origin guards, and legacy bridge. |
| `auth.test.ts` (273 lines)            | Integration of auth helpers with principal system: fail-closed on API key lookup failure, bearer vs cookie priority, cross-origin mutation blocking                     | Strong. Tests the critical "bearer header takes priority over cookies" behavior.             |
| `hooks.server.test.ts` (172 lines)    | End-to-end hooks middleware: invalid bearer rejects, bearer-session redirects, cookie member passes through                                                             | Strong. Tests the full middleware chain for the three key auth scenarios.                    |
| `catalogResource.test.ts` (479 lines) | All three catalog response builders: canonical, legacy app, legacy external. Anonymous, session, API key. Price param aliases. Row limits. Rate limits. Cache behavior. | Comprehensive. Covers the critical cross-PR integration surface.                             |
| `pageAuth.test.ts` (34 lines)         | Page auth state drops elevated role when no page session                                                                                                                | Focused and correct for its narrow scope.                                                    |
| `catalog.test.ts` (33 lines)          | Route delegates to correct builder                                                                                                                                      | Lightweight but sufficient for a thin adapter.                                               |
| `catalog-api.test.ts` (38 lines)      | Route delegates to correct builder                                                                                                                                      | Same pattern.                                                                                |
| `v1/catalog.test.ts` (33 lines)       | Route delegates to correct builder                                                                                                                                      | Same pattern.                                                                                |
| `filters.test.ts` (117 lines)         | Filter endpoint visibility policy for anonymous, viewer, and member                                                                                                     | Good. Validates the narrow filter query behavior.                                            |
| `page.server.test.ts` (102 lines)     | Catalog page server load visibility policy                                                                                                                              | Good. Validates SSR catalog visibility.                                                      |

### Missing Tests for High-Risk Paths

1. **`resolvePrincipal()` integration test**: The unit test covers helpers, but there's no test that exercises the full `resolvePrincipal()` path with mocked Supabase sessions and API key validation end-to-end.
2. **`getUserEntitlements()` fallback paths**: The graceful degradation when `api_plan`/`ppi_access` columns are missing is critical but tested only implicitly through the principal tests.
3. **`/v1` discovery endpoint**: No test exists.
4. **Docs routing**: No test for `/docs/[section]` redirect or `/docs/[section]/[slug]` loading.
5. **`catalogVisibility.ts`**: No dedicated test file, though its behavior is tested indirectly through catalogResource and catalog page server tests.

### Suggested Test Additions

1. Integration test for `resolvePrincipal()` with mocked Supabase client exercising all three auth paths.
2. Unit test for `getUserEntitlements()` column-missing fallback specifically.
3. Simple route test for `/v1/+server.ts`.
4. Test for `catalogVisibility.ts` to verify member/viewer/anonymous behavior directly.

---

## Minimal Correction Plan

1. **Fix docs content.ts pseudo-role references** (P1-1): Update three locations to use ApiPlan terminology.
2. **Fix docs example response field name** (P1-2): Replace `cost_lb` with `price_per_lb` in the example JSON.
3. **Add /docs to sitemap** (P1-3): Import DOCS_NAV in sitemap generator and emit entries for each section/slug.
4. **Static import in classify-roast** (P2-3): Minor refactor, low risk.
5. **Change redirect status codes to 301** (P3-2): Two-line change.

Items 1-3 should ship as a single PR. Items 4-5 can be separate or combined.

---

## Optional Patch Guidance

### P1-1: content.ts pseudo-role references

**`src/lib/docs/content.ts:192`** — Replace:

> "Higher tiers come from user roles such as api-member and api-enterprise."

With something like:

> "Higher API plans (member, enterprise) come from subscription tiers linked to the user account."

**`src/lib/docs/content.ts:278, 284`** — Replace `api-member` and `api-enterprise` in the tier behavior table with the marketing names `Roaster+` and `Enterprise`, or the ApiPlan values `member` and `enterprise`.

### P1-2: content.ts example response

**`src/lib/docs/content.ts:262`** — In the example JSON string, change `"cost_lb": 7.5` to `"price_per_lb": 7.5`.

### P1-3: sitemap docs entries

**`src/routes/sitemap.xml/+server.ts`** — Import `DOCS_NAV` from `$lib/docs/content` and generate entries:

```typescript
import { DOCS_NAV } from '$lib/docs/content';

// Inside the sitemap template:
const docsEntries = DOCS_NAV.flatMap((section) =>
	section.items.map(
		(item) =>
			`<url><loc>${baseUrl}/docs/${section.key}/${item.slug}</loc><lastmod>${currentDate}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
	)
).join('\n');
```

### P2-3: classify-roast static import

Move the dynamic import to a static import at the top of the file:

```typescript
import { principalHasRole, resolvePrincipal } from '$lib/server/principal';
```

---

## Cross-PR Integration Assessment

This audit specifically looked for issues that individual PR reviews might have missed. Findings:

1. **Auth coherence across the full stack**: The principal system in PR #180 is correctly consumed by the catalog layer in PR #181, the docs in PR #182, the role migration in PR #183, and the catalog P2 cleanups in PR #188. No divergence found.

2. **Legacy locals bridge correctness**: `getLegacyAuthState()` correctly derives `session`, `user`, `role`, and `roles` from the principal state for all three principal types (anonymous, session, API key). The hooks middleware sets these before the auth guard runs, so page-level route guards see consistent state.

3. **Bearer-session vs cookie-session priority**: The most dangerous cross-cutting concern. PR #180 established "Authorization header present = use bearer path, ignore cookies." This is correctly enforced in `resolvePrincipal()` and tested in both `auth.test.ts` and `hooks.server.test.ts`.

4. **Catalog visibility consistency**: `resolveCatalogVisibility()` (PR #181) is used identically across the catalog page server load, the filter endpoint, and the canonical catalog resource. No divergent visibility logic found.

5. **Docs accuracy vs actual implementation**: The content in `content.ts` (PR #182/186) largely matches the actual codebase behavior, with the three exceptions noted in P1 findings. The "Current reality" callout in the API overview is honest about `/api/catalog-api` being the public contract today.

6. **Branding consolidation completeness**: PR #187 caught all major user-facing surfaces. No instances of old "API Dashboard" branding remain in user-facing copy. The nav, dashboard, console pages, docs, llms.txt, and sitemap all use Parchment Console/Parchment API/Parchment Platform consistently.

---

_Audit completed 2026-03-28. This is a read-only audit; no code was modified._
