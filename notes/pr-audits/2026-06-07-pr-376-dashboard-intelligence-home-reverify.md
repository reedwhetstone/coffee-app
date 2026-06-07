# PR #376 Re-verification: Dashboard Intelligence Home

VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 1
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable

## Summary

The same-PR patch fixed the prior P2. `tests/e2e/smoke.spec.ts` no longer asserts on `Latest supply signals`, which is a data-dependent section rendered only when `data.recentArrivals?.length > 0`. The smoke test now checks stable dashboard structure: Intelligence Home, Parchment Intelligence, Parchment Market Index, Ask Parchment, Mallard Studio, and the signed-in app nav.

The PR now satisfies the stated intent and is independently mergeable. The dashboard has been reframed as an Intelligence Home for green coffee supply-chain research, market analytics, and sourcing decisions. Portfolio is positioned as tracked coffee context. Mallard Studio is positioned as roaster-side context, not the umbrella product. Tier-specific prompts are present for viewer, Parchment Intelligence-only, Mallard Studio-only, and combined states. No backend, schema, billing SKU, or persistence work is introduced.

The remaining issue is the previously identified P3: the coming-soon Intelligence reports card still renders as a focusable button whose click handler returns without action. This is polish and accessibility debt, not a merge blocker for this slice.

## Evidence reviewed

Reviewed required artifacts from `.verify-pr/20260607T140447Z-feat-dashboard-intelligence-home/`:

- `metadata.txt`
- `changed_files.txt`
- `diffstat.txt`
- `commits.txt`
- `full.diff`

Reviewed prior report:

- `notes/pr-audits/2026-06-07-pr-376-dashboard-intelligence-home.md`

