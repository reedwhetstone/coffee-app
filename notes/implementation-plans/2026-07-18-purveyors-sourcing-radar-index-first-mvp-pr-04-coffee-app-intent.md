# Sourcing Radar MVP PR 4: Coffee-App Self-Service Intent

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `coffee-app`
**PR goal:** Give PPI customers a focused self-service setup and refinement experience over the canonical Parchment intent contract.

## Why this slice comes now

PR 2 makes intent ownership, entitlement, validation, and persistence canonical in Parchment. PR 3 adds the minimal Parchment-owned event contract that the personalized product will later consume. Coffee-app can now deliver the customer workflow without becoming a second backend: broker the authenticated session through its thin BFF, render the supported criteria, and preserve the API's success and error semantics.

This slice is independently useful even if personalized Radar presentation ships later. A PPI customer can tell Purveyors what they are sourcing, inspect existing canonical matches, refine the need, and deactivate it without operator intervention.

## In scope

- A lightweight self-service flow for an authenticated `ppiAccess` customer to create, view, refine, activate, and deactivate their own sourcing briefs.
- Reuse the existing closed-set criteria contract returned by the Parchment SDK. Do not fork validation or invent web-only criteria.
- Thin same-origin BFF/resource calls that broker the session credential and forward canonical requests without adding authorization or procurement logic.
- Focused setup UX in the existing authenticated product shell, with an obvious “Tell Parchment what you are sourcing” entry point.
- Honest loading, validation, denied, conflict, unavailable, empty, and success states derived from the canonical response.
- Existing matches as the immediate post-save utility while personalized Radar waits for PR 5.
- Focused route, BFF, component, accessibility, and regression tests.

## Out of scope

- Database migrations, direct Supabase writes, RLS logic, role mutation, or entitlement enforcement.
- A coffee-app-only sourcing-brief resource or response shape.
- Radar evidence, ranking, dashboard results, or Ask Parchment context.
- Natural-language criteria invention by an LLM. Parchment may open the structured setup flow, but the saved contract remains deterministic.
- New criteria, cadence, notifications, recommendation runs, team ownership, RFQs, purchasing, or supplier messaging.
- Pricing, checkout, public access, or CLI additions.

## Customer workflow

1. The customer chooses “Tell Parchment what you are sourcing” from the authenticated PPI experience.
2. They name the need and select from the currently supported constraints.
3. Coffee-app sends the canonical request through the thin BFF; Parchment validates and stores it under the authenticated owner.
4. The customer can inspect existing matches, refine the constraints, activate another saved need, or deactivate it.
5. PR 5 uses the same owned active brief as the input to the personalized Radar experience.

This should feel like configuring an agent, not filing an internal research form.

## Client invariants

- Coffee-app never sends or accepts a caller-selected `user_id`.
- The browser never writes `sourcing_briefs` or `user_roles` directly.
- The BFF attaches credentials and preserves the canonical request/response contract; it does not decide entitlement or revalidate business rules independently.
- No service-role credential reaches the browser or ordinary coffee-app runtime.
- The UI may be more restrictive than the API but never presents a control the canonical entitlement will reject as supposedly available.
- Existing member/admin brief presentation remains coherent.

## Likely files

- focused authenticated setup route or FormShell surface
- thin BFF/resource modules using the published `@purveyors/sdk`
- existing dashboard or PPI entry-point component for the setup action
- route, BFF, component, accessibility, and regression tests
- SDK dependency and lockfile update
- existing docs/copy where the PPI intent workflow is described

## Acceptance criteria

- A PPI-only authenticated customer can create, view, refine, activate, and deactivate their own valid sourcing brief without Mallard membership or operator intervention.
- The browser and BFF use only the canonical Parchment/SDK contract and never write Supabase directly.
- Canonical invalid-criteria, denied, conflict, unavailable, and upstream-error responses render distinct, useful states.
- Existing member/admin brief behavior remains available and covered.
- The setup flow is keyboard accessible, screen-reader coherent, mobile usable, and honest about supported constraints.
- After saving, the customer reaches existing matches or the next useful action without being asked to validate the product.
- No Radar presentation, notification, recommendation history, database migration, or external side effect is added.

## Test plan

- Thin BFF tests proving request/response forwarding, session credential brokerage, CSRF/trusted-mutation enforcement, and canonical error preservation.
- Component tests for setup, edit, activation, deactivation, validation, loading, empty, conflict, denied, and unavailable states.
- Negative test proving the browser path has no direct Supabase mutation.
- Regression coverage for existing dashboard and member/admin brief workflows.
- `pnpm check --fail-on-warnings`, focused tests, lint, and production build using the repository's documented environment path.

## Risks and rollback

- **Risk:** setup expands into a procurement requirements builder. Keep only the canonical supported criteria.
- **Risk:** the BFF accumulates business logic. Keep it to credential brokerage, forwarding, transport translation, and presentation-only metadata under parchment PADR-0015.
- **Risk:** conversational setup creates criteria the contract cannot represent. Save only deterministic values accepted by Parchment.
- **Rollback:** hide the PPI setup entry and revert the thin BFF/UX while preserving canonical briefs and existing read behavior.

## Exact follow-on dependency

PR 5 begins after the PPI setup flow is deployed, a PPI-only test account can create and maintain an owned active brief through the product path, and that brief returns a canonical Radar result from PR 1 without direct database access.
