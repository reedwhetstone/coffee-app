# PR #379 Verification Audit: Catalog Intelligence Connective Tissue

**Date:** 2026-06-09
**Repo:** `/root/.openclaw/workspace/worktrees/coffee-app-catalog-intel-1780969503`
**Base:** `origin/main`
**Head:** `HEAD`
**PR:** https://github.com/reedwhetstone/coffee-app/pull/379

## Operator summary

VERDICT: ready_with_fixes
P0: 0
P1: 2
P2: 1
P3: 0
NEXT_ACTION: patch_same_pr
TOP_FIXES:
- Make the supplier-comparison analytics path real and honest for non-Parchment-Intelligence users, not just a dangling hash.
- Remove the remaining anonymous catalog claim that a free account lets users save sourcing research.
- Strengthen tests so they catch the honest-path and no-saved-workflow requirements, not only static link hrefs.

## Verdict

The slice boundary is correct and independently mergeable in principle. The implementation is frontend-only, avoids backend/schema/persistence changes, improves the catalog frame, adds concrete supply-evidence copy, preserves shareable filtered context, and adds test coverage for the new hero and empty state.

It is not merge-ready yet because two acceptance-critical honesty issues remain on `/catalog`:

1. The new supplier-comparison link can be a dead or misleading path for anonymous/viewer users because `/analytics#supplier-comparison` only renders an element with that id for Parchment Intelligence users.
2. The anonymous catalog upsell still promises users can “save sourcing research,” even though the plan explicitly says saved/watch/shortlist workflows are future and unsupported UI must not imply saved state.

These are patch-same-PR issues, not rescope issues. No backend work is needed.

## Scope inspected

Changed files:

- `notes/implementation-plans/2026-05-08-analytics-intelligence-reframe.md`
- `src/routes/catalog/+page.svelte`
- `src/routes/catalog/page.svelte.test.ts`

Additional context read:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `src/routes/analytics/+page.svelte`
- `src/routes/catalog/+page.server.ts`
- `src/lib/server/catalogAccess.ts`

Validation run:

- `pnpm test src/routes/catalog/page.svelte.test.ts --run` -> pass, 8 tests
- `pnpm check` -> pass, 0 errors, 0 warnings

## Product alignment

Strong overall direction:

- The hero now positions the catalog as the row-level supply substrate behind Parchment Market Index reads, which aligns with `notes/PRODUCT_VISION.md` and the PR 05 goal.
- The new evidence cards are truthful if read literally: total active rows, origins shown on the current page, suppliers shown on the current page, and priced rows shown. They do not invent analytics or persistence.
- The empty state routes users toward broader market evidence instead of pretending a saved workflow exists.
- The member/viewer prompt explicitly says watchlists and saved shortlists are future workflows, which is exactly the right correction after the PR #378 CTA caution.
- No backend query, schema, persistence, entitlement, or saved-object behavior changed.

The remaining problems are localized copy and link honesty, not strategic misalignment.

## Findings

### P1: Supplier comparison link is not a guaranteed concrete analytics path

**Evidence:** `src/routes/catalog/+page.svelte` adds an unconditional link:

```svelte
<a href="/analytics#supplier-comparison">Review supplier comparison evidence</a>
```

But `src/routes/analytics/+page.svelte` renders the `id="supplier-comparison"` element only in the `{:else}` branch when `isParchmentIntelligence` is true. Non-Parchment-Intelligence users see the blurred premium preview branch, which does not include that id. That means anonymous/viewer users clicking the catalog CTA do not land on a concrete supplier-comparison module. At best they land at the top of analytics; at worst the link reads like access to evidence that is not actually present.

**Why it matters:** PR 05 explicitly needed to avoid PR #378's hand-wavy CTA problem by creating concrete evidence paths. This link is close, but for non-entitled users it is not currently concrete or honest.

**Suggested fix:** Make the analytics destination stable for all access states, then keep entitlement messaging honest. Options:

