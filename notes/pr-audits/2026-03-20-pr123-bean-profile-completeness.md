# PR Audit: feat/bean-profile-data-completeness (PR #123)

## Metadata

- **Repo:** reedwhetstone/coffee-app
- **Base:** origin/main (`0786c9c`)
- **Head:** `f182480` (branch: feat/bean-profile-data-completeness)
- **PR #:** 123
- **Reviewer model:** anthropic/claude-opus-4-6 (independent subagent)
- **Confidence:** High (all changed files and key related files inspected)
- **Scope note:** 3 files changed, +372/-90 lines. Pure frontend/query change, no migrations.

## Executive Verdict

- **Merge readiness:** Ready with fixes
- **Intent coverage:** Full (with one gap noted)
- **Priority summary:** P0: 0, P1: 2, P2: 3, P3: 3

## Intent Verification

- **Stated intent:** Surface all non-null fields from coffee_catalog on the bean profile page. Add continent, country, price_tiers, score_value to query. Reorganize into logical sections. Add formatters. Hide empty sections. Remove the public_coffee gate.
- **What was implemented:** All stated goals are implemented. New fields added to CoffeeCatalog interface and Supabase query. BeanProfileTabs reorganized into four sections (Origin & Source, Pricing & Availability, Descriptions & Notes, Supplier). Formatter utilities extracted to `$lib/utils/formatters.ts`. Section hiding works via boolean guards. Public_coffee gate removed.
- **Coverage gaps:**
  - `cupping_notes` (catalog-level, not user-level) and `stocked_date`/`unstocked_date` are fetched by the query but not displayed anywhere in the profile sections. Minor: these may be intentionally omitted for UX reasons, but the stated intent is "all non-null fields."
  - The `ai_tasting_notes` field is displayed via the radar chart on the Cupping tab, not in the catalog info section; this is correct behavior, not a gap.

## Findings by Severity

### P0 (must fix before merge)

None.

### P1 (should fix before merge)

#### P1-1: `inventory.ts` query does NOT include new fields (continent, country, price_tiers, score_value, wholesale)

**Evidence:** `src/lib/data/inventory.ts` lines 431-462 (`loadUserInventory` function) builds its own `coffee_catalog!catalog_id (...)` select that is separate from `greenCoffeeUtils.ts:buildGreenCoffeeQuery`. The inventory.ts query explicitly lists columns and does NOT include `continent`, `country`, `price_tiers`, `score_value`, or `wholesale`.

**Impact:** The `/beans` page fetches inventory data via `/api/beans` which uses `buildGreenCoffeeQuery` (updated), so the BeanProfileTabs will work correctly. However, `loadUserInventory` is used by other code paths (the chat tools' `green_coffee_inventory` tool at `src/lib/services/tools.ts` and `src/lib/data/inventory.ts:addToInventory`'s post-insert re-fetch). Any consumer of `loadUserInventory` will get `undefined` for the new fields. This is a **confirmed inconsistency** that carries forward tech debt and risks subtle bugs if any future code path routes through `loadUserInventory` for profile display.

**Correction:** Add `continent`, `country`, `price_tiers`, `score_value`, and `wholesale` to the `coffee_catalog!catalog_id (...)` select in `inventory.ts:loadUserInventory` (around line 431). Ideally, consolidate to a single source of truth for the catalog column list (DRY principle per AGENTS.md "Never Repeat Truth").

#### P1-2: `formatPriceTiers` in `formatters.ts` does not validate individual tier objects (crashes on malformed data)

**Evidence:** `formatters.ts` line 16-20:

```typescript
export function formatPriceTiers(tiers: PriceTier[] | null | undefined): string {
	if (!tiers || !Array.isArray(tiers) || tiers.length === 0) return '';
	return [...tiers]
		.sort((a, b) => a.min_lbs - b.min_lbs)
		.map((t) => `${t.min_lbs} lb: $${t.price.toFixed(2)}`)
		.join(' | ');
}
```

The outer array check is good, but individual tier objects are not validated. If `price_tiers` contains `[{"min_lbs": 1, "price": null}]` or `[null]` or `[{"min_lbs": "five"}]`, `t.price.toFixed(2)` will throw a runtime error (`Cannot read property 'toFixed' of null` or `toFixed is not a function`).

Meanwhile, the codebase already has a robust `parsePriceTiers` function in `$lib/utils/pricing.ts` that validates each tier object's structure and types, filters out invalid entries, and sorts. This is a **duplication of logic** with the robust version being ignored in favor of a fragile one.

**Impact:** Runtime crash in the browser when encountering malformed `price_tiers` JSONB data. The scraper writes this data, and data quality varies across 27 suppliers.

**Correction:** Either:

