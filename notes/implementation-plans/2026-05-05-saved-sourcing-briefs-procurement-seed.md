# Saved Sourcing Briefs and Procurement Recommendation Seed

**Selected program:** Turn the new watchlist/procurement-alert DEVLOG item into a constrained, API-first saved sourcing brief product that can later power procurement briefs, agent workflows, and alerts.

**Recommended first PR:** PR 1, saved sourcing brief contract and manual match API in `coffee-app`.

**Repo ownership:** `coffee-app` first for user-owned state, entitlement enforcement, and canonical `/v1` contracts. `purveyors-cli` follows after the API contract is stable.

## Feature or program

Build the first durable procurement workflow primitive for Purveyors: a user can define a sourcing brief such as "washed Colombia under $6.50/lb, stocked, fresh arrivals preferred," save it, and ask Purveyors for matching lots using the same catalog semantics as the web/API surface.

This is not email delivery, a generalized AI copilot, or a full weekly PDF brief. It is the smallest useful product substrate underneath those ideas:

1. A constrained sourcing-brief criteria schema.
2. User-owned saved sourcing brief records.
3. A manual match endpoint that returns current matching catalog rows plus explanation metadata.
4. A member web workflow to save and inspect briefs.
5. CLI commands for agents and operators once the HTTP contract proves stable.
6. A later in-app shadow recommendation run that ranks matches and stores the output without sending external notifications.

## Why now

- `notes/DEVLOG.md` now explicitly lists **API / Procurement: Build explicit user watchlists and procurement alerts** under Priority 14.
- `notes/PRODUCT_VISION.md` says paid leverage should include saved searches, alerts, comparisons, premium charts, and agentic workflows. The missing primitive is user-owned recurring intent.
- ADR-005 draws the boundary cleanly: public users can inspect proof and catalog data; members should get search, monitoring, comparison, and workflow leverage.
- Existing active implementation PRs are already carrying the two obvious proof/matching lanes: PR #335 covers proof coverage, PR #336 covers similarity threshold calibration, and PR #332 covers member similar comparison UI.
- Prior plans already cover the Parchment Intelligence CLI bridge and proof coverage/query path. Creating another planning PR for those would be duplicate planning, not leverage.
- The moonshot docs have converged on the same operational primitive. Procurement Brief wants a recurring decision-ready product; Copilot Network wants saved constraints plus provenance-backed recommendations; Open Coffee Listing Standard names buyer watchlists and alerts as the buyer-side workflow layer.

## Strategy context pass

Active themes pulled from the canonical sources:

1. **Coffee intelligence over browsing:** Purveyors should help buyers make sourcing decisions, not only view richer cards.
2. **Data moat into workflow:** Supplier coverage, price history, proof summaries, similarity, and availability tracking become more defensible when they drive recurring saved intent.
3. **API-first contracts:** Saved sourcing intent and match results should be canonical HTTP contracts before they become UI-only state.
4. **CLI and agents as customers:** Once briefs exist through `/v1`, agents need a trustworthy CLI path to create, list, and run them without scraping pages.
5. **Public proof, paid leverage:** Anonymous surfaces show that data exists. Saved briefs, recurring recommendations, and alerts are member/API leverage.
6. **Moonshot proving slice:** The cheap proving experiment for both Procurement Brief and Copilot Network is saved constraints plus explainable recommendations, not a full copilot platform.

`notes/MARKET_ANALYSIS.md` was requested but is not present on `origin/main`; `notes/API_notes/API-strategy.md`, `notes/PRODUCT_VISION.md`, ADRs, DEVLOG, moonshots, blog posts, and outlines were used as the strategy inputs.

## Completion reconciliation

Already shipped or actively covered elsewhere:

- `/v1/catalog` is the canonical catalog contract per ADR-002.
- `/v1/price-index` has shipped; the CLI command bridge already has a dedicated 2026-05-04 plan.
- `include=proof` shipped and proof coverage/query has a dedicated plan; PR #335 is open for proof coverage.
- `/v1/catalog/:id/similar` has merged in PR #331; member UI and calibration are already open as PR #332 and PR #336.
- The watchlist/procurement alert DEVLOG item exists, but no implementation plan or open PR creates saved sourcing intent yet.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate                                                 | Vision | Data moat / decision quality | Cross-surface | Public/access | Foundation | Total | Feasibility gate                                                                                                                  | Decision                               |
| --------------------------------------------------------- | -----: | ---------------------------: | ------------: | ------------: | ---------: | ----: | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Saved sourcing briefs and procurement recommendation seed |      5 |                            5 |             4 |             3 |          3 |    20 | Medium. Needs user-owned schema and careful entitlement boundaries, but starts with manual matching and existing catalog filters. | Selected                               |
| Canonical matching continuation                           |      5 |                            5 |             4 |             3 |          3 |    20 | Strong, but already has merged/open implementation PRs and a full plan.                                                           | Defer to active PRs                    |
| Proof coverage and proof query leverage                   |      5 |                            5 |             4 |             3 |          3 |    20 | Strong, but PR #335 is already open and a plan exists.                                                                            | Defer to active PR                     |
| Parchment Intelligence CLI bridge                         |      5 |                            4 |             4 |             3 |          3 |    19 | Still important, but already planned on 2026-05-04 and does not create new recurring buyer intent.                                | Implement existing plan, do not replan |
| Certifications taxonomy schema                            |      5 |                            5 |             3 |             2 |          2 |    17 | Good data-moat work, but less immediately tied to a paid workflow or current active product milestone.                            | Defer                                  |
| V1 catalog summary projection                             |      4 |                            3 |             4 |             2 |          2 |    15 | Existing plan, useful for agents, but less strategic than saved procurement intent today.                                         | Defer                                  |

## Strategy Alignment Audit

- **Canonical direction:** This aligns with `notes/PRODUCT_VISION.md` by turning normalized coffee data into trustworthy decisions for roasters, developers, and agents. It strengthens saved searches, alerts, CLI/API consistency, and the access ladder rather than adding a standalone UI convenience.
- **Product principle supported:** Data moat over feature sprawl. A saved sourcing brief converts catalog facts, price history, proof summaries, availability, and similarity into durable buyer intent that can compound into alerts, recommendations, and procurement briefs.
- **Cross-surface effect:** High. `coffee-app` owns the canonical schema, user state, and `/v1` endpoints. `purveyors-cli` should later consume those endpoints so agents can create and run briefs. Web UI becomes a member workflow, not the only source of truth.
- **Public value legibility:** High but gated. Public catalog and analytics can tease that sourcing briefs exist. Creating, running, and saving briefs should require member/API leverage per ADR-005.
- **Moonshot check:** Informed by `brain/moonshots/2026-04-07-procurement-brief.md`, `2026-04-16-purveyors-copilot-network.md`, and `2026-04-09-open-coffee-listing-standard.md`. The selected proving slice is saved sourcing intent plus manual explainable matches. It is independently useful and avoids jumping straight to email delivery, supplier claim flows, RFQs, or autonomous purchasing.
- **Scope check:** Excludes email/SMS notifications, cron delivery, Stripe product changes, supplier-published feeds, RFQs, external side effects, autonomous buying, broad GenUI chat, and unsupported proof/similarity filters until those contracts are live.

## Scope in / out

### In scope

- Define a constrained sourcing-brief criteria contract using existing catalog filters and price/freshness constraints that can be applied before pagination.
- Add user-owned saved sourcing brief storage with RLS and server-side validation.
- Add canonical manual match endpoints, proposed under `/v1/procurement/briefs` or `/v1/sourcing-briefs`.
- Gate creation and match execution behind member/API paid leverage.
- Add a member web workflow for saving current catalog criteria and reviewing current matches.
- Add CLI commands only after the HTTP contract and response envelope are stable.
- Add a later in-app shadow recommendation run that ranks matches with clear provenance and stores output for inspection.

### Out of scope

- Email delivery, Discord delivery, webhook alerts, SMS, or any external notification side effect.
- Autonomous purchase recommendations or RFQ submission.
- Supplier claim/profile/direct-feed workflows.
- New Stripe products or billing checkout changes.
- New proof-query filters before the proof-query plan lands.
- Similarity expansion unless the canonical matching/calibration work has shipped enough confidence labels to be safe.
- Rewriting catalog search or adding a generic rules engine.

## Proposed UX or behavior

### API behavior

Proposed canonical resources:

- `POST /v1/procurement/briefs`
  - Requires authenticated member session or paid API plan.
  - Accepts `{ name, criteria, cadence: "manual" }` at launch.
  - Validates every criterion against a supported vocabulary. Unsupported filters fail closed with the existing structured invalid-query style.
- `GET /v1/procurement/briefs`
  - Lists the caller's briefs.
- `GET /v1/procurement/briefs/:id`
  - Returns one saved brief and metadata.
- `GET /v1/procurement/briefs/:id/matches`
  - Runs the saved criteria against the current catalog and returns matches, match context, limitations, and pagination.

Launch criteria should be deliberately narrow:

- origin/country or region, if already supported safely
- legacy process or structured process only where backend support exists
- max `price_per_lb`
- stocked only
- wholesale flag
- arrival/stocked freshness only if existing fields can support truthful filtering
- optional proof constraints only after proof query support ships

