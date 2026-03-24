# Implementation Plan: Wholesale Markers on Roast Profiles

- **Feature**: Add wholesale markers/indicators and filtering to the Roast Profiles page.
- **Why now**: Priority 2 in DEVLOG. Functional consistency with the recently updated Inventory page (PR #121). Supports the broader strategic rollout of wholesale features and helps roasters identify commercial-scale batches at a glance.

## Strategy Alignment Audit

- **Consistency**: Matches the "Wholesale" badge logic already landed in `/beans` (inventory) and `/catalog`.
- **Transparency**: Aligns with the "Discovery vs Reliability" theme by clearly labeling high-volume (wholesale) inputs vs. specialty micro-lots.
- **Data Integrity**: Uses the `wholesale` flag from `coffee_catalog` (via `green_coffee_inv`) to drive UI state, reinforcing the single source of truth for coffee attributes.
- **CLI/Web Parity**: Extends the "Wholesale" insight context into the personal workspace, mirroring the catalog's ability to distinguish these tiers.

## Scope

- **In**:
  - Badge/indicator on Roast Cards in the Roast Profile list view.
  - "Wholesale" toggle filter in the Roast Profiles filter bar.
  - CLI: Add `wholesale` indicator to `purvey roast list` output.
- **Out**:
  - Changes to the "Add/Edit Roast" form (context is inherited from the bean).
  - Wholesale markers for Sales/Profit page (separate DEVLOG item).

## Proposed UX Behavior

- **Badge**: A small, high-contrast "W" or "Wholesale" badge (matching the Inventory page style) will appear next to the bean name on each roast card.
- **Filtering**: A "Wholesale" checkbox or toggle will be added to the roasting filter controls. When active, only roasts using beans marked as wholesale will be visible.
- **CLI**: The `purvey roast list` table will include a `(W)` marker next to the coffee name or a dedicated `W` column for wholesale beans.

## Files to Change

### `purveyors-cli` (PR #1)

- `src/api/types.ts`: Ensure `Roast` type includes the bean's wholesale status.
- `src/commands/roast/list.ts`: Update table output to show the wholesale indicator.

### `coffee-app` (PR #2)

- `src/lib/types/roast.ts`: Update interface to include `is_wholesale`.
- `src/lib/components/roasts/RoastCard.svelte`: Add logic to display the badge based on `bean.wholesale` or `is_wholesale`.
- `src/routes/roasts/+page.svelte`: Add the filter toggle and update the filtering logic in the reactive `$derived` blocks.

## API/Data Impact

- No schema changes required.
- The `roast_profiles` join already has access to `green_coffee_inv`, which was updated in PR #121 to store/reflect the `wholesale` status. We just need to wire it through the API response.

## Acceptance Criteria

- [ ] Each roast card correctly identifies roasts using wholesale beans.
- [ ] The badge styling is visually consistent with the inventory page.
- [ ] Filtering by "Wholesale" correctly hides/shows relevant roast profiles.
- [ ] CLI `purvey roast list` displays the wholesale status correctly.
- [ ] No regression in list performance or layout on mobile.

## Test Plan

- **Lint/Type Check**: Run `pnpm check` and `pnpm lint`.
- **Vitest**: Verify filtering logic correctly handles the boolean toggle.
- **Manual**: Test with a known wholesale bean roast and a non-wholesale roast to ensure the toggle and badge work.

## Risks and Rollback

- **Risk**: Filter UI bloat on mobile. **Mitigation**: Use a concise icon or ensure the filter bar wraps cleanly.
- **Rollback**: Simple git revert of the UI changes; no DB migration to undo.

## Open Questions for Reed

1. Should the filter be "Hide Wholesale", "Show Only Wholesale", or a three-state (All/Retail/Wholesale)?
2. Is the "W" badge enough, or do we want "Wholesale" spelled out for clarity on first use?
3. Should we also show the wholesale status in the Roast Detail (modal/page) view, or is the card list enough?
