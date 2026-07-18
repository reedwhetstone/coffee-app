# ADR-014: Public wholesale-inclusive catalog discovery

**Status:** Accepted  
**Date:** 2026-07-18

## Context

ADR-005 treated wholesale visibility as a membership capability and recommended against adding anonymous catalog filters by default. That model hid publishable wholesale coffees from the neutral catalog view. It made the marketplace look narrower than it is and could cause prospective buyers to conclude that wholesale suppliers were absent.

Wholesale publication breadth is evidence of marketplace coverage, not premium workflow leverage. Parchment PADR-0017 now defines the canonical resource contract: every caller can discover publishable retail and wholesale coffees by default while public callers remain limited to `public_coffee=true` rows and the public field projection.

## Decision

The catalog defaults to all publishable retail and wholesale coffees for anonymous users, viewer sessions, API keys, members, and admins.

The supplier-scope control is expressed as an optional narrowing action: **Hobbyist suppliers only**. It sends `showWholesale=false`. The neutral state sends or resolves `showWholesale=true`.

This one broad scope control is available on the public catalog. It supersedes ADR-005 only where that decision classified visibility of publishable wholesale rows, and the corresponding hobbyist-only narrowing control, as member-only.

The following boundaries from ADR-005 remain in force:

- `wholesaleOnly=true` is restricted to member and admin sessions.
- Non-public rows and richer member fields remain gated.
- Advanced facets, sorting, and search leverage remain gated according to the current entitlement model.
- Importer, elevation, and appearance remain visible coffee attributes, but filtering, facet metadata, and sorting by them require any paid subscription/API tier.
- Public callers remain constrained to the public field projection.

Parchment PADR-0017 is the source of truth for row visibility. Parchment must deploy the wholesale-inclusive public contract before this Coffee App behavior is released.

## Consequences

Positive:

- The default catalog accurately represents marketplace breadth.
- Wholesale buyers can see that the product includes suppliers relevant to them before signing in.
- Users who only want small-quantity suppliers can still narrow the catalog with a plainly labeled control.

Negative:

- The default result set is larger and may include coffees that are not practical for hobbyist purchase.
- Coffee App deployment is sequenced behind the Parchment contract change.

Risks and tradeoffs:

- Every list, facet, and statistics request must preserve explicit `showWholesale=false`; otherwise the visible cards and supporting metadata can describe different populations.
- Contradictory `showWholesale=false&wholesaleOnly=true` URLs are normalized to wholesale-inclusive scope so the UI and result set cannot disagree.
