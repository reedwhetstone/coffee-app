# PR 1: Saved Sourcing Brief Contract and Manual Match API

**Program:** Saved Sourcing Briefs and Procurement Recommendation Seed  
**Repo:** `coffee-app`  
**PR goal:** Add the user-owned saved sourcing brief data model, criteria validator, and manual match API needed for procurement workflows.

## Why this slice comes first

Saved procurement intent needs a durable canonical contract before UI, CLI, or recommendation runs. If this PR ships and later PRs never land, paid API users and internal agents can still save criteria and run current catalog matches manually.

## In scope

- Add a `sourcing_briefs` or `procurement_briefs` table with owner-only RLS.
- Define a versioned criteria schema with a deliberately narrow supported vocabulary.
- Add server validation that rejects unsupported filters instead of storing no-op criteria.
- Add create/list/get endpoints, proposed under `/v1/procurement/briefs` or `/v1/sourcing-briefs`.
- Add a manual matches endpoint that applies saved criteria to current catalog data.
- Gate create/run behind member or paid API capability.
- Return match reasons and limitations without ranking coffees as objectively better.

## Out of scope

- Web UI beyond minimal docs or hidden route wiring.
- CLI commands.
- Email, webhook, Discord, SMS, or cron delivery.
- Recommendation ranking beyond deterministic match reasons.
- Unsupported proof filters, similarity expansion, or canonical identity expansion.
- Stripe product changes.

## Specific files to change

Likely files:

- `supabase/migrations/<date>_sourcing_briefs.sql`
- Supabase generated database types, if tracked
- `src/lib/procurement/sourcingBriefCriteria.ts`
- `src/lib/procurement/sourcingBriefCriteria.test.ts`
- `src/lib/server/procurement/sourcingBriefs.ts`
- `src/lib/server/procurement/sourcingBriefs.test.ts`
- `src/routes/v1/procurement/briefs/+server.ts`
- `src/routes/v1/procurement/briefs/[id]/+server.ts`
- `src/routes/v1/procurement/briefs/[id]/matches/+server.ts`
- route tests near those endpoints
- docs content only if the route is intentionally documented at launch

## Acceptance criteria

- `sourcing_briefs` records are user-owned and protected by RLS.
- Criteria validation accepts only supported, pre-pagination-safe catalog constraints.
- Invalid criteria return a structured `400` response with the rejected field and allowed values.
- Anonymous callers cannot create/list/run briefs.
- Authenticated viewers or insufficient API plans receive structured entitlement errors.
- Member sessions and paid API keys can create, list, get, and run a brief.
- Matches preserve truthful pagination and include criteria, match reasons, limitations, and generated timestamp.
- Direct tests prove unsupported criteria cannot be silently stored or ignored.

## Test plan

```bash
pnpm test -- \
  src/lib/procurement/sourcingBriefCriteria.test.ts \
  src/lib/server/procurement/sourcingBriefs.test.ts \
  src/routes/v1/procurement/briefs/briefs.test.ts
pnpm check --fail-on-warnings
pnpm lint
```

If local env exports are unavailable, report `VALIDATION_BLOCKED_ENV` with the exact missing values and rely on CI for the same commands.

## Risks

- **Criteria drift:** Avoid duplicating catalog semantics. Delegate to existing catalog parsing/resource helpers where possible.
- **Pagination lies:** Do not implement filters that can only be applied after pagination.
- **Entitlement confusion:** Keep saved briefs as member/API leverage per ADR-005.
- **Naming churn:** Pick a route name before coding and keep aliases out of PR 1 unless compatibility is required.

## Exact follow-on dependency

PR 2 can add the member web workflow once PR 1 exposes create/list/get/matches endpoints and stable error semantics. PR 2 should not introduce a separate UI-only saved-search model.
