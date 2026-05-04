# PR 05: Member Similar Coffee Comparison UI

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Give members a useful cross-supplier comparison workflow before canonical identity tables exist.

## Why this slice comes now

This is the first visible member value. It answers the user's immediate question: which coffees are likely the same or close substitutes, and how do their prices compare?

## In-scope

- Add a member-only comparison action to catalog cards or a selected-row drawer.
- Add a locked teaser for anonymous or viewer users without leaking premium results; a real match count is acceptable if the API supports it safely.
- Fetch `/v1/catalog/:id/similar` for members.
- Render target coffee and match list with supplier, 1 lb baseline price, tier summary, stock state, arrival or stocked date, proof badges, beta confidence language, and match explanation.
- Show price deltas against target using canonical price helpers. Start with 1 lb; design component boundaries so a later comparison tool can pull both price tier arrays side by side.
- Add empty states for no embeddings, no matches, or entitlement denial.

## Out-of-scope

- New public catalog detail route unless required by the UI design.
- Canonical identity records.
- Manual review queue.
- Alerts, saved comparisons, exports, and procurement actions.

## Files to change

- `src/routes/catalog/+page.svelte`
- `src/routes/catalog/+page.server.ts` only if member capability data needs to be passed explicitly
- `src/lib/components/CoffeeCard.svelte`
- New component such as `src/lib/components/catalog/SimilarCoffeePanel.svelte`
- `src/lib/utils/pricing.ts`
- Page and component tests

## Acceptance criteria

- Non-members see a clear premium CTA but not match data.
- Members can open a comparison panel for a catalog row.
- The panel shows canonical price fields and does not fall back to `cost_lb` unless canonical fields are absent.
- Per-dimension explanation is visible enough for trust.
- UI handles loading, empty, and error states.

## Test plan

- Component test for locked teaser.
- Component test for member match rendering.
- Component test for price tier formatting and deltas.
- Page test for action visibility by role.
- `pnpm check` and targeted vitest.

## Risks

- The catalog page may become crowded. Prefer an action and drawer over adding full match data to every card.
- Fetching matches for many cards would be expensive. Only fetch on demand.

## Exact follow-on dependency

PR 06 adds durable identity storage so the UI can later distinguish accepted canonical matches from similarity candidates.
