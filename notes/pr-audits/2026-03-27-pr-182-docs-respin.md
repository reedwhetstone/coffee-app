# PR #182 Audit: Docs Respin Post-Cutover

## Metadata

- Repo: /root/.openclaw/workspace/repos/coffee-app
- Base: origin/main
- Head: HEAD
- PR # (if available): 182
- Reviewer model: anthropic/claude-opus-4-6
- Confidence: High
- Scope note: Full PR verification audit covering the new shared `/docs` tree, legacy docs redirects, touched public discovery surfaces, and auth/routing alignment checks against actual route handlers. `pnpm check` passed locally with 0 errors and 0 warnings.

## Executive Verdict

- Merge readiness: Not ready
- Intent coverage: Partial
- Priority summary: P0: 0, P1: 2, P2: 2, P3: 1

This PR gets the broad structure right: the shared `/docs` tree exists, the content is substantially improved, naming is mostly aligned, and the legacy `/api-dashboard/docs` path now redirects to `/docs`. The two biggest misses are both directly tied to the stated intent: the docs still misstate the auth/public reality of `/api/catalog`, and the supposedly canonical `/docs` destination is still absent from the repo's public discovery surfaces (`sitemap.xml` and `llms.txt`).

## Intent Verification

- Stated intent:
  - Replace the stale split docs model with a shared `/docs` tree.
  - Make `/docs` the canonical public docs location.
  - Redirect legacy `/api-dashboard/docs` to `/docs`.
  - Align touched public/docs surfaces with the approved Parchment naming hierarchy.
  - Accurately distinguish the stable public API contract from internal app surfaces.
  - Preserve public-route/auth behavior.

- What was implemented:
  - New shared docs content source at `src/lib/docs/content.ts` and shared renderer at `src/lib/components/docs/DocsShell.svelte`.
  - Public docs landing page at `src/routes/docs/+page.svelte` plus section and slug routes under `src/routes/docs/[section]/...`.
  - Legacy redirects for `/api/docs` and `/api-dashboard/docs`.
  - Updated `/api` product page, console labels, README, and AGENTS docs.
  - Public shell/header handling updated so `/docs` uses the public layout.

- Coverage gaps:
  - `/docs` is not yet treated as the canonical public docs location in `sitemap.xml` or `llms.txt`.
  - The docs still contain a material auth/surface mismatch for `/api/catalog`, which is exactly the distinction this PR was supposed to clarify.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

- **Title:** `/api/catalog` auth model is described inconsistently and inaccurately in the new docs
- **Evidence:**
  - `src/lib/docs/content.ts:168-171` correctly says `/api/catalog` is used by “Web session or public page usage”.
  - The same file then says `GET /api/catalog` is “session-oriented” at `src/lib/docs/content.ts:248-249`.
  - The route handler itself has no session or role gate at all; it is a plain `GET` handler over `supabase` in `src/routes/api/catalog/+server.ts:16-116`.
  - The public catalog UI fetches that endpoint from client code via `fetch(`/api/catalog?...`)` in `src/lib/stores/filterStore.ts:143-145`.
- **Impact:**
  - This is a direct miss against the PR's stated requirement to accurately distinguish the stable public API contract from internal app surfaces and preserve auth/public-route behavior.
  - External readers get a muddled story: the docs both say `/api/catalog` supports public page usage and say it is session-oriented.
  - The real distinction is not “session vs non-session”; it is “publicly callable for first-party pages but not a stable external contract”. The current copy blurs that.
- **Correction:**
  - Rewrite the `/api/catalog` copy in `src/lib/docs/content.ts` so it consistently says:
    - `/api/catalog-api` is the stable external API-key contract.
    - `/api/catalog` is a first-party web-app route that is publicly callable by site pages, but is not a compatibility promise for external integrators.
  - Update the overview table, catalog intro, and warning callout together so they stop contradicting each other.

- **Title:** `/docs` is not actually canonical in the public discovery surfaces this PR touched
- **Evidence:**
  - `src/routes/sitemap.xml/+server.ts:60-74` includes `/api` and `/api-dashboard`, but no `/docs` entry at all.
  - `src/routes/llms.txt/+server.ts:17-26` lists Market Analytics, Coffee Catalog, Blog, Parchment API, and Parchment Console, but does not list `/docs`.
  - `src/routes/docs/+page.svelte:18-23` explicitly positions `/docs` as the unified documentation home.