Reviewed product and decision context:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/003-public-analytics-three-chart-free-gate.md`
- `notes/decisions/005-catalog-access-level-positioning.md`

Reviewed verify references:

- `/root/.openclaw/workspace/skills/verify-pr/references/checklist.md`
- `/root/.openclaw/workspace/skills/verify-pr/references/review-output-template.md`

Inspected changed files in repo context:

- `src/lib/dashboard/intelligenceHome.ts`
- `src/lib/dashboard/intelligenceHome.test.ts`
- `src/routes/dashboard/+page.svelte`
- `tests/e2e/smoke.spec.ts`

Inspected adjacent integration surfaces:

- `src/routes/dashboard/+page.server.ts`
- `src/routes/+layout.server.ts`
- `src/hooks.server.ts`
- `src/lib/types/auth.types.ts`
- `src/lib/services/portfolioAccess.ts`
- `src/lib/components/layout/appNavigation.ts`

## Prior P2 recheck

### Resolved: dashboard smoke test no longer depends on mutable recent-arrival data

**Prior defect:**

- `src/routes/dashboard/+page.svelte:198-224` renders `Latest supply signals` only when `data.recentArrivals?.length > 0`.
- `src/routes/dashboard/+page.server.ts:7-17` catches catalog-loading errors and can intentionally return an empty `recentArrivals` array.
- The prior smoke assertion made that optional live-data section a required test contract.

**Patch evidence:**

- Current `tests/e2e/smoke.spec.ts:130-139` asserts stable dashboard structure only:
  - `Intelligence Home`
  - `Parchment Intelligence`
  - `Parchment Market Index`
  - `Ask Parchment`
  - `Mallard Studio`
  - signed-in auth menu count
- There is no remaining smoke assertion for `Latest supply signals`.

**Assessment:** fixed. The smoke test now validates the protected dashboard shell and product framing without depending on catalog arrival data.

## Product alignment

Confirmed alignment with `notes/PRODUCT_VISION.md`:

- Purveyors is framed as a green coffee supply-chain intelligence platform, not a generic marketplace or roasting tool.
- `src/routes/dashboard/+page.svelte:40-49` directly frames the page as an intelligence home for research, analytics, and sourcing decisions, with Mallard Studio beside it as roaster context.
- `src/lib/dashboard/intelligenceHome.ts:38-60` orders sections as Parchment Intelligence, Portfolio, Mallard Studio, Developer.
- `src/lib/dashboard/intelligenceHome.ts:63-95` centers the Parchment paths on Market Index, catalog/supply research, Ask Parchment, and reports direction.
- `src/lib/dashboard/intelligenceHome.ts:97-106` reframes Portfolio as a tracked coffee panel connected to actual lineup context.
- `src/lib/dashboard/intelligenceHome.ts:108-126` explicitly frames Mallard Studio as roast and profit context, including copy that roast profiles are not the umbrella product.
- `src/lib/dashboard/intelligenceHome.ts:184-221` provides distinct prompts for viewer, Parchment Intelligence-only, Mallard Studio-only, and combined states.

Confirmed alignment with relevant ADRs:

- ADR-002 supports keeping Developer/API access visible as a machine-readable product surface, so the lower-priority Developer section is strategically consistent rather than product drift.
- ADR-003 positions `/analytics` as a primary public and Parchment Intelligence surface; making Market Index the first dashboard CTA is coherent.
- ADR-005 distinguishes public proof from member/Parchment workflow leverage; locked Ask and Portfolio cards for plain viewers match that access ladder.

## Mergeability and slice boundary

SCOPE_ASSESSMENT: mergeable.

This PR does not require later analytics reframe work to become coherent. Even if no follow-up ships, `/dashboard` now has a clear, self-contained product story:

1. Start with market and catalog research.
2. Use Ask and Portfolio when Parchment Intelligence or Mallard Studio access is available.
3. Treat Mallard Studio as roaster-side context.
4. Keep Developer/API access as a lower-priority machine surface.
5. Represent reports honestly as direction rather than fake shipped functionality.

No backend/schema/billing SKU/persistence dependency was introduced.

## Findings

### P3: Coming-soon Intelligence reports card is still rendered as a no-op button

**Evidence:**

- `src/lib/dashboard/intelligenceHome.ts:89-95` defines `Intelligence reports` without an `href`, so `resolveCardStatus` returns `coming-soon` at `src/lib/dashboard/intelligenceHome.ts:154-159`.
- `src/routes/dashboard/+page.svelte:143-191` renders every card as `<button type="button">`.
- `openCard` returns immediately for `card.status === 'coming-soon'` at `src/routes/dashboard/+page.svelte:24-25`.

**Impact:**

This leaves a focusable control that silently does nothing. It is mildly misleading for keyboard and screen-reader users. The copy itself is honest and product-aligned, so this is not a merge blocker.

**Suggested follow-up:**

Render `coming-soon` cards as non-interactive `article` or `div` elements, or mark them with a disabled/aria-disabled pattern that does not advertise an action.

## Validation

- `git diff --check origin/main...HEAD`: VALIDATION_PASS.
- `set -a; . ./.env.test.example; set +a; ln -s /root/.openclaw/workspace/repos/coffee-app/node_modules node_modules; pnpm check`: VALIDATION_PASS, `svelte-check found 0 errors and 0 warnings`; temporary `node_modules` symlink and generated `.svelte-kit` were removed afterward.
- `set -a; . ./.env.test.example; set +a; ln -s /root/.openclaw/workspace/repos/coffee-app/node_modules node_modules; pnpm run sync; pnpm exec vitest run --config .verify-pr/vitest.dashboard-reverify.config.ts src/lib/dashboard/intelligenceHome.test.ts`: VALIDATION_PASS, 6 tests passed; temporary no-plugin Vitest config, `node_modules` symlink, and generated `.svelte-kit` were removed afterward.

Harness note: the repo's default Vitest config in this detached worktree still hits the known cross-worktree `@testing-library/svelte/vite` resolution issue when using the primary checkout's `node_modules`. A focused temporary config was used for the plain TypeScript dashboard helper test so the new helper logic could still be verified without installing dependencies.

## Final recommendation

Ready for merge. Optional follow-up: make the coming-soon reports card non-interactive or explicitly disabled, but do not block this PR on that polish item.
