# Sourcing Radar MVP PR 2: Coffee-App Manual Value Test

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `coffee-app`
**PR goal:** Add one Parchment Intelligence–entitled (`ppi_access`) manual Radar route that tests whether indexed brief matches improve qualified discovery. Radar is not a member-tier ($9 membership) or public surface. PPI-only users must be able to discover the route from their owned active-brief dashboard cards; Mallard membership is not an additional prerequisite.

## Why this slice comes now

PR 1 makes the composition contract canonical and independently usable. Coffee-app should now act as a thin reference client: expose the result, preserve its trust metadata, hand the buyer to the source, and measure whether the workflow changes discovery behavior.

This PR is the complete buyer-facing MVP. It is not the first step of an assumed alerting roadmap. Recurrence earns a later plan only if the concierge pilot passes its behavioral threshold (see the program plan's pilot section: target five partners, eight to twelve weeks, sample/quote dispositions as the primary proof).

## In scope

- One route for an owned active brief, proposed as `/procurement/briefs/[id]/radar`.
- A “Review indexed matches” action on existing dashboard active-brief cards.
- Dashboard active-brief loading for authenticated `ppiAccess` principals as well as members/admins, preserving the existing owner-scoped query and without broadening brief creation or editing permissions. The Radar action is shown only when `ppiAccess` is true.
- Server-first loading through the Parchment SDK.
- Fresh result rows with lot identity, current price, brief-match reasons, eligible signal evidence, lot-age context (crop year / first-observed date, or the API's `ageContext: unknown` disclosure rendered honestly), source, publication freshness/quality, limitations, and one source-detail action.
- Honest stale, unavailable, empty, denied, and error states.
- Concierge pilot onboarding: before each PPI-only participant starts, an authorized operator uses the private participant-seed runbook below to provision one active brief under that participant's user ID; the caller-owned `POST /v1/procurement/briefs` contract is not used with the operator's credentials, and no new self-service brief capture is added.
- Minimal events for Radar open, indexed row impression, source-detail click, and pilot disposition. This introduces a small new pilot-event helper — the repo has no general client event-tracking pattern today, so this is new telemetry surface, kept deliberately minimal: server-side capture, fixed event names, no criteria or user-entered text in payloads.
- A compact pilot disposition control: already known, investigate, shortlist, sample/quote, or not relevant.
- Focused tests and existing docs/copy alignment where required.

## Out of scope

- Dashboard redesign, a new global nav destination, or Market Index page changes. The additive dashboard server-load change needed to expose owned active briefs to PPI-only users is in scope.
- Automatic refresh, scheduler, email, Discord, webhook, SMS, or push delivery.
- Stored recommendation runs, notification preferences, team workflows, or history charts.
- Client-side ranking, freshness decisions, signal calculation, or AI summaries.
- PPI self-service brief creation/editing, CLI changes, pricing, checkout, or public teaser work. The pilot is explicitly concierge-seeded through a private operator control-plane path; this PR adds no new public/member write route, schema, or permission broadening.
- Purchase, RFQ, supplier-message, inventory-write, or other external actions.

## PPI-only participant seed runbook

The documented procurement contract is caller-owned: `POST /v1/procurement/briefs` stores `user_id` from the authenticated caller, and the read/match routes reject a different owner. An operator token therefore cannot create a participant-owned brief by calling that endpoint. The pilot must use this private, operator-only setup path instead:

1. Confirm the participant's canonical authenticated principal ID from the enrollment record and verify it with the participant before writing anything.
2. Run the approved private Parchment control-plane seed operation, such as an admin-only command/RPC or a one-time service-role transaction in the private API environment. Insert exactly one active manual brief with `user_id` set to the participant principal, normalized versioned criteria, a participant-safe name, `cadence: manual`, and `is_active: true`. Never expose the service-role credential to the browser, participant, or coffee-app runtime, and never use the ordinary caller-owned POST with an operator credential.
3. Record the returned brief ID, participant principal ID, criteria version, operator, and UTC timestamp in the restricted pilot log. Do not record credentials or copy sensitive brief criteria into analytics payloads.
4. Verify the result as the participant: `GET /v1/procurement/briefs/{id}` must return the brief to the participant, and the participant's dashboard must show the owned active brief. Then verify that the Radar route uses that same owner-scoped brief.

This is a pilot prerequisite, not a new self-service or public API capability. If the private control-plane operation does not exist, stop onboarding and make its implementation an explicitly reviewed `parchment-api` prerequisite; do not substitute an ad hoc database edit or broaden the caller-owned contract.

## UX invariants

- The page leads with the brief and “worth inspecting” / “price anomaly — verify crop and cup” language, never purchase advice, never “deal” or “opportunity.”
- Freshness, publication date, source, evidence, lot-age context, and limitations are visible without opening a secondary panel. A row with `ageContext: unknown` says so where the buyer will see it — a price drop on an aging lot is clearance, not value.
- `stale` and `unavailable` states never render opportunity cards. They may link to the existing plain catalog matches and explain why indexed evidence is withheld.
- The full match workflow remains available. Radar is a focused evidence view, not a replacement.
- One action reaches the canonical supplier/source or lot-detail record.
- No UI code recalculates score, rank, age, or entitlement.

## Likely files

- `src/routes/procurement/briefs/[id]/radar/+page.server.ts`
- `src/routes/procurement/briefs/[id]/radar/+page.svelte`
- focused route/component tests
- `src/routes/dashboard/+page.server.ts`, `src/routes/dashboard/+page.svelte`, and their tests
- a small new pilot-event helper (no existing client event pattern to reuse; define where events land — a server-side log table is sufficient for the pilot)
- dependency/lockfile updates only if the Parchment SDK release requires them

## Acceptance criteria

- A PPI-only entitled owner can see their owned active briefs on the dashboard and open Radar from the “Review indexed matches” action; Mallard membership is not required.
- A PPI-only pilot participant is onboarded through the seed runbook with one brief whose stored owner is the participant, and participant-authenticated GET/dashboard checks prove the ownership before the test starts.
- A member/admin without `ppiAccess` retains the existing brief/catalog workflow but does not receive the Radar action.
- Another user, anonymous user, and insufficiently entitled user receive the correct server-enforced state.
- Fresh rows render canonical evidence, including lot-age context or its `unknown` disclosure, and link to the correct source/lot.
- Stale, unavailable, empty, denied, and upstream-error fixtures have distinct, truthful UI.
- No recommendation card renders when the API status is not `fresh`.
- Events distinguish page opens, evidence shown, source clicks, and explicit pilot dispositions without storing sensitive brief criteria in analytics payloads.
- Existing dashboard, catalog brief matches, Market Index, and chat behavior remain unchanged.
- Keyboard, screen-reader, mobile, loading, and reduced-motion behavior meet existing route standards.

## Test plan

- Server-load tests for ownership-safe not-found, entitlement denial, fresh, stale, unavailable, empty, and upstream failure.
- Component/route tests for evidence, source links, limitations, status copy, dispositions, keyboard use, and mobile layout.
- Dashboard server-load and component tests prove that PPI-only owners receive active-brief cards and the Radar action, while users without `ppiAccess` do not receive that action.
- Pilot setup documentation proves that operator seeding writes the participant owner through the private control-plane path and does not rely on the caller-owned create contract.
- Event tests that exclude criteria and user-entered text.
- `pnpm check --fail-on-warnings`, focused tests, lint, and production build using the repository's documented environment path.
- One post-deploy smoke with an owned test brief and manual source reconciliation.

## Risks and rollback

- **Risk:** the page overstates price evidence. Preserve API language, comparable context, and limitations.
- **Risk:** pilot instrumentation becomes a product feedback system. Keep fixed dispositions and no free-text persistence in the MVP.
- **Risk:** a new route expands navigation. Link only from existing active brief cards during the pilot.
- **Risk:** the feed goes partial or dark mid-pilot (supplier blocks, layout churn, or a gated source dropped for consent reasons). The stale/unavailable states must make "the feed is down" visibly different from "no matches for your brief," and the pilot log should record staleness-at-click so slow-feed outcomes are distinguishable from wrong-signal outcomes.
- **Rollback:** remove or feature-disable the dashboard action and route. The Parchment endpoint, existing brief matches, and all current app workflows remain useful.

## Exact follow-on dependency

No implementation PR is assumed. Run the concierge pilot defined in the program plan: target five partners (three floor), eight to twelve weeks or timed to a heavy arrival season. A recurring brief or alert plan may be written only if the behavioral threshold passes — Radar-surfaced lots the partners had not already found lead to source-detail visits and explicit sample/quote dispositions within the freshness window for a majority of active partners, the past-crop/already-known rate stays low, and partners explicitly value passive delivery.
