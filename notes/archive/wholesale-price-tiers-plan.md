# Wholesale + Price Tiers Implementation Plan

> Created: 2026-03-03
> Updated: 2026-03-03
> Status: Ready to implement
> Priority: P0 (from DEVLOG)

## Overview

Add `price_tiers` (tiered/volume pricing) and `wholesale` flag support to the catalog. New columns already live on `coffee_catalog` table in Supabase.

## Data Model

### Live DB Columns

```sql
price_tiers  jsonb     -- [{"min_lbs": 1, "price": 20.00}, {"min_lbs": 5, "price": 15.00}, {"min_lbs": 50, "price": 8.00}]
wholesale    boolean   -- NOT NULL, default false. true when min purchasable tier > 5 lb
```

### Rules

- `price_tiers` sorted by `min_lbs` ascending
- `wholesale` is **required** (never null). `price_tiers` can be null (legacy data)
- `cost_lb` remains the canonical sort/filter field. It's calculated as the $/lb at the lowest tier (closest to 1 lb min). For wholesale suppliers with a 10 lb min, `cost_lb` = that tier's price per lb.
- When `price_tiers` is not null, it replaces `cost_lb` as the display source (but `cost_lb` still holds the base price for sorting/filtering)

## Decisions (from Reed)

| Question             | Answer                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Filter UX            | "Show wholesale" toggle (off by default). Users can also search/filter for wholesale.                     |
| Tier display on card | Popout/hover info display, NOT a selection. It's additional info only.                                    |
| Wholesale badge      | Yes, on cards where `wholesale = true`                                                                    |
| Null handling        | `wholesale` never null. `price_tiers` can be null (legacy); fall back to `cost_lb`                        |
| Beans page           | Shows the locked-in purchase price (no tiers). BUT the BeanForm needs tier integration for new purchases. |
| BeanForm             | User selects quantity from available price tiers; auto-calculates total + tax/shipping                    |
| Sorting              | Uses `cost_lb` always (populated with lowest tier $/lb)                                                   |

## UX Pattern: Price Tiers on Clickable Cards

**Problem:** The card is a `<button>` that opens the supplier link. Nesting a clickable element inside violates WCAG and causes event bubbling issues.

**Research findings:**

- WCAG: no interactive elements nested inside interactive elements
- Hover tooltips don't work on mobile (no hover state)
- `stopPropagation` is a hack, not a pattern
- B2B pricing tables are typically shown as inline mini-tables or popover on info icon

**Chosen pattern: Info icon with popover**

- Small ℹ️ icon next to the price display
- Desktop: hover shows a floating tier table
- Mobile: tap toggles the popover (with `stopPropagation` on the icon only)
- The icon is positioned outside the card's click area using CSS (`pointer-events: none` on card with `pointer-events: auto` on inner content), OR we restructure the card so the link wraps only the supplier name/arrow, not the entire card
- **Better approach**: Restructure the card. Make only the supplier name + arrow icon the clickable link (an `<a>` tag), not the entire card as a `<button>`. The price tier info icon becomes a standalone interactive element. This is WCAG-compliant and avoids propagation hacks.

**Tier popover content:**

```
Volume Pricing
─────────────
 1+ lb    $20.00/lb
 5+ lb    $15.00/lb
50+ lb     $8.00/lb
```

## Implementation Plan

### PR 1: Types + Pricing Utilities

**Branch:** `feature/wholesale-types`

**1. Update `database.types.ts`** (manual addition):

```typescript
// Add to coffee_catalog Row:
price_tiers: Json | null;
wholesale: boolean;

// Add to Insert/Update:
price_tiers?: Json | null;
wholesale?: boolean;
```

**2. Create `src/lib/utils/pricing.ts`**:

```typescript
export interface PriceTier {
	min_lbs: number;
	price: number;
}

/** Parse raw jsonb into typed tiers, sorted by min_lbs ascending */
export function parsePriceTiers(raw: unknown): PriceTier[] | null;

/** Get the display price (cost_lb equivalent: lowest tier $/lb) */
export function getDisplayPrice(coffee: CoffeeCatalog): number | null;

/** Get $/lb at a specific quantity */
export function getPriceAtQuantity(tiers: PriceTier[], lbs: number): number | null;

/** Get the applicable tier for a given quantity */
export function getApplicableTier(tiers: PriceTier[], lbs: number): PriceTier | null;

/** Calculate total cost for a purchase (price * lbs) */
export function calculatePurchaseTotal(tiers: PriceTier[], lbs: number): number | null;

/** Format price for display: "$8.00/lb" */
export function formatPricePerLb(price: number): string;

/** Check if coffee has multi-tier pricing */
export function hasMultipleTiers(coffee: CoffeeCatalog): boolean;
```

**3. Unit tests** for all pricing utilities (in `src/lib/utils/pricing.test.ts`):