- (a) Import and use `parsePriceTiers` from `$lib/utils/pricing.ts` to validate/parse, then format. This is the "Never Repeat Truth" approach.
- (b) At minimum, add per-tier validation: filter to only items where `typeof t.min_lbs === 'number' && typeof t.price === 'number'`.

Option (a) is strongly preferred. The `formatPriceTiers` function could become:

```typescript
import { parsePriceTiers } from '$lib/utils/pricing';

export function formatPriceTiers(tiers: unknown): string {
	const parsed = parsePriceTiers(tiers);
	if (!parsed || parsed.length === 0) return '';
	return parsed.map((t) => `${t.min_lbs} lb: $${t.price.toFixed(2)}`).join(' | ');
}
```

### P2 (important improvements)

#### P2-1: `PriceTier` interface duplicated across three files

**Evidence:**

- `src/lib/utils/formatters.ts` line 5-8: defines `PriceTier`
- `src/lib/utils/pricing.ts` line 7-10: defines `PriceTier`
- `src/lib/server/greenCoffeeUtils.ts` line 43: defines `price_tiers: Array<{ min_lbs: number; price: number }> | null` (inline, same shape)

Three sources of truth for the same type.

**Impact:** Maintenance burden. If the schema changes (e.g., adding a `currency` field), three files need updating.

**Correction:** Export `PriceTier` from a single location (likely `pricing.ts` since it already has the robust parsing logic) and import elsewhere.

#### P2-2: `hasPricingData` guard has a subtle logic bug with `cost_lb`

**Evidence:** `BeanProfileTabs.svelte` lines 487-493:

```svelte
{@const hasPricingData = !!(
	cat.cost_lb != null ||
	(cat.price_tiers && Array.isArray(cat.price_tiers) && cat.price_tiers.length > 0) ||
	cat.lot_size ||
	cat.bag_size ||
	cat.packaging
)}
```

The expression `!!(cat.cost_lb != null || ...)` is equivalent to `!!(true || ...)` when `cost_lb` is `0` (zero). While `cost_lb == 0` is unlikely for real coffee pricing data, the `!= null` check evaluates to `true` for any non-null value including `0`. Combined with the outer `!!`, this means `hasPricingData` is true even if cost_lb is 0 and all other fields are empty, which would show a "Pricing & Availability" section with just "$0.00/lb". This is technically correct behavior but worth noting.

More importantly: `cat.wholesale` was included in the `hasPricingData` check in the first commit's diff but is **missing from the final version** in the actual file. The audit P1 fix commit appears to have dropped it. If a bean is wholesale-only (no cost_lb, no price_tiers, no lot/bag/packaging), the Pricing section won't show, but the Wholesale badge still appears in the header. This is a minor inconsistency.

**Correction:** Add `cat.wholesale` back to the `hasPricingData` guard if wholesale beans should always show the Pricing section.

#### P2-3: `formatFieldLabel` is exported but unused

**Evidence:** `formatters.ts` exports `formatFieldLabel` (line 52-54). It is not imported anywhere. The old dynamic field rendering loop that would have used it was replaced with explicit field-by-field rendering.

**Impact:** Dead code. Minor, but clutters the module API.

**Correction:** Remove `formatFieldLabel` or mark it with a `// used by future dynamic rendering` comment if there are plans.

### P3 (nice to have)

#### P3-1: `formatDisplayDate` uses browser locale for date formatting (non-deterministic in SSR)

**Evidence:** `formatters.ts` line 29: `date.toLocaleDateString('en-US', ...)`. While the `'en-US'` locale is explicitly passed (good), `new Date(dateStr)` without a timezone suffix will be interpreted as UTC in some environments and local time in others. Arrival dates from the scraper are typically `YYYY-MM-DD` strings (date-only, no time component). `new Date('2026-03-15')` is parsed as midnight UTC, and `toLocaleDateString('en-US')` in the browser will display the previous day for users in negative UTC offsets (e.g., Mountain Time: "Mar 14, 2026" instead of "Mar 15, 2026").

**Impact:** Off-by-one day display for date-only strings in western hemisphere timezones. Common gotcha.

**Correction:** For date-only strings, split on `-` and construct the date with explicit components to avoid timezone shifting:

```typescript
const [y, m, d] = dateStr.split('-').map(Number);
if (y && m && d) {
	const date = new Date(y, m - 1, d); // local midnight, no TZ shift
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
```

#### P3-2: Catalog section always renders the outer wrapper `<div>` even if no subsections have data

**Evidence:** `BeanProfileTabs.svelte` line 474: `{#if selectedBean.coffee_catalog}` opens the outer card. Inside, the header (with title and badges) always renders. If a catalog entry exists but has no origin, pricing, description, or supplier data, the user sees an empty card with just the header "Bean Information" and no content sections.

**Impact:** Minor UX: empty card with just a title for very sparse catalog entries. Unlikely in practice since most catalog entries have at least a source.

