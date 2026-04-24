# Implementation Plan: Roast Darkness Token

**Date:** 2026-04-06
**Repo:** coffee-app only
**Estimated complexity:** Easy
**Risk:** Low

---

## Feature

Integrate a "roast darkness token" — a readable label (e.g. "Light", "Medium", "Dark") derived from weight loss percentage — into the /roast and /beans display surfaces.

The DEVLOG explicitly defines the lookup table:

| Weight Loss | Label         |
| ----------- | ------------- |
| <11%        | Under-roasted |
| 11–13%      | Light         |
| 14–16%      | Medium        |
| 17–18%      | Dark          |
| 19–21%      | Very Dark     |
| >22%        | Dangerous     |
| null/N/A    | — (omit)      |

---

## Why Now

- DEVLOG P5/P6 item, clearly scoped, no DB changes, no external dependencies
- Highest scoring easy-win after completion reconciliation (score: 14 vs next-best at ≤8)
- Weight loss % is already calculated and displayed in both `/roast` and `/beans` — this adds one utility function and a few display lines
- Supports the platform's "make roasting data accessible to beginners" theme (non-experts learn what weight loss means)

---

## Strategy Alignment Audit

**Active strategy themes from blog + DEVLOG:**

1. AI-first workspace / data-driven coffee sourcing (blog: "who-profits-when-data-stays-scarce", "why-ai-first-coffee-platform")
2. Public conversion funnel — free users see catalog, members get full tools
3. Risk-aware sourcing and product transparency
4. Beginner accessibility — "Improve UI to demystify roasting process" (P6 explicit item)
5. Data products (PPI) — build trust by making roast analytics intuitive

**Alignment verdict: Aligned**

The darkness token directly serves theme 4 (demystify roasting) and theme 3 (transparency of results). A roaster who sees "17.2% — Dark" understands their output at a glance; "17.2%" alone requires external lookup. The DEVLOG also has an explicit P6 item "Improve UI to demystify roasting process — terms like Maillard and FC Start are confusing for beginners. Add explanatory tooltips and learning funnels." The darkness token is a lightweight step in this direction.

**No contradictions.** This is not a public-facing or conversion-funnel feature — it targets authenticated users (roasters) and improves their core workflow.

---

## Scope

**In scope:**

