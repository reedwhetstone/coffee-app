# PR #376 Verification: Dashboard Intelligence Home

VERDICT: ready_with_fixes
P0: 0
P1: 0
P2: 1
P3: 1
NEXT_ACTION: patch_same_pr
CONFIDENCE: medium
SCOPE_ASSESSMENT: mergeable

## Summary

PR #376 mostly satisfies the stated intent. The dashboard is now centered on Parchment Intelligence, market analytics, catalog research, Ask/chat, Portfolio, and Mallard Studio as a roaster-side context layer rather than the umbrella product. The slice is independently mergeable from a product and implementation-boundary perspective. It does not require backend, schema, billing SKU, or persistence follow-up to make sense.

The only merge-friction finding is test brittleness introduced in the smoke suite: the dashboard E2E now asserts on a section that is only conditionally rendered when live recent-arrival data exists. That is not a product-boundary problem, but it can create false CI failures in environments where catalog fetches fail, return zero rows, or use a different seed. There is also a low-severity accessibility/UX polish issue around rendering the non-action reports direction card as a button that does nothing.

## Scope and evidence reviewed

Reviewed:

- `.verify-pr/20260607T135551Z-feat-dashboard-intelligence-home/metadata.txt`
- `.verify-pr/20260607T135551Z-feat-dashboard-intelligence-home/changed_files.txt`
- `.verify-pr/20260607T135551Z-feat-dashboard-intelligence-home/diffstat.txt`
- `.verify-pr/20260607T135551Z-feat-dashboard-intelligence-home/commits.txt`
- `.verify-pr/20260607T135551Z-feat-dashboard-intelligence-home/full.diff`
- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/003-public-analytics-three-chart-free-gate.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- Changed files in repo context:
  - `src/lib/dashboard/intelligenceHome.ts`
  - `src/lib/dashboard/intelligenceHome.test.ts`
  - `src/routes/dashboard/+page.svelte`
  - `tests/e2e/smoke.spec.ts`
- Adjacent integration surfaces:
  - `src/routes/+layout.server.ts`
  - `src/routes/+layout.svelte`
  - `src/routes/beans/+page.server.ts`
  - `src/lib/services/portfolioAccess.ts`
  - chat and portfolio entitlement references found through repo search

## Product alignment

Confirmed alignment:

- `notes/PRODUCT_VISION.md` defines Purveyors as a green coffee supply-chain intelligence platform, not just a marketplace and not a roasting tool. The new dashboard hero copy in `src/routes/dashboard/+page.svelte:40-49` matches that direction.
- The first dashboard section is `Parchment Intelligence`, followed by `Portfolio`, `Mallard Studio`, and `Developer` in `src/lib/dashboard/intelligenceHome.ts:38-60`. This satisfies the requested hierarchy.
- The primary Parchment cards are Market Index, Catalog and supply research, Ask Parchment, and Intelligence reports in `src/lib/dashboard/intelligenceHome.ts:63-95`. That directly matches the requested primary paths.
- Portfolio is reframed as a tracked coffee panel rather than generic inventory in `src/lib/dashboard/intelligenceHome.ts:97-106`.
- Mallard Studio is framed as roast/profit context, including explicit copy that roast profiles are context and not the umbrella product in `src/lib/dashboard/intelligenceHome.ts:108-126`.
- Viewer, Parchment Intelligence-only, Mallard Studio-only, and combined states are covered by `getDashboardUpgradePrompt` in `src/lib/dashboard/intelligenceHome.ts:184-221` and by unit expectations in `src/lib/dashboard/intelligenceHome.test.ts`.
- The implementation respects the no-backend/no-schema/no-billing/no-persistence constraint. The change is presentation and shared dashboard model only.

Relevant tension, but not a defect:

- The dashboard still includes a Developer section with API console/docs. This is acceptable because `notes/PRODUCT_VISION.md` treats API and machine access as core product surfaces. It is lower in the section order, so it does not dilute the requested primary dashboard emphasis.

