# PR 2: Member Web Workflow for Saved Sourcing Briefs

**Program:** Saved Sourcing Briefs and Procurement Recommendation Seed  
**Repo:** `coffee-app`  
**PR goal:** Make saved sourcing briefs usable from the member web app without forking the API contract from PR 1.

## Why this slice comes now

Once the saved brief contract exists, members need a visible workflow: save an eligible catalog search, inspect saved briefs, and run current matches. This turns the API primitive into a product surface while preserving PR 1 as the source of truth.

## In scope

- Add a logged-in member surface, likely `/procurement` or `/catalog/briefs`.
- Add brief list and detail views.
- Add a catalog affordance to save the current eligible search as a sourcing brief.
- Show current matches with criteria, match reasons, limitations, and last-run timestamp.
- Show clear empty, invalid, stale, and no-match states.
- Show login/upgrade affordances for anonymous and viewer users without performing writes.
- Use PR 1 endpoints or shared server helpers, not separate localStorage-only state.

## Out of scope

- CLI commands.
- Email or external notifications.
- Recommendation ranking beyond current match explanations.
- Broad redesign of `/catalog` filters.
- New billing products or checkout flows.

## Specific files to change

Likely files:

- `src/routes/procurement/+page.server.ts`
- `src/routes/procurement/+page.svelte`
- `src/routes/procurement/procurement.test.ts`
- `src/routes/catalog/+page.svelte`
- `src/routes/catalog/page.svelte.test.ts`
- `src/lib/catalog/urlState.ts` only if mapping catalog URL state into brief criteria needs a helper
- navigation/sidebar files if member nav includes the new route
- docs/copy files for upgrade messaging if needed

## Acceptance criteria

- A member can save a supported catalog search as a sourcing brief.
- A member can open the brief detail and see current matches from the PR 1 contract.
- Anonymous and viewer users cannot bypass the gate through UI or direct endpoint requests.
- The UI explains unsupported current filters instead of saving a misleading partial brief.
- Empty matches are framed as useful monitoring state, not an error.
- The route remains usable on mobile.

## Test plan

```bash
pnpm test -- src/routes/procurement/procurement.test.ts src/routes/catalog/page.svelte.test.ts
pnpm check
pnpm lint
```

Add server-route tests if the page server load wraps API behavior directly.

## Risks

- **UI-only fork:** Do not store criteria solely in URL/local state. Persist through PR 1.
- **Over-promising alerts:** Copy should say saved brief or current matches, not notifications until delivery exists.
- **Too many criteria at launch:** If current catalog filters cannot be safely translated, block save with a clear unsupported-filter message.

## Exact follow-on dependency

PR 3 can add CLI commands after members can use the workflow and the API response shape has been validated by web usage.