- Add a stable `id="supplier-comparison"` wrapper around the supplier comparison section for both the locked preview and entitled module, and adjust copy so non-entitled users understand they are seeing the gated comparison path, not full evidence.
- Or gate/change the catalog link label based on `data.ppiAccess`, using `/analytics` for non-entitled users and `/analytics#supplier-comparison` for entitled users.

No backend change is needed.

### P1: Anonymous catalog still claims unsupported saved research

**Evidence:** `src/routes/catalog/+page.svelte` still contains this anonymous CTA copy:

```svelte
Create a free account to browse the full catalog, save sourcing research, and unlock the next step after public market discovery.
```

This line was preexisting, but PR 05 is specifically the catalog copy and CTA honesty pass. The implementation plan says current researched/tracked/watched/shortlisted Portfolio coffees require a future saved-object model, and unsupported actions must not claim saved/watch/shortlist/export success. The new non-member prompt fixes this problem in one place, but the anonymous CTA leaves the same product promise alive lower on the page.

**Why it matters:** This is the exact category of fake capture/persistence claim the program is trying to remove. It undercuts the otherwise strong copy that says watchlists and saved shortlists are future workflows.

**Suggested fix:** Replace “save sourcing research” with something the app actually supports today, for example:

- “Create a free account to browse the full catalog and inspect more supply evidence after public market discovery.”
- “Create a free account to browse the full catalog, share filtered context, and continue from public market discovery.”

If “share filtered context” is used, ensure the copy does not imply persisted saved searches.

### P2: Tests cover static catalog copy but not the actual cross-surface honesty contract

**Evidence:** The new tests in `src/routes/catalog/page.svelte.test.ts` assert the hero copy and that the supplier comparison link has `href="/analytics#supplier-comparison"`. They do not catch whether `/analytics#supplier-comparison` actually has a target for non-Parchment-Intelligence users, and they do not protect against saved/workflow claims remaining in the anonymous CTA.

**Why it matters:** The PR 05 acceptance criteria are not just “link exists.” They are “honest links into existing analytics reads” and “no saved/watch/shortlist success claims.” The current tests would pass even with the two P1 issues above.

**Suggested fix:** Add at least one of:

- A catalog test asserting unsupported saved workflow language is absent from the anonymous CTA.
- An analytics test asserting the supplier-comparison anchor is present in the non-entitled analytics preview branch, if the chosen fix is a stable anchor.
- A catalog test that expects non-entitled link copy to be framed as a gated path rather than full supplier evidence, if the chosen fix is entitlement-aware copy.

## Acceptance criteria assessment

- **Independently mergeable if PR 06 never ships:** Yes after the P1 patches. The slice does not depend on Mallard boundary cleanup.
- **No backend schema/query changes, persistence, saved watchlists, fake shortlist/export success, or new entitlement behavior:** Mostly yes. No code behavior changes violate this, but the anonymous CTA still claims unsupported saved research.
- **Catalog copy positions the catalog as the supply substrate behind intelligence decisions:** Yes.
- **Catalog links into analytics through concrete market-index and supplier-comparison paths:** Partially. `/analytics` is concrete. `/analytics#supplier-comparison` is not concrete for non-entitled users because the anchor is only present in the entitled branch.
- **Empty state routes users toward broader market evidence instead of pretending a saved workflow exists:** Yes.
- **Tests cover catalog hero copy and an analytics link path:** Yes at a basic level, but insufficient for the real cross-surface contract.

## Integration risk

Low technical risk:

- `pnpm check` passes.
- Focused catalog test passes.
- No server load, database, entitlement, persistence, or API code changed.
- New derived counts are computed from displayed catalog rows and are low-cost at page sizes currently in use.

Moderate UX/product risk if unpatched:

- The supplier comparison CTA can feel like a dead hash link for free users.
- The remaining saved-research copy keeps the catalog slightly in the fake workflow theater the program is trying to remove.

## Recommendation

Patch the two P1 issues in the same PR, add a small test guard, then re-run:

- `pnpm test src/routes/catalog/page.svelte.test.ts --run`
- `pnpm check`

After those pass, this PR should be merge-ready.
