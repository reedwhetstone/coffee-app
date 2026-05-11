# Parchment Intelligence CLI Activation

**Date:** 2026-05-08  
**Planning mode:** Planning only, no code changes in this PR  
**Selected program:** Ship the first `purvey intelligence price-index` command in `purveyors-cli`, then update coffee-app public docs and conversion copy once the CLI release exists.  
**Recommended first PR:** `2026-05-08-parchment-intelligence-cli-activation-pr-01-cli-price-index-command.md` in `purveyors-cli`.

## Feature or program

Complete the Parchment Intelligence bridge that started with the shipped `GET /v1/price-index` endpoint. The web/API side exists, but the agent-first product surface is still missing: terminal users and agents cannot ask the CLI for price-index snapshots without hand-writing HTTP calls.

The program has two independently mergeable slices:

1. `purveyors-cli`: add `purvey intelligence price-index` plus an exported library function that consumes `/v1/price-index` with API-key auth.
2. `coffee-app`: after the CLI package is released, update API docs, analytics docs, and conversion copy so public analytics, `/v1/price-index`, and the CLI tell one coherent machine-access story.

This is not a new price-index endpoint plan. It is the cross-surface activation plan for an endpoint already on `origin/main`.

## Why now

- `notes/DEVLOG.md` still lists **Parchment Intelligence API + CLI Bridge** as a Priority 0 item. The API endpoint shipped in coffee-app PR #312; the CLI command and final docs path remain undone.
- `purveyors-cli` `origin/main` has no `intelligence` command group, no price-index command, and no price-index exported function. Source search only finds generic "coffee intelligence" marketing copy.
- Open product PRs already cover the other high-leverage active lanes: sourcing brief API PR #354, proof coverage PR #335, identity review PR #355, similarity API fix PR #360, and canonical similarity CLI PR #112.
- PR #112 is strategically important but blocked by a live `/v1/catalog/{id}/similar` 500. Price-index CLI work is a cleaner next target because `/v1/price-index` already exists and is tested in coffee-app.
- Parchment Intelligence is one of the clearest paid-product surfaces. Making it callable by agents supports the product vision's claim that CLI, API, web, and agent consumers share contracts.

## Source scan notes

Inputs reviewed for this planning pass:

- `notes/DEVLOG.md`
- `notes/PRODUCT_VISION.md`
- `notes/archive/legacy-product/MARKET_ANALYSIS.md`; the requested `notes/MARKET_ANALYSIS.md` is not present on `origin/main`
- `notes/API_notes/API-strategy.md`
- ADRs `002`, `003`, `004`, and `005`
- latest relevant published posts and outlines around data scarcity, API-first product, AI-first surfaces, listing schemas, and write-boundary trust
- `brain/moonshots/2026-04-07-procurement-brief.md`
- `brain/moonshots/2026-04-16-purveyors-copilot-network.md`
- `brain/moonshots/2026-04-30-purveyors-proof-layer.md`
- `brain/moonshots/2026-05-07-purveyors-coffee-intent-exchange.md`
- `purveyors-cli` last 10 commits and source search for price-index/intelligence support
- current open PRs in `coffee-app` and `purveyors-cli`

## Completion reconciliation

Already shipped or actively covered elsewhere:

- `/v1/price-index` exists in coffee-app and is tested as the stable Parchment Intelligence API-key contract.
- `purveyors-cli` has recently shipped catalog proof output work and has an open canonical similarity command PR, but it has no price-index command.
- Sourcing brief API is already open as coffee-app PR #354. Replanning that would duplicate active work.
- Proof coverage is already open as coffee-app PR #335, and proof query filters have a 2026-05-07 plan dependent on that PR.
- Canonical similarity CLI alignment is open as purveyors-cli PR #112 and is blocked on a live API/server issue being handled by coffee-app PR #360.
- Existing 2026-05-04 Parchment CLI bridge plans remain valid. This 2026-05-08 plan updates the selection with current open-PR reality and turns the first implementation target back into the highest-leverage unclaimed slice.

## Product Vision + moonshot opportunity scan

Active strategy themes:

1. **Coffee data moat as paid machine contract:** `/v1/price-index` packages daily, origin/process/grade/wholesale market intelligence into a stable contract.
2. **CLI and agents as first-class users:** A paid endpoint is only half-productized if agents must hand-code curl calls instead of using `@purveyors/cli` exports and manifest metadata.
3. **Public proof, paid leverage:** Public analytics proves market data value. CLI/API access to aggregate price-index snapshots is premium workflow leverage.
4. **Decision quality over browsing:** Price-index access helps buyers and agents reason about market context, not just inspect individual coffees.
5. **Docs as conversion surface:** The public product story should show the ladder from anonymous analytics to paid API/CLI access.

Moonshot check:

- **Procurement Brief:** Strongly informs the plan. The brief needs reliable price-index access from agent/automation surfaces before weekly recommendation packets become credible. The selected proving slice is the price-index CLI command, not the full paid report.
- **Copilot Network:** Informs the agent surface. A future Market Copilot should call a stable CLI/API contract for price-index data instead of scraping the analytics page.
- **Proof Layer:** Relevant but not primary. Proof work is already represented by PR #335 and the proof-query plan.
- **Coffee Intent Exchange:** Relevant as a future buyer-intent graph, but PR #354 is already building the saved-intent substrate. Price-index access is a supporting data service, not the intent product itself.