- Parse valid tiers, null, empty array, malformed JSON
- Price at exact tier boundary, between tiers, below minimum
- Total calculation with tier breaks
- Edge cases: single tier, wholesale with 10 lb min

### PR 2: Catalog API + Filter

**Branch:** `feature/wholesale-filter`

**1. Update catalog API** (`src/routes/api/catalog/+server.ts`):

- Add `wholesale` filter parameter
- Default behavior: `wholesale = false` (show only retail by default)
- When `showWholesale=true` param: remove wholesale filter (show all)
- When `wholesaleOnly=true` param: filter to `wholesale = true` only
- Ensure `price_tiers` and `wholesale` columns are returned in select

**2. Update `filterStore.ts`**:

- Add `showWholesale: boolean` to filter state (default `false`)
- Update `buildApiParams()` to include wholesale parameter
- Update client-side `applyFilters()` for non-paginated routes

**3. Update filter sidebar**:

- Add "Show Wholesale" toggle checkbox
- Position: near the top of filters (it's a major category distinction)

### PR 3: CoffeeCard Display

**Branch:** `feature/wholesale-card-display`

**1. Restructure `CoffeeCard.svelte`**:

- Change card from `<button onclick={openLink}>` to a `<div>` with an `<a>` tag wrapping the supplier name/arrow
- This frees up the card surface for non-link interactive elements

**2. Add price tier display**:

- Replace `${coffee.cost_lb}/lb` with computed display price from `getDisplayPrice()`
- When `price_tiers` exists with > 1 tier: show ℹ️ info icon next to price
- Info icon triggers a popover/tooltip with the full tier table
- Desktop: hover to show. Mobile: tap to toggle
- Popover shows: `min_lbs+ lb: $X.XX/lb` for each tier

**3. Add wholesale badge**:

- When `wholesale = true`: show a small "Wholesale" pill/badge
- Color: muted blue or purple (distinct from price highlight color)
- Position: near the supplier name or price area

**4. Compact mode**:

- Show `getDisplayPrice()` only (no tier popover)
- Still show wholesale badge

### PR 4: BeanForm Price Tier Integration

**Branch:** `feature/wholesale-bean-form`

**1. Update `BeanForm.svelte`**:

- When a catalog bean with `price_tiers` is selected:
  - Display the available tiers as a reference table
  - Quantity input: as user types lbs, auto-select the matching tier
  - Show calculated subtotal: `qty * applicable_tier_price`
  - Show `+ tax/shipping` field below
  - Show total: `subtotal + tax_ship`
- When no `price_tiers`: keep current behavior (manual cost entry)

**2. Auto-populate cost fields**:

- `bean_cost` = `qty * applicable_tier_price`
- `cost_lb` in inventory = `applicable_tier_price` (the per-lb price they actually paid)
- `purchased_qty_lbs` = user-entered quantity
- `tax_ship_cost` = user-entered tax/shipping

## Files to Touch

| File                                           | Change                                                         |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `src/lib/types/database.types.ts`              | Add `price_tiers`, `wholesale` to coffee_catalog types         |
| `src/lib/utils/pricing.ts`                     | **NEW**: tier parsing, price helpers, formatting               |
| `src/lib/utils/pricing.test.ts`                | **NEW**: unit tests for pricing utilities                      |
| `src/lib/components/CoffeeCard.svelte`         | Price display, tier popover, wholesale badge, card restructure |
| `src/routes/api/catalog/+server.ts`            | Wholesale filter, include new columns                          |
| `src/lib/stores/filterStore.ts`                | `showWholesale` state + API param                              |
| `src/lib/components/layout/LeftSidebar.svelte` | Wholesale toggle                                               |
| `src/routes/beans/BeanForm.svelte`             | Tier-aware quantity/price calculation                          |

## Testing Checklist

- [ ] Pricing utility: parse valid tiers, null, empty, malformed
- [ ] Pricing utility: price at exact tier, between tiers, below min
- [ ] Pricing utility: total calculation across tier breaks
- [ ] CoffeeCard: renders correctly with no tiers (legacy, uses cost_lb)
- [ ] CoffeeCard: renders correctly with single tier
- [ ] CoffeeCard: renders correctly with multiple tiers (shows info icon)
- [ ] CoffeeCard: tier popover displays correctly on desktop hover
- [ ] CoffeeCard: tier popover displays correctly on mobile tap
- [ ] CoffeeCard: wholesale badge visible when wholesale = true
- [ ] CoffeeCard: no badge when wholesale = false
- [ ] Catalog: defaults to hiding wholesale coffees
- [ ] Catalog: "Show Wholesale" toggle reveals wholesale items
- [ ] Catalog: sort by price still works (uses cost_lb)
- [ ] Catalog: price range filter still works (uses cost_lb)
- [ ] BeanForm: selecting a tiered coffee shows tier table
- [ ] BeanForm: quantity input auto-calculates from correct tier
- [ ] BeanForm: total updates live as quantity changes
- [ ] BeanForm: non-tiered coffee works as before
