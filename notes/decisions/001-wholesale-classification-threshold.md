# ADR-001: Wholesale Classification via 5 lb Minimum Tier Threshold

**Status:** Accepted
**Date:** 2025-12-01 (approximate)

## Context

The catalog contains both retail and wholesale green coffee suppliers. Retail customers
buy 1–5 lb bags; wholesale buyers purchase in bulk (10–50+ lb lots). Distinguishing
between the two matters for display, filtering, and sourcing decisions — retail home
roasters should not be surprised by a minimum order they can't fulfill.

Suppliers encode this distinction implicitly through their product variants: a supplier
whose smallest available weight is a 10 lb bag is wholesale by nature.

## Decision

A catalog entry is classified as `wholesale = true` when the smallest purchasable
quantity (the first entry in `price_tiers`, sorted ascending by `min_lbs`) is
**greater than 5 lbs**.

The threshold is 5 lbs because:
- 5 lb is the largest "home roaster" bag size sold by retail-oriented suppliers.
- Suppliers with a 5 lb minimum (Sweet Maria's, Happy Mug, etc.) still serve hobbyists.
- Suppliers with a 10+ lb minimum are structurally wholesale even if their catalog
  URL is publicly visible.

Implementation: `isWholesale(tiers)` in `scrape/utils/priceTierExtractor.ts` returns
`tiers[0].min_lbs > 5`. The `wholesale` boolean is persisted to `coffee_catalog.wholesale`
and surfaced in the app via catalog filters, inventory markers, and sales tracking.

## Consequences

- Simple, deterministic rule — no LLM call needed for wholesale classification.
- A supplier offering both 1 lb and 20 lb tiers will be classified retail (correct).
- A supplier whose only variant is 10 lb will be classified wholesale (correct).
- Edge case: suppliers with a 5 lb minimum are classified retail. If a supplier only
  sells 5 lb bags and is genuinely trade-only, the threshold would need to move to `>= 5`.
- Revisit if wholesale suppliers begin offering sub-5 lb sample packs as loss leaders.