No new moonshot cleared the bar better than this slice today because the cheap, independently shippable moonshot-adjacent work is to finish the machine-access bridge for a product contract that already exists.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate                                        | Vision | Data moat / decision quality | Cross-surface | Public/access | Foundation | Total | Feasibility gate                                                                                      | Decision |
| ------------------------------------------------ | -----: | ---------------------------: | ------------: | ------------: | ---------: | ----: | ----------------------------------------------------------------------------------------------------- | -------- |
| Parchment Intelligence CLI activation            |      5 |                            4 |             4 |             3 |          3 |    19 | Endpoint exists; no open CLI PR; clean cross-repo release path.                                       | Selected |
| Proof query filters                              |      5 |                            5 |             4 |             3 |          3 |    20 | Already planned on 2026-05-07 and depends on PR #335 merge.                                           | Defer    |
| Sourcing brief web workflow                      |      5 |                            5 |             4 |             3 |          3 |    20 | Depends on PR #354 merge; API slice is still open.                                                    | Defer    |
| Canonical similarity chat alignment              |      5 |                            5 |             4 |             2 |          3 |    19 | Depends on purveyors-cli PR #112 release and coffee-app PR #360 API fix.                              | Defer    |
| Open Coffee Listing Standard supplier feed pilot |      5 |                            5 |             4 |             3 |          3 |    20 | Higher upside but not ready as one independent implementation slice without supplier-claim decisions. | Defer    |
| V1 catalog summary projection                    |      4 |                            3 |             4 |             2 |          2 |    15 | Useful agent ergonomics, but less urgent than activating a paid endpoint already shipped.             | Defer    |

## Strategy Alignment Audit

- **Canonical direction:** Aligns tightly with `notes/PRODUCT_VISION.md`: API-first is product strategy, the CLI is a core agent-facing surface, and Parchment Intelligence should turn normalized coffee data into trustworthy decisions.
- **Product principle supported:** Strengthens the data moat over feature sprawl by making the already-collected price-index data easier for agents, operators, and API customers to use.
- **Cross-surface effect:** High. The work spans `coffee-app` `/v1/price-index`, `purveyors-cli` command/export/manifest behavior, and coffee-app docs/conversion copy after release.
- **Public value legibility:** High. Public analytics remains the proof surface; API-key `/v1/price-index` and `purvey intelligence price-index` become the paid machine surfaces.
- **Moonshot check:** Informed most directly by the Procurement Brief and Copilot Network moonshots. The proving slice is CLI/agent access to price-index market data, which is independently useful and a prerequisite for brief/copilot automation. Proof Layer and Coffee Intent Exchange remain relevant but are already being advanced through other active PRs and plans.
- **Scope check:** Excludes new price-index endpoint semantics, new billing products, alerts, email delivery, procurement recommendations, saved briefs, proof filters, supplier direct feeds, CSV export, and broad docs IA redesign.

## Scope in / out

### In scope

- Add a new `intelligence` command group to `purveyors-cli` if no better existing namespace exists.
- Add `purvey intelligence price-index` that calls `GET /v1/price-index`.
- Add an exported TypeScript function, likely from `@purveyors/cli/intelligence`, for agent/app reuse.
- Support the query params already accepted by `/v1/price-index`: `origin`, `process`, `grade`, `from`, `to`, `wholesale`, `limit`, and `page`, subject to actual endpoint behavior.
- Preserve structured API error envelopes for missing auth, insufficient Parchment Intelligence access, invalid params, and rate limits.
- Add CLI manifest/help/docs so agents can discover the command and output shape.
- After release, update coffee-app docs and conversion copy to include one curl path and one CLI path.

### Out of scope

- Changing `/v1/price-index` response shape, entitlement rules, row limits, pagination, or data source.
- Adding alerts, saved searches, watchlists, webhooks, weekly briefs, email delivery, or CSV exports.
- Adding new Stripe products or changing Parchment Intelligence pricing.
- Touching coffee-app code before the CLI release except docs in PR 2.
- Implementing proof, similarity, or procurement surfaces.

## Proposed UX or behavior

CLI examples:

```bash
purvey intelligence price-index --origin Ethiopia --from 2026-04-01 --to 2026-05-08 --json
purvey intelligence price-index --process Washed --wholesale false --limit 25
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" purvey intelligence price-index --origin Colombia --json
```

JSON output should preserve the API envelope enough that agents can read `data`, `pagination`, `meta.resource`, `meta.namespace`, auth/entitlement metadata when present, and any structured error fields. Human output can be a compact table, but JSON is the primary agent contract.

Coffee-app docs after release should say plainly:

- `/analytics` is the public and member web product surface.
- `/v1/price-index` is the stable API-key contract for aggregate price-index snapshots.
- `purvey intelligence price-index` is the terminal and agent path over that same contract.

## Files or systems likely to change

### PR 1, `purveyors-cli`