## Findings

### P2: Dashboard smoke test now depends on mutable recent-arrival data

**Evidence:**

- `src/routes/dashboard/+page.svelte:198-224` only renders the `Latest supply signals` section when `data.recentArrivals?.length > 0`.
- `tests/e2e/smoke.spec.ts:130-139` unconditionally expects the `Latest supply signals` heading to be visible.
- `src/routes/dashboard/+page.server.ts` catches catalog-loading errors and returns an empty `recentArrivals` array, so the route can intentionally render without that section.

**Why it matters:**

The smoke test is supposed to prove the protected dashboard loads, not prove live catalog state. This assertion can fail in a clean seed, degraded Supabase/API state, or any environment where `searchCatalog` returns no rows. The page behavior is intentionally resilient, but the test turns optional data into a required contract.

**Correction:**

Patch `tests/e2e/smoke.spec.ts` to assert stable dashboard structure only. Good options:

- Remove the unconditional `Latest supply signals` assertion.
- Replace it with a structural body/no-server-error assertion.
- If the recent-arrival section must be tested, create a separate data-controlled test or assert it only when the heading is present after checking response/data conditions.

Recommended minimal patch:

```ts
await expect(page.getByRole('heading', { name: 'Mallard Studio' })).toBeVisible();
await expect(page.locator('body')).not.toContainText('Internal Server Error');
```

### P3: The coming-soon reports card is rendered as a no-op button

**Evidence:**

- Cards are always rendered as `<button>` in `src/routes/dashboard/+page.svelte:143-191`.
- `openCard` returns immediately for `card.status === 'coming-soon'` in `src/routes/dashboard/+page.svelte:24-31`.
- The `Intelligence reports` card has no `href`, so `resolveCardStatus` returns `coming-soon` in `src/lib/dashboard/intelligenceHome.ts:89-95` and `src/lib/dashboard/intelligenceHome.ts:154-159`.

**Why it matters:**

A focusable button that performs no action is a mild accessibility and UX footgun. Keyboard users and screen readers receive a control affordance, but activation silently does nothing. The copy is honest and product-aligned, so this is polish rather than a merge blocker.

**Correction:**

Render non-action cards as a non-interactive element, or add `aria-disabled="true"` and avoid presenting them as actionable. The cleanest implementation is a small card component or conditional element choice in `+page.svelte`:

- `button` for `ready` and `locked` cards.
- `article` or `div` for `coming-soon` cards, preserving the same visual layout.

## Acceptance criteria assessment

- Reframe `/dashboard` from generic launcher to Intelligence Home: satisfied.
- Emphasize Parchment Market Index, catalog/supply research, Ask/chat, reports/intelligence direction: satisfied.
- Portfolio as tracked/owned coffee panel: satisfied.
- Mallard Studio as roasting context/add-on: satisfied.
- Viewer, Parchment Intelligence, and Mallard Studio tier-specific prompts: satisfied.
- No backend/schema/billing SKU/persistence work: satisfied.
- Independently mergeable if later analytics PRs never land: satisfied.

## Validation

- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `pnpm test src/lib/dashboard/intelligenceHome.test.ts && pnpm check`: VALIDATION_BLOCKED_ENV. The worktree has no `node_modules`, so `vitest` was not found.
- `PATH=/root/.openclaw/workspace/repos/coffee-app/node_modules/.bin:$PATH vitest run src/lib/dashboard/intelligenceHome.test.ts`: VALIDATION_BLOCKED_ENV. Reusing the primary checkout's binary still failed because the worktree lacks generated `.svelte-kit` config and local ESM dependency resolution for `vitest` from `vite.config.ts`.

## Final recommendation

Patch the brittle smoke assertion in the same PR. The no-op reports card can be patched now if convenient, but it is acceptable as a follow-up. After the smoke assertion is corrected, this PR should be merge-ready assuming CI passes.