The match response should explain why a coffee matched without pretending to score quality. Example reasons: `origin_match`, `price_under_target`, `stocked_now`, `fresh_arrival`, `proof_summary_available`.

### Web behavior

- Member catalog users can save the current eligible search as a sourcing brief.
- A new logged-in surface, likely `/procurement` or `/catalog/briefs`, lists saved briefs.
- Brief detail shows current matches, criteria, limitations, and last-run timestamp.
- Anonymous/viewer users see upgrade copy or disabled affordances, but cannot create or run saved procurement briefs.

### CLI and agent behavior

After PR 1 and PR 2 stabilize the endpoint:

- `purvey procurement briefs list --json`
- `purvey procurement briefs create --name "Washed Colombia under 6.50" --origin Colombia --max-price 6.50 --stocked-only --json`
- `purvey procurement briefs matches <id> --json`

CLI JSON must preserve IDs, criteria, pagination, match reasons, and limitations so agents can call it without scraping human copy.

## Files or systems likely to change

### `coffee-app`

- `supabase/migrations/<date>_sourcing_briefs.sql`
- generated Supabase types if this repo tracks them in source
- `src/lib/procurement/sourcingBriefCriteria.ts`
- `src/lib/procurement/sourcingBriefCriteria.test.ts`
- `src/lib/server/procurement/sourcingBriefs.ts`
- `src/lib/server/procurement/sourcingBriefs.test.ts`
- `src/routes/v1/procurement/briefs/+server.ts`
- `src/routes/v1/procurement/briefs/[id]/+server.ts`
- `src/routes/v1/procurement/briefs/[id]/matches/+server.ts`
- route tests near the new endpoints
- `src/routes/procurement/+page.server.ts`
- `src/routes/procurement/+page.svelte`
- catalog page save-affordance files if PR 2 adds "save this search"
- docs content under `src/lib/docs/content.ts` after the API surface is ready

### `purveyors-cli`

- `src/commands/procurement*` or the repo's current command-group convention
- API client modules for procurement endpoints
- manifest metadata and README/docs updates
- command tests for JSON output, auth errors, and examples

## API or data impact

- Adds a user-owned table for saved sourcing briefs. Proposed columns:
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `name text not null`
  - `criteria jsonb not null`
  - `cadence text not null default 'manual'`
  - `is_active boolean not null default true`
  - `last_run_at timestamptz`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Enable RLS with owner-only access.
- Do not store raw result rows in PR 1. Match execution should query current catalog data.
- Later recommendation runs may store derived output snapshots, but those should include limitations and source timestamps.
- Criteria validation must prevent unsupported filters from silently no-oping.

## Program rationale

A multi-stage program is stronger than one PR because the real product is a workflow primitive, not a single button. The API contract, member UI, CLI surface, and recommendation output each have different failure modes and can ship independently.

The first PR should be API-first because saved procurement intent must be durable, user-owned, and callable by agents. A UI-only saved search would create the wrong source of truth and make later CLI/API integration harder.

## Ordered PR sequence and stop points

1. **PR 1: Saved sourcing brief contract and manual match API in `coffee-app`.**
   - Adds data model, validation, endpoints, entitlement gates, and tests.
   - Stop point: API/API-key consumers can create a brief and run current matches manually.
2. **PR 2: Member web workflow in `coffee-app`.**
   - Adds `/procurement` or equivalent, save-current-search affordance, brief list/detail, upgrade copy, and UI tests.
   - Stop point: members can use briefs in-app even if CLI never ships.
3. **PR 3: CLI procurement commands in `purveyors-cli`.**
   - Adds list/create/matches commands plus manifest metadata.
   - Stop point: agents and operators can use briefs without browser automation.
4. **PR 4: In-app shadow recommendation runs in `coffee-app`.**
   - Adds manual or scheduled-in-app recommendation generation, ranking/explanation helpers, stored latest result, and docs. No email or external delivery.
   - Stop point: Purveyors can test whether recommendation output is useful before adding notifications or paid delivery.

## Acceptance criteria

### Program-level

- A member or paid API caller can save sourcing intent and rerun it against current catalog data.
- Unsupported criteria fail closed. No saved brief may silently ignore a criterion and return misleading matches.
- Brief matching uses shared catalog semantics and truthful pagination.
- Anonymous and free viewer users cannot create or run saved procurement briefs through direct URL/API requests.
- The product copy frames this as sourcing leverage, not certification, legal assurance, or autonomous buying.
- CLI/API/web outputs preserve enough metadata for agents to understand criteria, matches, reasons, limitations, and pagination.

