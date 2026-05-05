# Similarity API Production Trust Repair

**Date:** 2026-05-05
**Planning mode:** Planning only, no code changes in this PR
**Selected program:** Repair the live `/v1/catalog/:id/similar` success path, then publish/discover it as a beta API contract only after live smoke verification.
**Recommended shape:** Two independently mergeable PRs in order.
**Recommended first PR:** PR 1, production success-path repair and smoke gate.

## Feature or program

Turn the newly merged catalog similarity API from a source-level beta route into a production-trustworthy Parchment API contract.

The route now exists on `origin/main` and live production, and its auth and validation edges behave correctly. The entitled success path does not. A valid member API-key request to `GET /v1/catalog/:id/similar` returns `HTTP 500` with `Failed to fetch similar coffees`, while the same route returns expected `401`, `400`, and `404` responses for pre-RPC cases.

That makes this the highest-leverage Parchment API target today: the endpoint is positioned as the canonical matching contract for web, CLI, API, and agent consumers, but it cannot yet be trusted by any of them.

## Why now

- `origin/main` just merged PR #331, `feat/canonical-similarity-api`, so the endpoint is new and strategically central.
- Open PRs already depend on this contract or adjacent matching work:
  - #332, member similar coffee comparison UI.
  - #336, similarity threshold calibration harness.
  - The existing PR 03 plan for CLI and agent matching alignment.
- Live production shows a success-path failure, not just missing docs.
- The failure blocks API-first trust. Agents and API consumers need a deterministic contract, not an endpoint that passes mocked route tests but fails when it touches production data/RPCs.
- `notes/PRODUCT_VISION.md` says API-first is product strategy, the CLI is a core agent surface, and shared logic should serve web, CLI, external API, and agents together. A broken canonical route forks that strategy immediately.

## Live API evidence, 2026-05-05

Commands used the live `PURVEYORS_API_KEY` from `~/.env`; the key value was not written into this plan.

Baseline API health:

- `GET /v1/catalog?limit=3` with API-key auth returned `HTTP 200`, `pagination.total = 1040`, and `meta.auth.kind = "api-key"`, `meta.auth.apiPlan = "member"`.
- `GET /v1/catalog?include=proof&limit=3` returned `HTTP 200` with the same catalog envelope.
- `GET /v1/price-index?origin=Ethiopia&limit=5` returned `HTTP 200`, `pagination.total = 1130`, and `meta.auth.ppiAccess = true`.
- `GET /v1/catalog?fields=summary&limit=3` returned `HTTP 400`, proving unknown/unsupported summary projection fails closed.
- `GET /v1/catalog/proof-coverage` returned `HTTP 404`, but that endpoint is already covered by open PR #335.

Similarity route evidence:

- Sample target id from `GET /v1/catalog?limit=1`: `1960`.
- `GET /v1/catalog/1960/similar?limit=3` with the member API key returned `HTTP 500`:

```json
{
  "error": "Failed to fetch similar coffees",
  "message": "Internal server error"
}
```

- `GET /v1/catalog/1960/similar?limit=3&mode=likely_same` returned `HTTP 500`.
- `GET /v1/catalog/1960/similar?limit=3&mode=similar_profile` returned `HTTP 500`.
- `GET /v1/catalog/1960/similar?limit=3&stocked_only=false` returned `HTTP 500`.
- The same route without auth returned `HTTP 401` with `code = "auth_required"` and `requiredCapability = "canUseBeanMatching"`.
- The same route with an invalid bearer token returned `HTTP 401`.
- `GET /v1/catalog/1960/similar?limit=99` returned `HTTP 400` with the expected max-limit validation.
- `GET /v1/catalog/2147483648/similar` returned `HTTP 400` with the expected int4 id validation.
- `GET /v1/catalog/999999999/similar?limit=3` returned `HTTP 404`, proving target lookup failure is handled.
- `GET /v1` does not list the similarity route under `resources`, so the endpoint is present but not discoverable through the canonical v1 index.

CLI evidence:

- Installed global `purvey --version` is `0.14.0`.
- `purvey auth status` reports unauthenticated.
- `purvey catalog stats` and `purvey catalog search --origin Ethiopia --limit 3 --pretty` exit with `AUTH_ERROR`.
- This does not block the API repair, but it reinforces that agent and CLI alignment should wait until the live HTTP contract is healthy.

## Problem description

`/v1/catalog/:id/similar` is meant to be the canonical matching route for member/API-gated coffee similarity. In production, valid entitled API-key calls fail on the success path.

