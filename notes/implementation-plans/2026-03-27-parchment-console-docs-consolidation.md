# Implementation Plan: Parchment Console and Docs Consolidation (PR D)

> **Historical execution note (2026-04-13):** This plan describes an already-past transition stage and includes stale references to the old `Parchment Platform` sequence and `/api-dashboard/docs` migration context. Keep it as execution history, not as the current product/source-of-truth doc.

**Date:** 2026-03-27
**Slug:** parchment-console-docs-consolidation
**Status:** Planning only, awaiting Reed review
**Repo:** coffee-app (web-only; no CLI changes needed)
**Series:** Parchment Platform — PR D of A/B/C/D/E sequence (PR A merged as #180)

---

## Feature

Consolidate documentation under `/docs` as the single canonical docs destination, rebrand `/api-dashboard` UI copy and nav references to "Parchment Console", and redirect `/api-dashboard/docs` so the two competing docs surfaces collapse into one.

DEVLOG source: Priority 0 Parchment Platform sequence (PR D plan in `notes/implementation-plans/2026-03-26-pr-d-console-docs-consolidation.md`).

---

## Candidate Scoring

Scored against the daily easy-win rubric:

| Candidate | Priority | Complexity | Risk | Deps | Total |
|---|---|---|---|---|---|
| PR D: Parchment Console/Docs Consolidation | P0=10 | medium=6 | low=0 | none=0 | **16** |
| Score & rating display formatting | P2=6 | easy=10 | low=0 | none=0 | **16** |
| Bean catalog profile cleanup | P2=6 | easy=10 | low=0 | none=0 | **16** |
| PR B: Catalog `/v1` hard cutover | P0=10 | medium=6 | medium=-2 | none=0 | **14** |
| Roast chart resize on navigation | P2=6 | medium=6 | medium=-2 | some=-2 | **8** |
| PR C: Role simplification | P0=10 | hard=2 | high=-5 | none=0 | **7** |
| Bean cascade delete | P1=8 | hard=2 | high=-5 | none=0 | **5** |

**Winner: PR D (Parchment Console/Docs Consolidation)**

Three-way tie at 16. Strategy alignment breaks it: PR D is the next unblocked step in the active Parchment Platform sequence (PR A = principal foundation, landed PR #180 yesterday). The cosmetic P2 items don't unblock anything downstream. PR D directly unblocks PR E (docs respin) and removes an active product inconsistency — the header says "Parchment API" but navigates to `/api-dashboard`.

PR B (catalog cutover) scores 14 but carries medium implementation risk because the `/v1/catalog` handler is currently `status: not-yet-implemented` and requires careful migration of existing callers. PR D is scoped to routing, naming, and nav — achievable in one clean PR without touching business logic.

Note: PR C (role simplification) is excluded despite P0 priority — it requires Supabase schema changes and is hard complexity with high rollback risk. Not an easy win.

---

## Why now

PR A (principal foundation) merged yesterday as PR #180. The platform naming sequence is now unblocked. The current state is inconsistent:

- The public `UnifiedHeader` and `Navbar` say "Parchment API" but link to `/api-dashboard`
- `/api/docs` redirects authenticated users to `/api-dashboard/docs` on page load
- `/api-dashboard` title reads "API Dashboard - Purveyors" (old product name)
- `/api-dashboard/docs` title reads "API Documentation - Purveyors Dashboard" (old)
- No `/docs` route exists yet
- Two competing docs surfaces: `/api/docs` (login gate) and `/api-dashboard/docs` (logged-in content)

This inconsistency is visible to users and creates product positioning confusion at the API surface, which is the revenue-generating tier.

CLI cross-check: recent `purveyors-cli` PRs #54-#56 are structural/filter improvements with no naming implications here. The docs consolidation is coffee-app-only.

---

## Strategy Alignment Audit

### Active strategy themes from current context

1. **Parchment Platform is the product identity for the developer/API tier.** PR A established `resolvePrincipal()` and the `/v1` namespace under the Parchment brand. PR D makes the naming legible in the product UI without changing the underlying architecture.

2. **Public discoverability and conversion are top-of-funnel priorities.** The `/api` marketing page and the logged-in API console are two stops on the developer conversion funnel. If they look like different products with different names, the funnel leaks.

3. **Single canonical docs tree eliminates cognitive load.** "Inference Is in the Name" (blog) argues for deterministic, low-branching surfaces. Two competing docs routes are exactly the kind of unnecessary branching the platform philosophy argues against.

4. **"Who Profits When Coffee Data Stays Scarce?" and the PPI plan position Purveyors as market-intelligence infrastructure.** The developer tier is the monetization vehicle for that positioning. A clean, named developer console supports that narrative.

5. **No active blog outline conflicts with this work.** The `why-same-coffee-costs-20-and-6.md` outline is about pricing data; the `sycophancy` post was about agentic code quality. Neither is affected by the naming/routing change.

### Verdict

**Strongly aligned.** This is the logical second step in the Parchment Platform sequence and removes an active naming inconsistency at the revenue surface. No contradictions with current strategy.

### Contradictions / caveats

- PR C (role simplification) and PR E (docs respin/content) remain blocked on each other in the full sequence. PR D can land independently between A and those.
- The `/docs` route created here will have minimal content until PR E rewrites the doc pages. That's acceptable: a redirect from `/api-dashboard/docs` to `/docs` (which itself shows the docs content) is the right bridge.

---

## Scope

### In scope

- Create `/docs` as the canonical documentation route
  - Move or duplicate the content from `/api-dashboard/docs/+page.svelte` into `/docs/+page.server.ts` + `/docs/+page.svelte`
  - The docs content stays the same for now; PR E will rewrite it against the corrected architecture
- Redirect `/api-dashboard/docs` to `/docs` (SvelteKit `redirect` in `+page.server.ts`)
- Rebrand `/api-dashboard` UI copy:
  - Page title: "Parchment Console - Purveyors" (was "API Dashboard - Purveyors")
  - Page heading: "Parchment Console" (was "API Dashboard")
  - Subheading copy: "Manage your Parchment API keys, monitor usage, and access documentation"
  - Back-nav links from `/api-dashboard/docs` that say "← Back to Dashboard" should update to "← Back to Console"
- Update `UnifiedHeader.svelte`: `apiNavTarget` should point to `/api-dashboard` (unchanged), but add an active path check for `/docs` as well
- Update `Navbar.svelte`: similar active-path check to include `/docs`
- Update `/api/docs/+page.svelte`: authenticated redirect should go to `/docs` (was `/api-dashboard/docs`)
- Update page metadata (`<title>`, `<meta name="description">`) in affected pages to use Parchment Console naming

### Out of scope

- Rewriting any docs content (that's PR E)
- URL-renaming `/api-dashboard` to `/parchment` or `/console` (that's a larger breaking change requiring auth redirects)
- PR C role simplification
- PR B catalog cutover
- Any CLI changes
- Any DEVLOG edits

---

## Proposed UX behavior

1. **`/docs`** is the new canonical docs URL. Unauthenticated users see a login gate (same as today's `/api/docs`). Authenticated users see the full docs page (same content as today's `/api-dashboard/docs`).

2. **`/api-dashboard/docs`** redirects to `/docs` (HTTP 308 Permanent Redirect via SvelteKit `redirect(308, '/docs')`). Bookmarks and old links continue to work.

3. **`/api/docs`** redirects authenticated users to `/docs` (was `/api-dashboard/docs`). Anonymous users still see the login-gate landing.

4. **`/api-dashboard`** heading changes from "API Dashboard" to "Parchment Console". The route path stays the same; the URL is not changing.

5. **Nav links** (`UnifiedHeader` and `Navbar`): "Parchment API" label stays (it links to `/api` marketing for anonymous users, `/api-dashboard` for authenticated). Active state detection adds `/docs` to the match pattern so it doesn't go dark when viewing docs.

---

## Files to change

1. **`src/routes/docs/+page.server.ts`** (new)
   - Copy auth logic from `/api-dashboard/docs/+page.server.ts`
   - If not authenticated, redirect to `/api/docs` (login gate) rather than embedding the gate here
   - Or: include the gate inline (simpler, matches current `/api/docs` pattern)

2. **`src/routes/docs/+page.svelte`** (new)
   - Move content from `/api-dashboard/docs/+page.svelte`
   - Update title to "Parchment API Documentation"
   - Update internal back-link from "← Back to Dashboard" to "← Back to Console"
   - Internal links from docs to `/api-dashboard` should update to say "Back to Parchment Console"

3. **`src/routes/api-dashboard/docs/+page.server.ts`**
   - Replace content with `redirect(308, '/docs')`
   - Remove auth check (redirect unconditionally; `/docs` handles auth)

4. **`src/routes/api-dashboard/docs/+page.svelte`**
   - Can be emptied or removed; redirect fires server-side so this page should never render

5. **`src/routes/api-dashboard/+page.svelte`**
   - Page heading: "API Dashboard" → "Parchment Console"
   - Any descriptive copy referencing "API Dashboard" updated to "Parchment Console"
   - `onMount` document.title: "Parchment Console - Purveyors"

6. **`src/routes/api/docs/+page.svelte`**
   - `goto('/api-dashboard/docs')` → `goto('/docs')`
   - `document.title`: "Parchment API Documentation" (already correct, no change)

7. **`src/lib/components/layout/UnifiedHeader.svelte`**
   - `isApiNavActive`: add `|| currentPath.startsWith('/docs')` so the nav item stays active when on the docs route

8. **`src/lib/components/layout/Navbar.svelte`**
   - Same active-path update as UnifiedHeader to include `/docs`

9. **`src/routes/api-dashboard/usage/+page.svelte`** (check)
   - If "Back to Dashboard" link text exists, update to "Back to Console"

---

## API / data impact

- No API changes
- No database changes
- No CLI changes
- `/v1/+server.ts` documents the catalog resource as scaffolded; no change needed

---

## Acceptance criteria

- [ ] `GET /docs` returns the API documentation page for authenticated users
- [ ] `GET /docs` shows the login gate for unauthenticated users
- [ ] `GET /api-dashboard/docs` redirects (308) to `/docs` without rendering a page
- [ ] Authenticated users clicking docs link from `/api-dashboard` land on `/docs`
- [ ] `/api-dashboard` heading reads "Parchment Console" (not "API Dashboard")
- [ ] `/api-dashboard` page `<title>` reads "Parchment Console - Purveyors"
- [ ] `UnifiedHeader` "Parchment API" button active state is correct when path is `/api`, `/api-dashboard`, or `/docs`
- [ ] `Navbar` active state similarly covers `/docs`
- [ ] No dead internal links to `/api-dashboard/docs` outside the redirect itself
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:unit` passes

---

## Test plan

### Static / quality checks

- `pnpm check`
- `pnpm lint`
- `pnpm test:unit`

### Manual smoke checks

1. Signed out → visit `/api/docs` → confirm login gate renders, no redirect to `/api-dashboard/docs`
2. Signed out → visit `/docs` → confirm login gate or same gate, NOT raw docs content
3. Signed in → visit `/api-dashboard/docs` → confirm redirect fires, lands on `/docs`
4. Signed in → visit `/docs` → confirm docs content renders with updated back-link copy
5. Signed in → visit `/api-dashboard` → confirm heading reads "Parchment Console"
6. Check `UnifiedHeader` "Parchment API" button active state on `/docs`, `/api-dashboard`, `/api`

### Playwright

- Existing smoke tests for `/api` and `/api-dashboard` should still pass
- Add or note: verify `/api-dashboard/docs` redirects to `/docs`

---

## Risks and rollback

### Risks

1. **Active-path detection gap in nav**: If `/docs` isn't added to the active-path check, the "Parchment API" nav button goes dark when users are reading docs. Low impact but visible.
   - Mitigation: explicit check in both UnifiedHeader and Navbar.

2. **Stale internal links**: Other pages or components may hard-code `/api-dashboard/docs`. The redirect handles external links, but internal `goto()` calls or `<a href>` tags should be updated to `/docs` directly.
   - Mitigation: `grep -r "api-dashboard/docs"` before PR to catch remaining references.

3. **Docs content for unauthenticated users**: Today `/api/docs` shows a "login to access docs" gate. If `/docs` instead requires auth and throws a 303 redirect to login, anonymous users who navigate directly to `/docs` end up on the auth page with no context.
   - Mitigation: replicate the login gate from `/api/docs` inline in `/docs/+page.svelte` so the anonymous path is graceful.

### Rollback

Straightforward: revert the route files and nav changes. No database or API state needs unwinding. The redirect means no bookmarks are broken even mid-rollback.

---

## Open questions for Reed

1. **URL path for the console itself**: Should `/api-dashboard` be renamed to `/console` or `/parchment` as part of this PR, or keep the path and just rename the copy? The current plan keeps the path unchanged to minimize redirect surface. Is that the right call?

2. **Unauthenticated `/docs` behavior**: Should `/docs` replicate the "login to access docs" gate from `/api/docs` inline (so there's one unified docs URL for everyone), or should `/docs` require auth and redirect anonymous users to `/api/docs`? The inline gate is simpler and cleaner for SEO.

3. **API key example in docs**: The `/api-dashboard/docs` server load personalizes the example API key for authenticated users. Should `/docs` preserve that personalization (requires the same server load), or simplify to a generic placeholder key? Keeping it adds ~10 lines of server load; generic is simpler.

4. **PR C dependency**: This plan treats PR D as independent of PR C (role simplification). Is that correct, or should PR D wait for PR C to avoid docs referencing pseudo-role names like `api-member` in rate limit tables?