- Add `getRoastDarknessToken(weightLossPercent: number | null | undefined)` to `src/lib/utils/formatters.ts`
- Add a corresponding Vitest unit test to `src/lib/utils/formatters.ts` or its co-located test file (create `src/lib/utils/formatters.test.ts` if it doesn't exist)
- Wire the token into `src/routes/roast/RoastHistoryTable.svelte`:
  - Per-roast card: alongside the existing "Loss %" field
  - Batch summary row: alongside the existing "Avg Loss" field (use avg weight loss to derive token)
- Wire the token into `src/routes/beans/BeanProfileTabs.svelte`:
  - Per-roast card in the "Roasting" tab: alongside the existing "Loss: X.X%" display

**Out of scope:**

- Color coding or icon theming beyond the label (keep it text-only for now)
- Tooltips explaining each level (separate P6 item)
- Schema changes or new DB columns
- Changes to the catalog or public pages
- CLI changes (roast darkness is a display concern, not a data query concern)

---

## Proposed UX Behavior

**RoastHistoryTable per-roast card (current):**

```
Loss %        Drop Temp
14.3%         410°F
```

**After:**

```
Loss          Drop Temp
14.3% · Medium   410°F
```

Or as a badge/pill:

```
Loss %        Level        Drop Temp
14.3%         Medium       410°F
```

Lean toward the simpler inline approach (`14.3% · Medium`) to avoid adding a new cell.

**Batch summary row (current):**

```
Avg Loss: 14.3%
```

**After:**

```
Avg Loss: 14.3% · Medium
```

**BeanProfileTabs roasting tab per-roast button (current):**

```
Loss: 14.3%
```

**After:**

```
Loss: 14.3% · Medium
```

---

## Files to Change

| File                                        | Change                                                    |
| ------------------------------------------- | --------------------------------------------------------- |
| `src/lib/utils/formatters.ts`               | Add `getRoastDarknessToken()` function; export it         |
| `src/lib/utils/formatters.test.ts`          | Create (or extend) with unit tests for the new function   |
| `src/routes/roast/RoastHistoryTable.svelte` | Import + render token in per-roast card and batch summary |
| `src/routes/beans/BeanProfileTabs.svelte`   | Import + render token in roasting tab per-roast button    |

**Total files: 4** (3 non-test). Clean single-PR scope.

---

## API / Data Impact

None. `weight_loss_percent` is already fetched in all three display contexts:

- `RoastHistoryTable` — `calculateWeightLossPercentage()` already reads `profile.weight_loss_percent`
- `BeanProfileTabs` — `profile.weight_loss_percent` already rendered on line ~959

No new API routes, no new DB queries, no server changes.

---

## Implementation Sketch

```typescript
// src/lib/utils/formatters.ts

/**
 * Returns a human-readable roast darkness label based on weight loss percentage.
 * Lookup table from DEVLOG Weight Loss Reference Guide.
 * Returns null when weight_loss_percent is null/undefined (caller should omit display).
 */
export function getRoastDarknessToken(weightLossPercent: number | null | undefined): string | null {
	if (weightLossPercent == null) return null;
	if (weightLossPercent < 11) return 'Under-roasted';
	if (weightLossPercent <= 13) return 'Light';
	if (weightLossPercent <= 16) return 'Medium';
	if (weightLossPercent <= 18) return 'Dark';
	if (weightLossPercent <= 21) return 'Very Dark';
	return 'Dangerous';
}
```

In the table components:

```svelte
{@const token = getRoastDarknessToken(profile.weight_loss_percent)}
<p class="font-semibold text-red-500">
	{calculateWeightLossPercentage(profile)}{token ? ` · ${token}` : ''}
</p>
```

For the batch summary (avg weight loss is already a string like `"14.3"`):

```svelte
{@const avgToken = getRoastDarknessToken(parseFloat(batchSummary.avgWeightLoss))}
<p class="font-semibold text-red-500">
	{batchSummary.avgWeightLoss}%{avgToken ? ` · ${avgToken}` : ''}
</p>
```

---

## Acceptance Criteria

- [ ] `getRoastDarknessToken()` exported from `$lib/utils/formatters`
- [ ] Boundary coverage: 10.9 → "Under-roasted", 11.0 → "Light", 13.0 → "Light", 14.0 → "Medium", 16.0 → "Medium", 17.0 → "Dark", 18.0 → "Dark", 19.0 → "Very Dark", 21.0 → "Very Dark", 22.1 → "Dangerous", null/undefined → null
- [ ] Unit tests pass for all boundary cases
- [ ] Per-roast card in RoastHistoryTable shows `"14.3% · Medium"` style inline label
- [ ] Batch summary avg in RoastHistoryTable shows token inline
- [ ] Per-roast button in BeanProfileTabs roasting tab shows token inline
- [ ] When `weight_loss_percent` is null (no oz_in/oz_out or missing data), token is omitted entirely (no " · null" rendering)
- [ ] `pnpm lint` clean
- [ ] `pnpm check` clean
- [ ] Vitest passes
- [ ] Playwright E2E doesn't regress (no new selectors needed; this is additive text)

---

## Test Plan

**Unit (Vitest):**

- `src/lib/utils/formatters.test.ts` — test all 6 label outputs + null input + boundary edges
- Run: `pnpm vitest run src/lib/utils/formatters.test.ts`

**Visual (manual or E2E):**

- Navigate to `/roast`, expand a batch with existing oz_in/oz_out data, verify label appears
- Navigate to `/beans`, select a bean with roast history, check roasting tab
- Verify no label appears when weight_loss_percent is null

**Lint + Type check:**

- `pnpm lint && pnpm check`

---

## Risks and Rollback

**Risks:**

- Low. Pure display change. No data mutation, no API calls, no auth surface.
- Edge case: `calculateWeightLossPercentage()` can derive loss from oz_in/oz_out when `weight_loss_percent` is null; the token function will receive null and render nothing. Consistent behavior.

**Rollback:** `git revert` the PR. No DB state to undo.

---

## CLI Changes Needed?

No. This is a web-only display enhancement. The CLI's `listRoasts()` already returns `weight_loss_percent` in the schema; if CLI display of the token is desired later, it's a separate PR.

---

## Open Questions for Reed

1. **Label format preference:** Inline `"14.3% · Medium"` or a separate stat cell labeled "Level"? Inline is less disruptive to existing layout but the separate cell is more scannable.

2. **Color coding?** The DEVLOG says "Visual indicator" — should the token text be colored (e.g. yellow for Light, orange for Dark, red for Dangerous) or plain `text-text-secondary-light`?

3. **Dangerous/Under-roasted styling:** These two edge labels could be more prominent (e.g. red for Dangerous). OK to add subtle color differentiation just for those two, or keep all tokens unstyled for now?

4. **Batch avg token:** Should the batch-level avg token appear in the collapsed summary row, the expanded header, or both? Currently "Avg Loss: X%" is in the collapsed row — adding the token there keeps it visible without expanding.
