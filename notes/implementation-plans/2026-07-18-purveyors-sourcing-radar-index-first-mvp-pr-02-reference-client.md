# Sourcing Radar MVP PR 2: Coffee-App Manual Value Test

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `coffee-app`
**PR goal:** Add one member-facing manual Radar route that tests whether indexed brief matches improve qualified discovery.

## Why this slice comes now

PR 1 makes the composition contract canonical and independently usable. Coffee-app should now act as a thin reference client: expose the result, preserve its trust metadata, hand the buyer to the source, and measure whether the workflow changes discovery behavior.

This PR is the complete buyer-facing MVP. It is not the first step of an assumed alerting roadmap. Recurrence earns a later plan only if the four-week pilot passes.

## In scope

- One route for an owned active brief, proposed as `/procurement/briefs/[id]/radar`.
- A “Review indexed matches” action on existing dashboard active-brief cards.
- Server-first loading through the Parchment SDK.
- Fresh result rows with lot identity, current price, brief-match reasons, eligible signal evidence, source, publication freshness/quality, limitations, and one source-detail action.
- Honest stale, unavailable, empty, denied, and error states.
- Minimal events for Radar open, indexed row impression, source-detail click, and pilot disposition.
- A compact pilot disposition control: already known, investigate, shortlist, sample/quote, or not relevant.
- Focused tests and existing docs/copy alignment where required.

## Out of scope

- Dashboard redesign, a new global nav destination, or Market Index page changes.
- Automatic refresh, scheduler, email, Discord, webhook, SMS, or push delivery.
- Stored recommendation runs, notification preferences, team workflows, or history charts.
- Client-side ranking, freshness decisions, signal calculation, or AI summaries.
- Brief creation/editing, CLI changes, pricing, checkout, or public teaser work.
- Purchase, RFQ, supplier-message, inventory-write, or other external actions.

## UX invariants

- The page leads with the brief and “worth inspecting” language, never purchase advice.
- Freshness, publication date, source, evidence, and limitations are visible without opening a secondary panel.
- `stale` and `unavailable` states never render opportunity cards. They may link to the existing plain catalog matches and explain why indexed evidence is withheld.
- The full match workflow remains available. Radar is a focused evidence view, not a replacement.
- One action reaches the canonical supplier/source or lot-detail record.
- No UI code recalculates score, rank, age, or entitlement.

## Likely files

- `src/routes/procurement/briefs/[id]/radar/+page.server.ts`
- `src/routes/procurement/briefs/[id]/radar/+page.svelte`
- focused route/component tests
- `src/routes/dashboard/+page.svelte` and its tests
- a small analytics/pilot helper using the existing event pattern
- dependency/lockfile updates only if the Parchment SDK release requires them

## Acceptance criteria

- An entitled owner can open Radar from an existing dashboard brief card.
- Another user, anonymous user, and insufficiently entitled user receive the correct server-enforced state.
- Fresh rows render canonical evidence and link to the correct source/lot.
- Stale, unavailable, empty, denied, and upstream-error fixtures have distinct, truthful UI.
- No recommendation card renders when the API status is not `fresh`.
- Events distinguish page opens, evidence shown, source clicks, and explicit pilot dispositions without storing sensitive brief criteria in analytics payloads.
- Existing dashboard, catalog brief matches, Market Index, and chat behavior remain unchanged.
- Keyboard, screen-reader, mobile, loading, and reduced-motion behavior meet existing route standards.

## Test plan

- Server-load tests for ownership-safe not-found, entitlement denial, fresh, stale, unavailable, empty, and upstream failure.
- Component/route tests for evidence, source links, limitations, status copy, dispositions, keyboard use, and mobile layout.
- Dashboard test for the additive Radar action.
- Event tests that exclude criteria and user-entered text.
- `pnpm check --fail-on-warnings`, focused tests, lint, and production build using the repository's documented environment path.
- One post-deploy smoke with an owned test brief and manual source reconciliation.

## Risks and rollback

- **Risk:** the page overstates price evidence. Preserve API language, comparable context, and limitations.
- **Risk:** pilot instrumentation becomes a product feedback system. Keep fixed dispositions and no free-text persistence in the MVP.
- **Risk:** a new route expands navigation. Link only from existing active brief cards during the pilot.
- **Rollback:** remove or feature-disable the dashboard action and route. The Parchment endpoint, existing brief matches, and all current app workflows remain useful.

## Exact follow-on dependency

No implementation PR is assumed. Run the three-partner, four-week pilot. A recurring brief or alert plan may be written only if at least two partners surface and act on a genuinely new qualified lead and explicitly value passive delivery.
