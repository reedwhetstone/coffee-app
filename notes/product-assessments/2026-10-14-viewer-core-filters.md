# Which catalog filters belong in the free Viewer tier?

**Date:** 2026-10-14  
**Status:** Assessment. Only signed-in decaf access is accepted for implementation.  
**Direction:** [Product vision](../PRODUCT_VISION.md), [ADR-005](../decisions/005-catalog-access-level-positioning.md), [ADR-019](../decisions/019-decaffeination-is-its-own-catalog-fact.md).  
**Request:** Reed asked to correct coffee-app #683, permit signed-in free decaf filtering following price, and assess the core free-tier filter set.

## Recommendation

Let a free account find a viable coffee. Charge for choosing better across the market and keeping that decision current.

Decaf is highly relevant to a minority, not a convincing general subscription hook. For someone avoiding caffeine it is an exclusion constraint, like budget or availability. For everyone else it is usually untouched. Locking it risks making the catalog unusable for that minority without demonstrating the platform's deeper intelligence. This is a product hypothesis, not measured conversion evidence: no funnel telemetry or willingness-to-pay research was retrieved for this assessment.

The data separation remains valuable regardless of entitlement: a decaf lot can be Washed, Natural, or Honey. A small audience does not make accurate representation unnecessary; it does mean the control should not dominate the toolbar.

## Proposed boundary

### Free Viewer: a useful shopping shortlist

- Coffee-name search, origin/country, supplier selection, and in-stock availability. Keep existing broad discovery working; supplier selection is already exposed in the panel and should not be newly presented as a paid benefit.
- Price-per-pound range and basic price/name/recently-stocked sorting. Price range is already approved; basic sorts are not the same as analytical ranking or a freshness monitoring workflow.
- Any / Decaf only / No decaf. Accepted in this correction; anonymous visitors receive a free-sign-in explanation.
- A straightforward farm-process choice is the next strongest candidate: Washed, Natural, Honey, Wet-Hulled. Free users already have legacy process filtering. Moving that existing intent onto reliable normalized data would reduce confusion, not necessarily give away fine-detail analysis. **Recommendation only:** structured base-method access stays paid in this change, apart from the existing exact Decaf compatibility alias.
- Rich coffee facts, supplier links, and the existing two-coffee Viewer comparison. Showing accurate information and allowing a small evaluation should demonstrate value; do not imply unlimited comparisons are free.

### Paid: sourcing precision and repeated decisions

- Fine process detail: fermentation, additives, drying taxonomy, disclosure/evidence, and confidence.
- Variety/species taxonomy; grading, screen size, moisture, elevation and score ranges with explicit score-protocol semantics.
- Analytical ranking, semantic search, broader comparisons and matching, historical pricing/market context.
- Saved sourcing briefs, tracked lots, alerts, exports, monitoring, and repeatable procurement workflows, under their existing product entitlements. These reduce ongoing work rather than merely permitting a basic purchase constraint.

A single obscure filter should not carry the upgrade pitch. The stronger paid promise is answering questions such as “Which suitable lots offer better value, what changed, and will I know when a replacement arrives?” This assessment does not change membership or Parchment Intelligence packaging.

### Anonymous: unchanged

Keep the current limited discovery/trust surface. The price and decaf controls invite free sign-in; this work does not open them anonymously or add new public filter power. API plans remain a separate volume-based contract, not a copy of website membership tiers.

## Delivery and evidence

- Correct #683's toolbar with a compact Decaf summary and on-demand choices/lock explanation. Reuse its shared state, panel control, and active-filter chip.
- Unknown alternative counts must remain unknown, not zero. A failed independent count read must not disable a valid choice. Apply the shared failure fix to sibling controls as well.
- Parchment owns authorization, query semantics and counts. Deploy [its narrow Viewer-decaf prerequisite (#367)](https://github.com/reedwhetstone/parchment-api/pull/367) before the corrected app; keep every other process gate intact. Update ADR-005/019 together.
- Do not bundle a broader free-tier entitlement expansion into this correction. A base-process change would require its own accepted policy amendment and upstream/app parity.
- Evaluate future policy using existing filter-use instrumentation where available: successful shortlist creation, empty-result recovery, sign-in after a locked control, repeat catalog use, and movement into paid workflows. Compare outcomes by intent/cohort, not total clicks on decaf. There is no new telemetry implementation or arbitrary conversion target in this PR.