The failure is especially important because the non-success-path behavior mostly works:

- auth-required responses are explicit
- invalid API keys are rejected
- invalid ids and invalid limits fail closed
- unknown valid ids return 404

That narrows the problem to the entitled path after validation and principal resolution. The route likely reaches the Supabase/admin/RPC similarity layer, then fails inside one of the production dependencies that route tests currently mock.

## Root cause analysis

The exact root cause needs implementation-time log inspection, but source and live evidence point to a production dependency gap rather than a route-shape design problem.

Likely failure classes:

1. **Production SQL/RPC mismatch:** the route calls `find_similar_beans_aggregated_v2` and `count_similar_beans_aggregated_v2`. If the migration was not applied, the function signatures differ, the vector query fails, or the function grants are wrong, only the success path would fail.
2. **Service-role or Supabase admin path issue:** the route intentionally revokes v2 RPCs from `anon` and broad `authenticated`, then calls through `createAdminClient()`. If production service-role credentials, grants, or function execution privileges are misaligned, the premium route fails while pre-RPC validation still passes.
3. **Data-dependent SQL/runtime issue:** the function may exist but fail against production `coffee_chunks`, vector extension behavior, null embedding rows, type casts, or returned column definitions.
4. **Test coverage blind spot:** `src/routes/v1/catalog/[id]/similar/similar.test.ts` mocks Supabase and asserts the expected RPC calls, but it does not execute the SQL functions or a production-like Supabase client. PR #331 verification passed source-level tests but did not include a live post-deploy smoke for the member/API-key success path.
5. **Discovery gap:** `/v1` does not list the similarity endpoint. That is not the 500 root cause, but it shows the route has not fully graduated into the published v1 contract surface.

This is not a reason to abandon the route. It is exactly why the first repair slice should add a production-contract gate before CLI, UI, and docs build on top of it.

## Proposed program

### PR 1: Similarity API production success-path repair

Repair `GET /v1/catalog/:id/similar` so the member/API-key success path works against production-equivalent dependencies, and add a repeatable smoke path that would have caught today's failure before follow-on surfaces depended on it.

Implementation should start with logs and dependency verification, not speculative code changes:

1. Inspect production/Vercel/Supabase logs for the `Failed to fetch similar coffees` error around the live test window.
2. Verify whether `20260504_canonical_similarity_contract.sql` is applied in production.
3. Verify the exact function signatures, grants, and service-role execution path for:
   - `find_similar_beans_aggregated_v2(INT, FLOAT, INT, BOOLEAN)`
   - `count_similar_beans_aggregated_v2(INT, FLOAT, BOOLEAN)`
4. Run the RPC manually through a trusted server/admin path or a safe local Supabase-equivalent fixture if production DB access is unavailable.
5. Patch the smallest root cause: migration/grant/application, SQL return type, route error handling, admin client use, or query parameter mapping.
6. Add a validation note or script that smokes a known public catalog id through the deployed HTTP route with an API key after deployment.

The PR is independently shippable when valid API-key calls return a canonical `catalog-similarity` envelope, even if no CLI or UI changes land.

### PR 2: Similarity route discovery and docs

After PR 1 is live-smoke green, add the similarity route to `/v1` discovery and the API docs as a beta member/API capability.

Docs should be intentionally conservative:

- Mark the resource as `beta`.
- State that matching is member/API leverage per ADR-005, not anonymous proof.
- Document accepted query params: `threshold`, `limit`, `stocked_only`, and `mode = all | likely_same | similar_profile`.
- Document response limitations: beta confidence, not canonical identity, no automatic substitution guarantee.
- Include success, auth-required, entitlement-required, validation, not-found, and rate-limit examples.
- Do not advertise CLI usage until the CLI alignment PR is implemented and released.

The PR is independently shippable after PR 1 because it only makes the already-working beta contract discoverable and legible.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate | Vision | Data moat / decision quality | Cross-surface | Public/access | Foundation | Total | Feasibility gate | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Similarity API production trust repair | 5 | 5 | 4 | 3 | 3 | 20 | Medium. Requires logs/SQL verification, but scope is narrow and live failure is concrete. | Selected |
| Proof coverage endpoint | 5 | 5 | 4 | 3 | 3 | 20 | Already covered by open PR #335. | Defer, avoid duplicate planning |
| Similarity threshold calibration | 5 | 5 | 3 | 2 | 3 | 18 | Already covered by open PR #336, and it should not calibrate against a broken live route. | Defer behind repair |
| Saved sourcing brief procurement seed | 5 | 5 | 3 | 3 | 3 | 19 | Already covered by open PR #337, and it depends on trustworthy API primitives. | Defer, avoid duplicate planning |
| Parchment Intelligence CLI price-index bridge | 5 | 4 | 4 | 3 | 3 | 19 | Existing 2026-05-04 plan covers it; cross-repo CLI release sequencing is separate. | Defer |
| Pure `/v1` discovery cleanup | 3 | 1 | 3 | 3 | 1 | 11 | Useful only after endpoints work. | Fold into PR 2 |

