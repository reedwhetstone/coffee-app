# Sourcing Radar MVP PR 2: PPI Self-Service Intent

**Program:** Purveyors Sourcing Radar, index-first MVP
**Repository:** `coffee-app`
**PR goal:** Let an authenticated Parchment Intelligence customer securely create and refine their own constrained sourcing intent without operator intervention.

## Why this slice comes now

Radar cannot be a real product if a paying customer needs an operator to seed its core input. The existing sourcing-brief substrate is useful, but its entitlement and write boundaries are fragmented: PPI-only principals do not have a coherent self-service path, direct brief writes are broader than the intended product contract, and client-writable `user_roles` cannot be treated as an authoritative capability source.

This PR makes sourcing intent a secure PPI product capability. It is independently useful even if the personalized Radar surface ships later because customers can save and maintain a real need and use the existing match workflow.

## In scope

- A lightweight self-service flow for an authenticated `ppiAccess` owner to create, view, refine, activate, and deactivate their own sourcing briefs.
- Reuse the existing versioned, closed-set criteria schema and validation. Do not add new criteria merely to make the setup flow feel richer.
- Derive `user_id` from the authenticated principal. The browser cannot submit or override ownership.
- Replace broad direct `sourcing_briefs` mutations with a reviewed server-side contract and RLS policies that enforce owner, entitlement, and criteria boundaries.
- Revoke authenticated `user_roles` INSERT/UPDATE/DELETE, including the current owner-update path, or replace role checks with an equivalent non-client-writable entitlement source/security-definer capability function.
- Preserve intended existing member/admin brief behavior.
- PPI-only, member/admin, anonymous, cross-owner, invalid-criteria, and role-escalation tests.
- Focused setup UX in the existing authenticated product shell. This is not a dashboard redesign.

## Out of scope

- Radar evidence, ranking, or result presentation.
- Concierge participant seeding as the normal workflow.
- Natural-language criteria invention by an LLM. Parchment may help the customer open the structured setup flow, but saved criteria remain deterministic and validated.
- New sourcing criteria, cadence, notifications, recommendation runs, team ownership, RFQs, purchasing, or supplier messaging.
- Pricing, checkout, public access, or CLI additions.

## Customer workflow

1. The customer chooses “Tell Parchment what you are sourcing” from the authenticated PPI experience.
2. They name the need and select from the existing supported constraints.
3. The server validates and stores the brief under the authenticated owner.
4. The customer can immediately inspect existing matches, refine the constraints, or deactivate the need.
5. PR 3 uses the same owned active brief as the input to the personalized Radar experience.

This should feel like configuring an agent, not filing an internal research form.

## Security invariants

- Entitlement and identity are enforced on the server for every mutation.
- A client cannot choose `user_id`, promote its own role, mutate another user's brief, or bypass criteria validation through Supabase REST.
- The authoritative capability source is not client-writable.
- No service-role credential reaches the browser or ordinary coffee-app runtime.
- Owner-scoped reads remain compatible with the canonical Parchment Radar endpoint.
- Existing member/admin behavior is preserved deliberately and covered by tests.

## Likely files

- the existing sourcing-brief server resource/action and criteria helpers
- focused authenticated setup route or FormShell surface
- existing dashboard or PPI entry-point component for the setup action
- `supabase/migrations/<timestamp>_harden_sourcing_brief_writes.sql`
- focused route, resource, and Supabase REST/RLS tests
- existing docs/copy where the entitlement contract is described

## Acceptance criteria

- A PPI-only authenticated customer can create, view, refine, activate, and deactivate their own valid sourcing brief without Mallard membership or operator intervention.
- Identity is principal-derived and cross-owner access is denied safely.
- Unsupported criteria fail closed and never silently no-op.
- A PPI-only session cannot promote itself through `user_roles` or bypass the reviewed brief mutation contract through Supabase REST.
- Member/admin brief behavior remains supported and tested.
- Anonymous and insufficiently entitled users receive the existing structured denial behavior.
- The setup flow is keyboard accessible, mobile usable, and honest about supported constraints.
- No Radar presentation, notification, recommendation history, or external side effect is added.

## Test plan

- Resource/action tests for create, refine, activate, deactivate, invalid criteria, ownership, and entitlement.
- Two-step negative test: attempted role promotion is denied, then direct brief mutation remains denied.
- Cross-owner and anonymous negative tests.
- Regression coverage for existing member/admin brief behavior.
- Component tests for setup, edit, validation, empty, and denied states.
- `pnpm check --fail-on-warnings`, focused tests, lint, and production build using the repository's documented environment path.

## Risks and rollback

- **Risk:** setup expands into a procurement requirements builder. Keep only the existing supported criteria.
- **Risk:** security hardening breaks legitimate member writes. Cover each intended principal class before migration rollout.
- **Risk:** conversational setup creates criteria the contract cannot represent. Save only values accepted by the deterministic schema.
- **Rollback:** hide the PPI setup entry and revert the server mutation path while preserving existing rows. Do not restore the client-writable role-escalation path.

## Exact follow-on dependency

PR 3 begins after a PPI-only test account can create an owned active brief through the reviewed product path and retrieve its canonical Radar result without operator intervention.