### PR 1

- New table has RLS and owner-only policies.
- Criteria schema validates supported fields and rejects unsupported values.
- Create/list/get/matches endpoints return stable JSON envelopes.
- Member session and paid API-key access are accepted; anonymous and insufficient plans receive structured auth/entitlement errors.
- Match tests prove criteria are applied before pagination or otherwise preserve truthful totals.

### PR 2

- Member users can save an eligible catalog search as a brief and view matches.
- Viewer/anonymous states show clear upgrade or login affordances without performing write actions.
- UI handles empty matches, stale criteria, and validation errors gracefully.

### PR 3

- CLI commands are discoverable in the manifest and support `--json`.
- CLI preserves canonical API error envelopes for auth, entitlement, invalid criteria, and not-found cases.

### PR 4

- Recommendation runs include explicit reasons and limitations.
- Results are stored in-app only and do not trigger external notifications.
- Ranking is explainable and conservative; no black-box quality score is presented as truth.

## Test plan

### PR 1 local validation

```bash
pnpm test -- \
  src/lib/procurement/sourcingBriefCriteria.test.ts \
  src/lib/server/procurement/sourcingBriefs.test.ts \
  src/routes/v1/procurement/briefs/briefs.test.ts
pnpm check --fail-on-warnings
pnpm lint
```

### PR 1 live smoke after deploy

```bash
API_KEY="$PURVEYORS_API_KEY"

curl -sS -D /tmp/procurement-brief-create.headers \
  -X POST 'https://www.purveyors.io/v1/procurement/briefs' \
  -H "Authorization: Bearer $API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Washed Colombia under 6.50","criteria":{"country":"Colombia","process":"Washed","max_price_per_lb":6.5,"stocked_only":true}}' \
  | tee /tmp/procurement-brief-create.json

BRIEF_ID=$(jq -r '.data.id' /tmp/procurement-brief-create.json)

curl -sS -D /tmp/procurement-brief-matches.headers \
  "https://www.purveyors.io/v1/procurement/briefs/$BRIEF_ID/matches?limit=10" \
  -H "Authorization: Bearer $API_KEY" \
  | jq -e '.data and .criteria and .pagination and .limitations'
```

### PR 2 local validation

```bash
pnpm test -- src/routes/procurement/procurement.test.ts src/routes/catalog/page.svelte.test.ts
pnpm check --fail-on-warnings
pnpm lint
```

### PR 3 CLI validation

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm test -- procurement
pnpm build
node dist/index.js procurement briefs list --json
```

### PR 4 validation

```bash
pnpm test -- src/lib/procurement/recommendations.test.ts src/routes/procurement/recommendations.test.ts
pnpm check --fail-on-warnings
pnpm lint
```

## Risks and rollback

- **Risk: Criteria drift from catalog filters.** Mitigation: use shared parser/predicate helpers or delegate to the canonical catalog resource. Rollback by disabling criteria fields rather than keeping unsupported no-ops.
- **Risk: Saved briefs become a premature alert system.** Mitigation: launch manual matching first. Do not add delivery or cron until users value in-app runs.
- **Risk: Access leakage.** Mitigation: enforce entitlements server-side and test anonymous, viewer, member, API Green, and paid API paths.
- **Risk: Bad recommendations damage trust.** Mitigation: PR 4 uses explainable ranking with limitations and no autonomous action.
- **Risk: New table migration is overbuilt.** Mitigation: keep schema small and criteria JSON versioned so it can evolve without destructive migrations.
- **Rollback:** Hide UI affordances, reject create/run requests at the endpoint with a feature-disabled response, and preserve existing saved rows for later migration. Since PR 1 is additive, rollback does not affect catalog browsing.

## Open questions for Reed

1. Naming: should the product surface say **Sourcing Briefs**, **Procurement Briefs**, or **Watchlists**? Recommendation: Sourcing Briefs for UI, Procurement Briefs for the later paid report product.
2. Access: should API Green be allowed to create one evaluation brief, or should all saved briefs start at member/API paid tiers only?
3. Route naming: prefer `/v1/procurement/briefs` for product clarity or `/v1/sourcing-briefs` for shorter API ergonomics?
4. First criteria: should max price and stocked-only be the first hard requirements, with proof/similarity expansion deferred until those contracts settle?

## Recommendation

Start with PR 1. It creates the durable source of truth for saved sourcing intent and current matches without committing to notifications, cron delivery, or autonomous recommendations. If PR 1 feels useful through API smoke tests, PR 2 makes it visible to members, PR 3 gives agents the command surface, and PR 4 tests whether Purveyors can move from search to decision-ready recommendations.