## Scope in and out

### In scope

- Fix the live success path for `GET /v1/catalog/:id/similar` with member/API-key auth.
- Verify production function availability, signatures, grants, and route execution path.
- Add targeted tests or smoke tooling that exercises the real success-path assumptions missed by mocked route tests.
- Preserve existing 401, 400, 403, 404, and 429 semantics.
- Preserve API-key rate headers and usage logging.
- Add `/v1` discovery/docs only after success-path repair.
- Keep response copy beta and provenance-safe.

### Out of scope

- CLI migration to the endpoint.
- Member comparison UI changes.
- Threshold calibration changes.
- Canonical identity tables or auto-linking.
- Supplier/direct-feed matching.
- Broad refactors of `catalogSimilarity.ts` unrelated to the production failure.
- Raw evidence exposure, proof coverage, or proof query filters.
- Changing API tiers or Stripe entitlements.

## Strategy Alignment Audit

- **Canonical direction:** This aligns with `notes/PRODUCT_VISION.md` because Purveyors is supposed to be a coffee intelligence platform with stable API-first machine contracts. Similarity is decision leverage: it helps roasters and agents compare substitutes, likely duplicate lots, and profile-near alternatives across suppliers.
- **API-first contribution:** The selected work repairs the canonical route before web, CLI, and agent layers consume it. That keeps matching behavior centralized instead of falling back to direct RPC calls, UI-local heuristics, or CLI-only behavior.
- **Public value legibility:** PR 2 makes the beta route discoverable through `/v1` and docs, but only after PR 1 proves it works. That keeps the public contract honest and avoids advertising a broken capability.
- **Cross-surface consistency:** A working route lets the member UI, CLI, docs, internal tools, and external API users share the same auth, limits, query vocabulary, confidence copy, pricing fields, and match categories.
- **Moonshot check:** `brain/moonshots/2026-04-16-purveyors-copilot-network.md` and `brain/moonshots/2026-04-09-open-coffee-listing-standard.md` informed this plan. The independently shippable proving slice is not a full copilot or listing standard; it is a reliable canonical similarity API that agents and buyer workflows can trust before recommendations, substitutions, supplier comparisons, or CLI automation build on top of it. `brain/moonshots/2026-04-30-purveyors-proof-layer.md` did not win today because proof coverage is already covered by open PR #335. `brain/moonshots/2026-04-07-procurement-brief.md` did not win today because saved brief/procurement seed work is already covered by PR #337 and still benefits from the same platform trust repair.
- **Scope discipline:** This plan intentionally excludes CLI alignment, member UI, threshold calibration, canonical identity persistence, proof coverage, saved searches, alerts, and direct supplier feeds. The selected slice is the smallest work that restores trust in a live API contract and unblocks those follow-ons.

## Acceptance criteria

### Program-level

- Valid member/API-key calls to `GET /v1/catalog/:id/similar` return `HTTP 200` and a canonical `catalog-similarity` envelope in production.
- Auth-required, invalid-token, entitlement-required, invalid-query, not-found, and rate-limit paths keep explicit JSON responses.
- The root cause is identified in the PR description, not guessed.
- A repeatable live or production-equivalent smoke command is documented for future deploys.
- `/v1` discovery and docs only advertise similarity after the success path is repaired.

### PR 1

- `GET /v1/catalog/<known-id>/similar?limit=3` with a member API key returns `HTTP 200`.
- The response includes:
  - `meta.resource = "catalog-similarity"`
  - `meta.namespace = "/v1/catalog/{id}/similar"`
  - `meta.status = "beta"`
  - `meta.access.requiredCapability = "canUseBeanMatching"`
  - `data.target`
  - `data.matches` array
  - canonical pricing fields and `price_delta_1lb`
  - dimension scores and match category
- `mode=likely_same` and `mode=similar_profile` do not 500.
- `stocked_only=false` does not 500.
- Production SQL/function/grant assumptions are covered by either an executable assertion, a migration verification test, or a documented smoke step that runs during release.
- Existing targeted tests still pass.