- `src/program.ts`
- `src/commands/intelligence.ts` or current command convention
- `src/lib/intelligence.ts` or current API-client convention
- `src/lib/manifest.ts`
- `src/index.ts` and package exports if subpath exports are maintained there
- `tests/intelligence.test.ts`
- `tests/exit-codes.test.ts` if error behavior changes
- README and docs command reference
- `package.json` version bump and release notes if required by the release process

### PR 2, `coffee-app`

- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`
- Public API or analytics copy if current text implies CLI access is unavailable or omits it after release
- Possibly `notes/blog/source-map.md` or blog idea status if the launch-post dependency changes, but only if docs ownership says those notes should move with this PR

## API or data impact

- No new database tables or migrations.
- No change to `/v1/price-index` semantics.
- No new public API route.
- The CLI consumes the existing API-key contract and should not bypass server-side entitlement logic.
- Coffee-app docs update follows the CLI release and should reference the released package version or command behavior, not a branch-only feature.

## Program rationale

This should remain a two-PR program. The CLI PR is the product capability. The coffee-app docs PR is the conversion bridge. Splitting them avoids documenting a command before it is published and keeps the web docs tied to a released CLI contract.

## Ordered PR sequence and stop points

1. **PR 01: CLI price-index command in `purveyors-cli`.**
   - Adds command group, API client/export, manifest/help/docs, tests, and version bump.
   - Stop point: agents and terminal users can call `/v1/price-index` without browser automation or custom curl.
2. **PR 02: Docs and conversion copy in `coffee-app`.**
   - Runs after CLI merge, tag, and npm publish.
   - Adds CLI examples to docs and clarifies analytics/API/CLI boundaries.
   - Stop point: public product surfaces explain the full web/API/CLI ladder without overclaiming unsupported features.

## Acceptance criteria

### Program-level

- `purvey intelligence price-index --json` calls `/v1/price-index` and returns a machine-usable response.
- CLI help and manifest expose the command, auth requirements, core filters, and examples.
- Missing API key, invalid API key, missing Parchment Intelligence entitlement, invalid params, and rate-limit responses preserve clear structured errors.
- Coffee-app docs contain one curl example and one CLI example over the same contract after the CLI release.
- Docs continue to state that `/v1/price-index` exposes aggregate snapshots only, not raw supplier rows, alerts, webhooks, CSV export, or procurement recommendations.

### PR 1

- Command supports `--json` as the primary agent output.
- Query args map exactly to supported `/v1/price-index` params or fail locally before sending unsupported params.
- Tests cover successful mapping, auth failure, entitlement failure, invalid options, malformed API responses, and manifest/help metadata.
- Version bump follows the CLI release process.

### PR 2

- Docs mention the released CLI command, not an unreleased branch.
- Tests prove docs include `/v1/price-index`, auth/entitlement wording, and the CLI example without claiming unsupported surfaces.
- Conversion copy preserves ADR-003 and ADR-005: public analytics proves value; paid API/CLI access delivers leverage.

## Test plan

### PR 1 local validation

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm exec vitest run tests/intelligence.test.ts tests/exit-codes.test.ts
pnpm lint
pnpm test
```

### PR 1 live smoke, if a Parchment Intelligence API key is available

```bash
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts intelligence price-index --origin Ethiopia --limit 5 --json
```

Expected smoke result: a successful response includes `meta.resource = "price-index"`, `meta.namespace = "/v1/price-index"`, and a non-error `data` array or empty array with truthful pagination.

### PR 2 validation

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm exec vitest run src/lib/docs/content.test.ts
pnpm lint
pnpm check --fail-on-warnings
```

## Risks and rollback

- **Namespace churn:** `purvey intelligence price-index` may be debated versus `purvey catalog price-index`. Recommendation: use `intelligence` because the endpoint is aggregate market intelligence, not catalog row search.
- **Entitlement confusion:** Users may have API catalog access but not Parchment Intelligence. Preserve server error wording and add CLI copy that distinguishes API key presence from product access.
- **Cross-repo release sequencing:** Coffee-app docs must wait for CLI merge, tag, and npm publish. Do not merge docs that reference an unreleased command.
- **Output overdesign:** Keep JSON faithful to the API envelope. Human table output can be simple.
- **Rollback:** Hide or revert the CLI command and manifest entry. Because this only consumes an existing API, rollback does not affect `/v1/price-index` callers.

## Open questions for Reed before coding

1. Is `purvey intelligence price-index` the preferred namespace, or should this live under `purvey catalog price-index`?
2. Should the first CLI PR include human table output, or should it start with JSON plus minimal pretty printing?
3. Should API Green callers see a tailored upgrade hint for Parchment Intelligence, or should the CLI preserve the raw API `403` envelope exactly?
4. After CLI release, should the docs PR also unlock the queued blog idea **We Built a Real-Time Specialty Coffee Price Index**, or keep blog launch separate?

## Recommendation

Start with PR 1 in `purveyors-cli`. This is the highest-leverage unclaimed implementation target today: it finishes a live P0 product bridge, gives agents a stable market-intelligence command, and avoids duplicating active proof, similarity, and procurement PRs.