- **Impact:**
  - This misses the intent to make `/docs` the canonical public docs location.
  - Search engines and LLM crawlers are still pointed at the marketing page and an authenticated console page instead of the new public docs tree.
  - Because `sitemap.xml` still advertises `/api-dashboard` while omitting `/docs`, public discoverability remains biased toward the wrong surface.
- **Correction:**
  - Add `/docs` to `src/routes/sitemap.xml/+server.ts`.
  - Also add at least `/docs/api/overview` and `/docs/cli/overview`; ideally emit all docs slugs from `DOCS_NAV` / docs content.
  - Add a first-class docs entry to `src/routes/llms.txt/+server.ts`, and consider demoting or removing `/api-dashboard` from public discovery copy since it is authenticated.

### P2 (important improvements)

- **Title:** Public CTAs send signed-out users to `/api-dashboard`, which the auth guard immediately redirects to `/catalog`
- **Evidence:**
  - The public API page exposes an unconditional “Open Parchment Console” CTA wired to `goto('/api-dashboard')` in `src/routes/api/+page.svelte:44-56`.
  - The public docs home exposes a direct `/api-dashboard` card in `src/routes/docs/+page.svelte:79-86`.
  - Public docs related links also point to `/api-dashboard` in `src/lib/docs/content.ts:227-231`.
  - Unauthenticated access to `/api-dashboard` is redirected to `/catalog` by the auth guard at `src/hooks.server.ts:145-146`.
- **Impact:**
  - This does not break auth, but it does create a confusing public flow: documentation and product pages invite the user into Parchment Console, then the router dumps them onto the catalog instead of a sign-in or onboarding path.
  - That weakens the “public-route/auth behavior is preserved” story on the user-facing side, especially now that docs are central to the API funnel.
- **Correction:**
  - Make these CTAs session-aware.
  - For signed-out users, route to `/auth` with a return target, or to `/api` with explanatory copy.
  - Reserve the direct `/api-dashboard` target for already-authenticated sessions.

- **Title:** There is no targeted test coverage for the new docs route graph or legacy redirect behavior
- **Evidence:**
  - Test files in the repo currently cover catalog API, auth/principal, roast, and pricing helpers, but nothing under `/docs` or the new legacy docs redirects.
  - Search results show route files for `/docs`, `/api/docs`, and `/api-dashboard/docs`, but no corresponding tests.
- **Impact:**
  - This PR moves public route behavior into a new docs tree and adds redirect logic in both route files and hooks.
  - Without even a small redirect/route smoke suite, future refactors can silently break canonicalization, section defaulting, or unauthenticated access.
- **Correction:**
  - Add route tests for:
    1. `/docs/[section]` redirecting to the default slug,
    2. `/api/docs` redirecting to `/docs/api/overview`,
    3. `/api-dashboard/docs` redirecting to `/docs` without requiring a session,
    4. invalid docs section/slug returning 404.

### P3 (nice to have)

- **Title:** Legacy `/api-dashboard/docs` redirect logic is duplicated in two places
- **Evidence:**
  - Hook-level redirect in `src/hooks.server.ts:127-128`.
  - Route-level redirect in `src/routes/api-dashboard/docs/+page.server.ts:4-5`.
- **Impact:**
  - Low immediate risk, but this is two sources of truth for one behavior.
  - If the target ever changes, it can drift unless both are updated together.
- **Correction:**
  - Keep a single authoritative redirect path if possible, or at minimum add a comment/test that explains why both layers exist.

## Assumptions Review

- Assumption: Making `/docs` canonical only requires changing page routes and nav links.
- Validity: Invalid
- Why: Public discovery still flows through `sitemap.xml` and `llms.txt`, and both currently omit `/docs` while still surfacing `/api-dashboard`.
- Recommended action: Update discovery outputs alongside route-level docs changes.

- Assumption: `/api/catalog` can be described as “session-oriented” because it is first-party/internal.
- Validity: Invalid
- Why: The handler in `src/routes/api/catalog/+server.ts` does not require a session, and the public catalog uses it. Internal/non-contract does not equal session-auth.
- Recommended action: Separate “auth model” from “contract stability” in the copy.

- Assumption: Public users can meaningfully follow console CTAs from docs and API pages.
- Validity: Weak
- Why: Unauthenticated `/api-dashboard` requests are redirected to `/catalog`, not to auth or a console explainer.
- Recommended action: Make console CTAs state-aware or change the unauthenticated redirect target.

