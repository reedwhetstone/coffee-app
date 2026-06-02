# PR 03: Canonical Identity API and Member Comparison View

**Parent plan:** `2026-06-02-canonical-matching-completion-program.md`
**Branch suggestion:** `feat/canonical-identity-api-ui`
**Purpose:** Turn accepted identity links into a member-visible canonical comparison product.

## PR goal

Expose accepted canonical identities through coffee-app APIs and upgrade the member comparison UI so accepted identity listings, candidate links, and similar recommendations are clearly separated.

## Why this slice comes third

The UI should not invent identity state before persistence exists. After PR 02, accepted and rejected links become durable; this PR makes them useful to members.

## Mergeable-slice gate

This PR is mergeable even without scraper automation. Manually created/reviewed identities can power a real member comparison surface.

## In scope

- Add member/API-gated read endpoints such as `GET /v1/catalog/{id}/canonical` and `GET /v1/bean-identities/{id}`.
- Return accepted linked listings, candidate links where appropriate, pricing spreads, availability, and provenance-preserving merged metadata.
- Upgrade `SimilarCoffeePanel.svelte` to show accepted identity listings before beta candidates/recommendations.
- Show rejected/blocked state only when useful, without leaking internal review noise to normal members.
- Add docs copy for identity endpoint status and beta limitations.

## Out of scope

- Public identity pages.
- Scraper submission pipeline.
- Auto-linking.
- Member write/review controls unless they are tiny and clearly gated.
- CLI repo changes.

## Files to change

- `src/routes/v1/catalog/[id]/canonical/+server.ts`
- `src/routes/v1/bean-identities/[id]/+server.ts`
- `src/lib/server/beanIdentity.ts`
- `src/lib/server/beanIdentity.test.ts`
- `src/lib/components/catalog/SimilarCoffeePanel.svelte`
- `src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts`
- `src/lib/docs/content.ts`
- `src/lib/types/database.types.ts` if route helper typing needs updates

## Acceptance criteria

- Accepted identity reads are member/API-gated and return no premium details to anonymous users.
- Canonical identity response preserves supplier-row provenance and does not overwrite conflicting catalog facts.
- Pricing comparison uses canonical pricing fields and keeps `cost_lb` as compatibility fallback only.
- Member UI distinguishes accepted identity listings from beta candidates and similar recommendations.
- Route tests cover auth, no-identity, accepted identity, and conflict/provenance cases.

## Test plan

```bash
pnpm exec vitest run src/lib/server/beanIdentity.test.ts src/lib/components/catalog/SimilarCoffeePanel.svelte.test.ts
pnpm check --fail-on-warnings
pnpm run lint
```

Add route tests for new endpoints in the same style as `src/routes/v1/catalog/[id]/similar/similar.test.ts`.

## Risks

- Merged metadata can overclaim certainty. Return conflicts and provenance instead of smoothing them away.
- Empty identity states may feel underwhelming. Keep beta candidates/recommendations visible as fallback sourcing leads.

## Exact follow-on dependency

PR 04 updates app-owned agent tools to consume and describe the same accepted/candidate/recommendation semantics.