**Correction:** Consider adding a guard: `{#if hasOriginData || hasPricingData || hasDescriptionData || hasSupplierData || cat.ai_description || cat.score_value != null}` around the outer wrapper, or accept this as intentional (the header badges alone have value).

#### P3-3: Wholesale badge style inconsistency between BeanProfileTabs and beans list/CoffeeCard

**Evidence:**

- `BeanProfileTabs.svelte`: `class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"` (rectangle, blue)
- `+page.svelte` (beans list): `class="rounded bg-blue-100 px-1 text-xs text-blue-800"` (rectangle, blue, less padding)
- `CoffeeCard.svelte`: `class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"` (pill, indigo, uppercase)

Three different visual treatments for the same "Wholesale" badge across the app.

**Impact:** Visual inconsistency. Not a bug, but a polish item.

**Correction:** Extract a shared `WholesaleBadge` component or at least align colors (blue vs indigo) and shape (rounded vs rounded-full).

## Assumptions Review

| #   | Assumption                                                                                      | Validity              | Why                                                                                                                                                                                                                                                                                                                                                                                           | Action                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Removing `public_coffee` gate is safe                                                           | **Valid**             | `public_coffee` is only used elsewhere for catalog-level access control (catalog.ts queries filter by `public_coffee=true` for public-facing catalog pages). On the beans profile page, the user is viewing their _own_ inventory item, which already has a catalog FK. The gate was hiding description/farm/roast fields from the bean owner, which was a bug, not a security boundary.      | None needed                                                                                                                             |
| 2   | `price_tiers` from Supabase will always be a valid JSON array                                   | **Weak**              | The DB column is `jsonb`. Supabase returns parsed JSON, but the actual content depends on scraper quality across 27 suppliers. The existing `pricing.ts:parsePriceTiers` handles all edge cases; the new `formatters.ts:formatPriceTiers` does not.                                                                                                                                           | Use `parsePriceTiers` from pricing.ts (P1-2)                                                                                            |
| 3   | The `CoffeeCatalog` interface in `greenCoffeeUtils.ts` is the only type definition that matters | **Weak**              | `component.types.ts` defines `CoffeeCatalog = Database['public']['Tables']['coffee_catalog']['Row']` which auto-derives from the generated DB types. The `greenCoffeeUtils.ts` interface is a _separate, hand-maintained_ type. They're not the same type but are used in overlapping contexts. The generated type already includes `continent`, `country`, `price_tiers` from the DB schema. | This dualism is pre-existing debt; the PR doesn't worsen it materially, but the hand-maintained interface could drift                   |
| 4   | `wholesale` check (`cat.wholesale` truthy) works correctly                                      | **Valid with caveat** | `database.types.ts` defines `wholesale: boolean` (not nullable) on the Row type. But `greenCoffeeUtils.ts` defines it as `boolean                                                                                                                                                                                                                                                             | null`. The Svelte template uses `{#if cat.wholesale}`which is truthy for`true`, falsy for `false`/`null`/`undefined`. Correct behavior. | Minor type inconsistency between hand-maintained and generated types |

## Tech Debt Notes

### Debt Introduced

1. **Duplicate `PriceTier` type** across `formatters.ts`, `pricing.ts`, and inline in `greenCoffeeUtils.ts` (P2-1)
2. **Duplicate price tier formatting logic** that's less robust than existing `pricing.ts` utilities (P1-2)
3. **Dead export** `formatFieldLabel` in `formatters.ts` (P2-3)

### Debt Worsened

1. **Two separate catalog column lists** in `buildGreenCoffeeQuery` (greenCoffeeUtils.ts) and `loadUserInventory` (inventory.ts) are now more divergent: the former has 5 new columns the latter lacks (P1-1). This was pre-existing debt, but the gap is now wider.
2. **Two separate `CoffeeCatalog` type definitions**: the hand-maintained interface in `greenCoffeeUtils.ts` and the auto-generated `Database['public']['Tables']['coffee_catalog']['Row']` in `component.types.ts`. Both are used across the codebase. The PR added fields only to the hand-maintained one.

### Suggested Follow-Up Tickets

1. **Consolidate catalog column list into a single constant** imported by both `greenCoffeeUtils.ts` and `inventory.ts`. ("Never Repeat Truth")
2. **Migrate hand-maintained `CoffeeCatalog` interface** to derive from or align with the auto-generated DB types
3. **Extract shared badge components** (Wholesale, Score) for visual consistency across beans list, catalog, and profile

## Product Alignment Notes

### Alignment Wins

- Strongly aligned with "data completeness as competitive moat" strategy (blog post "Who Profits When Coffee Data Stays Scarce")
- Location hierarchy (Continent > Country > Region) is the right UX for coffee sourcing context
- Section organization (Origin, Pricing, Descriptions, Supplier) matches industry mental models
- Score badge in header gives quick quality signal without scrolling
- `rel="noopener noreferrer"` added to external link (security improvement over previous version)