- Assumption: Redirect duplication for `/api-dashboard/docs` is harmless long term.
- Validity: Weak
- Why: It works today, but it creates needless maintenance coupling between hooks and route code.
- Recommended action: Consolidate or explicitly document the split.

## Tech Debt Notes

- Debt introduced:
  - The new docs source is a large code-defined content object in `src/lib/docs/content.ts` (1050+ lines). It is workable, but every copy update now lives in a single TypeScript blob with no schema/tests around factual consistency.

- Debt worsened:
  - Redirect behavior for legacy docs paths is now split between hooks and route files.
  - Public discovery metadata remains manually curated instead of derived from the docs source of truth, which is why `/docs` was easy to miss.

- Suggested follow-up tickets:
  - Derive sitemap docs entries from `DOCS_NAV` / docs page definitions.
  - Derive `llms.txt` docs entries from the same source so canonical docs paths cannot drift.
  - Add a small docs routing test suite.

## Product Alignment Notes

- Alignment wins:
  - Naming is substantially better across `/api`, `/docs`, dashboard copy, README, and AGENTS.
  - The new docs do a much better job separating the external catalog contract from the broader platform story.
  - `/api-dashboard/docs` now hands off to the shared public docs tree instead of preserving the stale split-docs model.

- Misalignments:
  - The canonical docs path is still not the canonical discovery path.
  - Public copy invites users into Parchment Console without honoring the actual unauthenticated flow.
  - `/api/catalog` is still described in a way that conflates “non-contract” with “session-auth”.

- Suggested product checks:
  - Decide whether unauthenticated console intent should go to `/auth`, `/api`, or a public console explainer page.
  - Decide whether `/api-dashboard` belongs in public sitemap/LLM discovery at all.

## Test Coverage Assessment

- Existing tests that validate changes:
  - `pnpm check` passed locally with 0 errors and 0 warnings.
  - Existing auth/catalog tests provide some confidence that core API behavior remains intact.

- Missing tests:
  - No tests for `/docs` section redirects.
  - No tests for `/api/docs` or `/api-dashboard/docs` redirects.
  - No tests that protect the “public but non-contract” messaging around `/api/catalog`.
  - No tests for sitemap/llms output including canonical docs links.

- Suggested test additions:
  1. Redirect test coverage for `/api/docs` and `/api-dashboard/docs`.
  2. Docs section default-slug and invalid-slug coverage.
  3. Snapshot/assertion tests for `sitemap.xml` and `llms.txt` containing `/docs`.

## Minimal Correction Plan

1. Fix `src/lib/docs/content.ts` so `/api/catalog` is described consistently as a first-party/publicly callable web-app route that is not a stable external contract.
2. Update `src/routes/sitemap.xml/+server.ts` and `src/routes/llms.txt/+server.ts` so `/docs` is explicitly advertised as the canonical public docs entry point.
3. Make public console CTAs state-aware, or change the unauthenticated `/api-dashboard` handoff so users are not bounced to `/catalog` from docs/API pages.

## Optional Patch Guidance

- `src/lib/docs/content.ts`
  - Update the catalog intro (`/docs/api/catalog`) to replace “session-oriented” with language that distinguishes auth from stability.
  - Keep the overview table, intro paragraph, and warning callout aligned so they do not contradict each other.

- `src/routes/sitemap.xml/+server.ts`
  - Add `/docs` plus top-level docs entry pages.
  - Consider whether authenticated-only routes such as `/api-dashboard` and `/subscription/success` should remain listed in a public sitemap at their current priority.

- `src/routes/llms.txt/+server.ts`
  - Add a docs bullet such as “Parchment Docs” pointing to `/docs` and its API/CLI entry pages.
  - Avoid making the auth-walled console look like the primary public documentation resource.

- `src/routes/api/+page.svelte`, `src/routes/docs/+page.svelte`, `src/lib/docs/content.ts`
  - Route signed-out users to `/auth?next=/api-dashboard` or equivalent instead of linking them directly into a path that immediately redirects elsewhere.

- `src/hooks.server.ts` / `src/routes/api-dashboard/docs/+page.server.ts`
  - Consolidate the legacy docs redirect or add tests/comments to keep the two layers from drifting.