### PR 2

- `GET /v1` lists `catalogSimilarity` or equivalent under resources with `href = "/v1/catalog/{id}/similar"`, `status = "beta"`, and auth/access metadata.
- API docs explain query params, response shape, access requirements, rate limits, and beta limitations.
- Docs do not claim CLI support until the CLI command is actually released.
- Docs include a success smoke and common error examples.

## Verification commands

### Current live evidence commands

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)
BASE='https://www.purveyors.io'
ID=$(curl -sS "$BASE/v1/catalog?limit=1" \
  -H "Authorization: Bearer $API_KEY" | jq -r '.data[0].id')

curl -sS -D /tmp/catalog.headers \
  "$BASE/v1/catalog?limit=3" \
  -H "Authorization: Bearer $API_KEY" | jq '{pagination, meta}'

curl -sS -i \
  "$BASE/v1/catalog/$ID/similar?limit=3" \
  -H "Authorization: Bearer $API_KEY"

curl -sS -i \
  "$BASE/v1/catalog/$ID/similar?limit=3&mode=likely_same" \
  -H "Authorization: Bearer $API_KEY"

curl -sS -i \
  "$BASE/v1/catalog/$ID/similar?limit=3&stocked_only=false" \
  -H "Authorization: Bearer $API_KEY"

curl -sS "$BASE/v1" | jq '.resources'
```

### PR 1 local validation

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
pnpm vitest run src/lib/server/catalogSimilarity.test.ts src/lib/server/catalogAccess.test.ts src/routes/v1/catalog/[id]/similar/similar.test.ts
```

### PR 1 production-equivalent SQL/admin validation

Exact command depends on available DB access during implementation. The PR should include one of these gates:

```sql
select proname, oid::regprocedure
from pg_proc
where proname in ('find_similar_beans_aggregated_v2', 'count_similar_beans_aggregated_v2');

select has_function_privilege(
  'service_role',
  'find_similar_beans_aggregated_v2(integer,double precision,integer,boolean)',
  'execute'
);
```

or an equivalent trusted Supabase/admin invocation that proves the route's RPC dependency works.

### PR 1 live post-deploy smoke

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)
BASE='https://www.purveyors.io'
ID=$(curl -sS "$BASE/v1/catalog?limit=1" \
  -H "Authorization: Bearer $API_KEY" | jq -r '.data[0].id')

curl -sS "$BASE/v1/catalog/$ID/similar?limit=3" \
  -H "Authorization: Bearer $API_KEY" \
  | jq '{meta: .meta, target: .data.target.id, matches: (.data.matches | length)}'
```

### PR 2 validation

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
pnpm vitest run src/routes/v1/v1.test.ts src/lib/docs/content.test.ts
curl -sS https://www.purveyors.io/v1 | jq '.resources'
```

## Risks and rollback

- **Risk: the root cause is deployment/migration state rather than repo code.** Mitigation: implementation starts with logs and function verification. If the fix is an operational migration apply, document that explicitly and avoid unnecessary code churn.
- **Risk: route tests stay green while production fails again.** Mitigation: add a smoke gate that exercises a known live catalog id through the deployed HTTP route with API-key auth.
- **Risk: discovery/docs advertise beta matching too early.** Mitigation: PR 2 waits for PR 1 and live smoke.
- **Risk: SQL grants are loosened to make the endpoint work quickly.** Mitigation: preserve the PR #331 security decision that v2 RPCs are premium and service-route mediated. Do not re-grant broad `anon` or `authenticated` execution as a shortcut.
- **Risk: fixing success path reveals sparse match data.** Mitigation: an empty `matches` array is acceptable when truthful. A 500 is not.
- **Rollback:** If the repair cannot be validated quickly, hide or omit similarity from `/v1` discovery/docs and keep UI/CLI follow-ons blocked until the API success path is reliable.

## Open questions for implementation

1. Did the production deployment apply `20260504_canonical_similarity_contract.sql`, including function grants?
2. Does `createAdminClient()` have the expected service-role path in the live deployment?
3. Is the 500 caused by missing functions, function privilege, vector query runtime, returned column type mismatch, or data-specific null/type behavior?
4. Should PR 1 add an internal smoke script under `scripts/`, a documented release checklist command, or a test that can run against configured Supabase test credentials?
5. After repair, should `/v1` discovery call the resource `catalogSimilarity`, `similarCatalogCoffees`, or nest it under `catalog.actions.similar`?
