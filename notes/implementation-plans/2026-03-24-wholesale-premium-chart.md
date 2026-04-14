# Implementation Plan: Wholesale Premium Chart

**Date:** 2026-03-24
**Status:** Planning
**Repo:** coffee-app (web-only)

---

## Feature

Add a "Spread" view to the existing origin line chart that shows the retail-wholesale price spread per origin over time. This is a new tab alongside the existing Retail / Wholesale / All toggles on the Parchment Intelligence section.

Instead of plotting absolute prices, the Spread view plots the percentage premium that retail commands over wholesale for each origin: `(retail_median - wholesale_median) / wholesale_median * 100`.

This is genuinely differentiated market intelligence. No other green coffee data source tracks how the retail/wholesale gap varies by origin and over time.

---

## Why This Matters

- **For roasters buying wholesale:** Shows which origins have the smallest retail premium (best wholesale value)
- **For retailers:** Shows which origins carry the highest markup, suggesting pricing power or supply constraints
- **For market analysis:** Tracks whether the retail-wholesale gap is widening or narrowing across the market
- **For purveyors.io differentiation:** Unique data product. Nobody else is computing this.

---

## Data Source

Already available: `price_index_snapshots` table has both `wholesale_only = true` and `wholesale_only = false` rows for each origin+date. The data is already loading for Parchment Intelligence users.

No new queries needed. The computation is purely client-side: pair up retail and wholesale rows by origin+date, compute the spread.

---

## Proposed UX

### Tab Integration

Add a fourth toggle button to the existing Retail / Wholesale / All row:

```
[Retail] [Wholesale] [All] [Spread]
```

When "Spread" is selected:

- Y-axis changes from `$/lb` to `%` (retail premium percentage)
- Each line represents one origin (same as other tabs)
- Positive values mean retail costs more than wholesale (expected normal state)
- Negative values would mean wholesale costs more (unusual, worth highlighting)
- Tooltip shows: origin, date, spread %, retail price, wholesale price

### Chart Behavior in Spread Mode

- **Only origins with BOTH retail and wholesale data** appear. Origins with only one side are excluded from Spread view (they have no spread to show).
- **Y-axis label:** "Retail Premium (%)"
- **Zero line:** Draw a horizontal reference line at 0% to anchor the visual
- **Line colors:** Same origin color assignments as other tabs (consistent identity)
- **Tooltip format:**
  ```
  Mar 15, 2026
  ● Colombia: +23.4%
    Retail: $6.20  Wholesale: $5.02
  ● Ethiopia: +31.2%
    Retail: $7.80  Wholesale: $5.95
  ```

### Dashboard vs Expanded

- **Dashboard (collapsed):** Top 5 origins by volume (same as other tabs). Shows spread lines.
- **Expanded:** Full origin selector, same as Retail/Wholesale/All tabs.

---

## Implementation

### Files to Change

1. **`src/routes/analytics/+page.svelte`**

   - Add `'spread'` to the `ViewMode` type: `'retail' | 'wholesale' | 'all' | 'spread'`
   - Add fourth toggle button
   - When `viewMode === 'spread'`, compute spread data and pass to chart
   - The `filteredSnapshots` derivation needs a new branch for spread mode

2. **`src/lib/components/analytics/OriginLineChart.svelte`**

   - Accept a new prop: `mode?: 'price' | 'spread'` (default: `'price'`)
   - When `mode === 'spread'`:
     - Y-axis label changes to "%" instead of "$X.XX"
     - Y-axis format: `+23.4%` instead of `$6.20`
     - Add a zero-reference line
     - Tooltip format changes to show spread + both prices

3. **`src/routes/analytics/+page.server.ts`**
   - No changes needed. Data already loads for Parchment Intelligence users.

### Spread Computation (in `+page.svelte`)

