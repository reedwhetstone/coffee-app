# PR 08: Canonical Merged Coffee View

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Expose the full product payoff: a canonical view that merges high-confidence listings into a trusted cross-supplier coffee profile with price comparison and provenance-aware metadata.

## Why this slice comes now

After identities and resolution exist, members need the canonical object, not just a list of similar rows. This is the "canonized merger view" that turns row matching into a premium decision surface.

## In-scope

- Add `GET /v1/catalog/:id/canonical` and/or `GET /v1/bean-identities/:identityId`.
- Build canonical merged profile service.
- Include accepted supplier listings, price spread, tiered price comparisons, stock and freshness summary, and proof summaries.
- Show field-level merge state: selected value, supporting listings, confidence, and conflicts.
- Add member UI for canonical identity view from the comparison panel.
- Add CLI follow-up plan for `purvey catalog canonical <id>` if not included here.

## Out-of-scope

- Public canonical pages.
- Supplier claim or verification flows.
- Legal compliance exports.
- Purchase automation.
- Full historical price chart unless snapshots make a small identity price history cheap.

## Files to change

- `src/lib/server/beanIdentity.ts`
- `src/lib/server/canonicalCoffeeView.ts`
- `src/routes/v1/catalog/[id]/canonical/+server.ts`
- `src/routes/v1/bean-identities/[identityId]/+server.ts` if selected
- `src/lib/components/catalog/CanonicalCoffeePanel.svelte`
- Route and component tests

## Acceptance criteria

- Member/API callers can fetch an accepted canonical identity view.
- Non-members cannot fetch premium identity data.
- The view distinguishes accepted identities from provisional similarity candidates.
- Price spread uses canonical tier helpers.
- Metadata conflicts are visible instead of silently flattened.
- Proof summaries are included without raw evidence quotes.

## Test plan

- Route tests for access states.
- Unit tests for merged field selection and conflict handling.
- Unit tests for price spread across tier arrays.
- Component tests for accepted identity, provisional candidate, and conflict states.
- `pnpm check` and targeted vitest.

## Risks

- Merged metadata can imply certainty. Use labels like accepted, conflict, inferred, not disclosed, and provisional.
- API shape could become too large. Keep the default response concise and use optional include fields for heavier proof or history later.

## Exact follow-on dependency

After this PR, future work can add saved comparisons, alerts, canonical identity price history, procurement briefs, and supplier-verified listings.