### Misalignments

- None significant. The missing `cupping_notes` (catalog-level) field display is debatable; it's scraper-generated data that might duplicate the AI description.

## Test Coverage Assessment

### Existing Tests That Validate Changes

- `src/lib/utils/pricing.test.ts` tests the existing pricing utilities but does NOT test the new `formatters.ts` functions
- No existing tests for `BeanProfileTabs.svelte` component
- No Playwright E2E tests specifically targeting the bean profile tab content

### Missing Tests

1. **Unit tests for `formatters.ts`** - all 7 exported functions are untested:
   - `formatPriceTiers` with valid tiers, empty array, null, malformed objects
   - `formatDisplayDate` with valid dates, invalid dates, null, date-only strings
   - `formatSourceName` with underscored names, empty string, null
   - `formatLocation` with various null combinations
   - `formatCostPerLb` with valid numbers, 0, null
   - `formatScore` with valid numbers, null
2. **Integration test** verifying that the catalog section renders all fields when data is present
3. **Edge case test** for a catalog entry with all-null fields (verifying no empty sections render)

### Suggested Test Additions

Create `src/lib/utils/formatters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatPriceTiers, formatDisplayDate, formatSourceName, formatLocation, formatCostPerLb, formatScore } from './formatters';

describe('formatPriceTiers', () => {
    it('formats valid tiers sorted by min_lbs', () => { ... });
    it('returns empty string for null/undefined/empty', () => { ... });
    it('handles malformed tier objects gracefully', () => { ... }); // Currently fails - P1-2
});
// ... etc
```

## Checklist Audit

### 1) Intent Coverage: PASS (with minor gap)

All stated objectives implemented. Minor gap: `cupping_notes` (catalog), `stocked_date`, `unstocked_date` are fetched but not displayed.

### 2) Correctness: CONCERN

- Happy path: PASS
- Edge cases: FAIL (malformed price_tiers crash - P1-2)
- Null handling: PASS (individual field guards are correct)
- Date/locale: CONCERN (timezone off-by-one - P3-1)

### 3) Codebase Alignment: CONCERN

- Duplicates existing `PriceTier` type and pricing parse logic (P1-2, P2-1)
- Inconsistent catalog column lists (P1-1)
- Formatter extraction is a good architectural pattern

### 4) Risk and Regressions: PASS

- No backward compatibility issues (purely additive display changes)
- No migration/deployment risk
- No side effects on other pages (catalog page uses separate component, beans list is unchanged)

### 5) Security and Data Safety: PASS

- `public_coffee` gate removal is safe (owner viewing own data)
- `rel="noopener noreferrer"` added to external link (improvement)
- No new auth/data boundaries affected

### 6) Test and Verification Quality: FAIL

- No tests for new formatter utilities
- No tests for component rendering changes

### 7) Tech Debt and Maintainability: CONCERN

- New debt introduced (duplicate types and logic)
- Existing debt worsened (divergent catalog column lists)
- Good extraction of formatters as reusable utilities

### 8) Product and UX Alignment: PASS

- Section organization is well-designed
- Empty section hiding works correctly
- Badge treatments add quick-scan value

### 9) Assumptions Audit: See table above

### 10) Final Verdict: Ready with fixes

## Minimal Correction Plan

1. **[P1-1]** Add `continent`, `country`, `price_tiers`, `score_value`, `wholesale` to the `coffee_catalog` select in `src/lib/data/inventory.ts:loadUserInventory` (~line 431)
2. **[P1-2]** Replace `formatPriceTiers` implementation in `formatters.ts` to use `parsePriceTiers` from `pricing.ts` for validation, then format. Remove the duplicate `PriceTier` interface from `formatters.ts`.
3. **[P2-2]** Add `cat.wholesale` back to the `hasPricingData` guard in BeanProfileTabs.svelte (appears to have been dropped during the audit fix commit)

## Optional Patch Guidance

### `src/lib/utils/formatters.ts`

- Remove `PriceTier` interface (import from `pricing.ts` instead)
- Remove `formatFieldLabel` (unused)
- Rewrite `formatPriceTiers` to delegate parsing to `parsePriceTiers` from `pricing.ts`
- Fix `formatDisplayDate` to handle date-only strings without TZ shifting (split on `-` approach)

### `src/lib/data/inventory.ts`

- Add the 5 missing columns to the select at ~line 431-461
- Long-term: extract the catalog column list to a shared constant in `greenCoffeeUtils.ts` and import it

### `src/routes/beans/BeanProfileTabs.svelte`

- Add `|| cat.wholesale` to the `hasPricingData` expression