```typescript
// Compute spread snapshots from raw data
let spreadSnapshots = $derived.by(() => {
	// Group by origin+date, separating retail and wholesale
	const pairs = new Map<string, { retail?: PriceSnapshot; wholesale?: PriceSnapshot }>();

	for (const s of snapshots) {
		const key = `${s.origin}|${s.snapshot_date}`;
		const pair = pairs.get(key) ?? {};
		if (s.wholesale_only) pair.wholesale = s;
		else pair.retail = s;
		pairs.set(key, pair);
	}

	// Only keep pairs where both sides exist
	const result: SpreadDataPoint[] = [];
	for (const [key, pair] of pairs) {
		if (!pair.retail || !pair.wholesale) continue;
		const retailPrice = pair.retail.price_median ?? pair.retail.price_avg;
		const wholesalePrice = pair.wholesale.price_median ?? pair.wholesale.price_avg;
		if (retailPrice == null || wholesalePrice == null || wholesalePrice === 0) continue;

		const spreadPct = ((retailPrice - wholesalePrice) / wholesalePrice) * 100;
		const [origin, date] = key.split('|');
		result.push({
			origin,
			snapshot_date: date,
			spread_pct: spreadPct,
			retail_price: retailPrice,
			wholesale_price: wholesalePrice
		});
	}

	return result;
});
```

### New Interface

```typescript
interface SpreadDataPoint {
	origin: string;
	snapshot_date: string;
	spread_pct: number;
	retail_price: number;
	wholesale_price: number;
}
```

### OriginLineChart Changes

The chart component needs to handle two modes. Rather than forking the entire component, the cleanest approach is:

- Add `mode` and optional `spreadData` props
- When `mode === 'spread'`, use `spreadData` instead of `snapshots` to build `originMap`
- Override Y-axis formatting: `${value.toFixed(1)}%` instead of `$${value.toFixed(2)}`
- Add zero-line when in spread mode
- Modify tooltip to show spread % + both prices

---

## Scope

### In scope

- "Spread" tab on the origin line chart (Parchment Intelligence section)
- Client-side spread computation from existing snapshot data
- Modified Y-axis, tooltip, and zero-line in spread mode
- Same origin selector behavior as other tabs

### Out of scope

- Dedicated "Wholesale Premium" section/card (keep it as a chart tab for now)
- Server-side spread pre-computation (not needed; data volume is small)
- Spread data in the PPI API (future consideration)
- Spread data in the public section (member-only)

---

## Acceptance Criteria

- [ ] Fourth "Spread" toggle button appears alongside Retail / Wholesale / All
- [ ] Spread view shows % premium lines per origin
- [ ] Only origins with both retail AND wholesale data appear in Spread mode
- [ ] Y-axis shows percentage format, not dollar format
- [ ] Zero reference line visible
- [ ] Tooltip shows spread %, retail price, and wholesale price
- [ ] Dashboard mode: top 5 origins. Expanded mode: full origin selector
- [ ] `pnpm check` passes
- [ ] `pnpm lint` passes

---

## Risks

- **Data coverage:** Not all origins may have both retail and wholesale snapshots. The chart may show fewer origins in Spread mode than in Retail/Wholesale modes. This is correct behavior, not a bug.
- **Volatile spreads:** Some origins with small sample sizes may show wild spread swings. Could add a minimum sample_size threshold (e.g., >= 3 on each side) to filter noise.
- **Zero-crossing:** If wholesale ever exceeds retail for an origin (unlikely but possible), the line goes negative. The zero-line makes this interpretable.

---

## Open Questions

1. **Minimum sample size filter?** Should we require >= 3 beans on both retail and wholesale sides before computing spread? This would reduce noise from origins with thin wholesale coverage.
2. **Color consistency:** Should Spread mode use the same origin-to-color mapping as the other tabs? (I think yes, for visual identity continuity.)
3. **Default view:** Should the default tab remain "Retail" or should it change based on what the user last selected? (Probably keep Retail as default.)
