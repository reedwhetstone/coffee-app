# Parchment Intelligence CLI Conversion Bridge

**Date:** 2026-05-04  
**Planning mode:** Planning only, no code changes in this PR  
**Selected program:** Complete the Parchment Intelligence bridge by adding CLI access to the shipped `/v1/price-index` contract, then align public docs and conversion examples around the API plus CLI path.  
**Recommended shape:** Multi-stage implementation program with independently mergeable atomic PRs.  
**Repo ownership:** `purveyors-cli` first, then `coffee-app` docs after the CLI command is released.

## Feature or program

Make Parchment Intelligence usable from the terminal, from agents, and from product docs without requiring hand-written `curl` calls against `/v1/price-index`.

The first slice adds a `purvey intelligence price-index` command and exported TypeScript function in `@purveyors/cli`. The second slice updates coffee-app docs and conversion copy so the public API, CLI, analytics page, and subscription path all describe the same stable product contract.

This is not a new analytics surface. It is the missing cross-surface bridge for the endpoint that already shipped in coffee-app PR #312.

## Why now

- `notes/DEVLOG.md` still lists **Parchment Intelligence API + CLI Bridge** as a Priority 0 product bet. The API endpoint has shipped, but the CLI and final docs slices have not.
- `origin/main` in coffee-app now contains `/v1/price-index` (`e6fd6c6`, PR #312) and docs that mention the stable price-index API. Source search shows no `fields=summary` implementation yet, but the price-index endpoint itself is real.
- `origin/main` in purveyors-cli has catalog proof output (`7035609`, PR #108), but source search shows no `intelligence` command group or price-index command/export.
- There are no open purveyors-cli PRs, so this target will not duplicate an active implementation branch.
- The newest proof-layer work has just landed in both app and CLI. The next platform gap is not another trust badge. It is letting agents consume the market intelligence endpoint through the canonical CLI surface.
- `notes/MARKET_ANALYSIS.md` is not present on current `origin/main`; the legacy archived market analysis still supports the API/developer segment and normalized data positioning.

## Strategy context pass

Active themes from the source documents:

1. **Coffee data moat over feature sprawl:** price-index snapshots, supplier health, arrival/delisting data, proof summaries, and process transparency are compounding data assets.
2. **API-first product strategy:** stable public v1 contracts should feed web, CLI, API, docs, and agent consumers rather than one-off surface logic.
3. **CLI as an agent-first surface:** the CLI is a core product interface, not a documentation wrapper. Commands, output modes, exported functions, manifest metadata, and auth behavior are product quality.
4. **Public proof, paid leverage:** public analytics and docs should prove that the intelligence exists; production-scale access, agent workflows, and repeatable decision leverage should point toward membership or API tiers.
5. **Trustworthy machine context:** recent blog and outline themes emphasize that agents need governed, canonical contracts, not ambiguous prose or stale docs.
6. **Moonshot path to decision products:** the Procurement Brief and Copilot Network both need reliable machine-readable market signals before a buyer-facing brief or copilot can be credible.

## Completion reconciliation

Already shipped or not selected today:

- `/v1/price-index` exists in coffee-app and is documented as an API-key Parchment Intelligence contract.
- Catalog proof summaries exist in coffee-app, and `purvey catalog --include-proof` exists in purveyors-cli.
- ADR-005 process-facet access alignment and the central catalog capability helper exist on coffee-app `origin/main`.
- No open purveyors-cli PR is already implementing the price-index command.

Still open:

- `purvey intelligence price-index` does not exist.
- No `@purveyors/cli/intelligence` or equivalent export exists.
- coffee-app docs describe `/v1/price-index`, but they cannot yet show the first-class CLI command or final conversion path from public analytics to API plus CLI usage.

## Candidate scoring

Scores use the Product Leverage Index from the planner skill: vision alignment 0-5, data moat / decision quality 0-5, cross-surface leverage 0-4, public value / access ladder 0-3, foundation unlock 0-3.

| Candidate                                    | Vision | Data moat | Cross-surface | Public/access | Foundation | Total | Feasibility gate                                                                                                                | Decision                     |
| -------------------------------------------- | -----: | --------: | ------------: | ------------: | ---------: | ----: | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Parchment Intelligence CLI Conversion Bridge |      5 |         4 |             4 |             3 |          3 |    19 | Medium. Endpoint exists; CLI command and docs are straightforward but cross-repo release sequencing matters.                    | Selected                     |
| Procurement Brief data packet pilot          |      5 |         5 |             3 |             2 |          3 |    18 | Needs clearer product framing and likely benefits from CLI price-index access first.                                            | Defer behind selected bridge |
| Catalog Proof Coverage Pilot                 |      5 |         5 |             3 |             2 |          2 |    17 | Useful proof-layer follow-up, but mostly a report/data-quality audit rather than the strongest next product/API/CLI capability. | Defer                        |
| V1 Catalog Summary Projection                |      4 |         3 |             4 |             2 |          2 |    15 | Still useful and unshipped, but lower urgency than completing the live price-index bridge.                                      | Defer                        |
| Process transparency backgeneration          |      5 |         5 |             2 |             1 |          3 |    16 | Belongs primarily in coffee-scraper and data backfill sequencing.                                                               | Defer to scraper planning    |
| Pure UI/UX cleanup from DEVLOG P2-P4         |    1-3 |       0-2 |           0-1 |           0-1 |        0-1 |   Low | Does not unblock a named product milestone today.                                                                               | Reject for this run          |

## Strategy Alignment Audit

- **Canonical direction:** This aligns tightly with `notes/PRODUCT_VISION.md`: API-first is product strategy, the CLI is a core agent-facing product surface, and shared machine contracts should serve web, CLI, API, and agents.
- **Product principle supported:** It strengthens the data moat, improves decision quality for market intelligence users, and makes the CLI easier for agents to discover, call, and trust directly.
- **Cross-surface effect:** High. The source data and auth live in coffee-app, the agent-friendly command belongs in purveyors-cli, and the public proof/conversion path comes back to coffee-app docs.
- **Public value legibility:** High. Public analytics shows that price intelligence exists. A documented CLI command makes the premium API layer concrete and easier to evaluate.
- **Moonshot check:** Informed by `brain/moonshots/2026-04-07-procurement-brief.md` and `brain/moonshots/2026-04-16-purveyors-copilot-network.md`. The selected proving slice is not the full brief or copilot. It is the shared market-signal command those products would need before weekly recommendations or agent workflows can be trusted. The Proof Layer moonshot did not win today because its first web/API/CLI slice has already shipped, and the remaining proof coverage pilot is less directly productizing a new capability.
- **Scope check:** This excludes building the weekly brief, adding alerts, adding watchlists, changing Stripe products, adding CSV exports, changing price-index endpoint semantics, implementing `fields=summary`, or adding new scraper backfills.

## Scope in / out

### In scope

- Add a new `purvey intelligence price-index` command in `repos/purveyors-cli`.
- Add an exported library function, likely from `@purveyors/cli/intelligence`, that calls `/v1/price-index` without shelling out.
- Use the existing API-key configuration path, supporting `PARCHMENT_API_KEY` and `PURVEYORS_API_KEY` where consistent with current catalog API-backed behavior.
- Support endpoint filters already accepted by `/v1/price-index`: `origin`, `process`, `grade`, `from`, `to`, `wholesale`, `limit`, and `page`.
- Preserve agent-friendly JSON output and add a dense human-readable table view.
- Add manifest metadata so agents can discover the command, options, auth requirements, and examples.
- Update coffee-app docs and conversion copy only after the CLI behavior is merged and published or versioned clearly.

### Out of scope

- Any changes to coffee-app runtime code in this planning program, except docs in PR 2.
- Any change to `/v1/price-index` response shape, entitlement rules, pagination, rate limits, or data source.
- CSV export, alerts, webhooks, saved searches, or watchlists.
- Weekly Procurement Brief generation.
- Shadow Copilot recommendation generation.
- API-key creation UX or billing changes.
- Member-only inventory, roast, sales, or tasting API-key support.

## Proposed UX or behavior

Example command:

```bash
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" \
  purvey intelligence price-index --origin Ethiopia --from 2026-04-01 --to 2026-05-04 --json
```

Expected behavior:

- The command calls `/v1/price-index` with the same query semantics documented by coffee-app.
- JSON output preserves the canonical API envelope or a clearly documented CLI wrapper that does not discard `meta`, `pagination`, or error details.
- Human output highlights date, origin, process, grade, wholesale segment, average/median price, sample size, supplier count, and aggregation tier when present.
- Auth and entitlement errors preserve the API error message and tell the user whether they need an API key, Parchment Intelligence access, or a different account tier.
- The CLI manifest includes command metadata and examples so agent callers can discover it programmatically.

## Files or systems likely to change

### PR 1, purveyors-cli

- `src/commands/intelligence.ts`
- `src/lib/intelligence.ts`
- `src/program.ts`
- `src/lib/manifest.ts`
- `src/lib/index.ts`
- `package.json` export map, if a new subpath is added
- CLI command tests and HTTP client tests
- README or repo-local CLI docs as required by current conventions
- Version bump in `package.json` for publish readiness

### PR 2, coffee-app

- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`
- Public API docs examples for `/v1/price-index`
- `/analytics`, `/api`, or subscription copy only where it references machine access or conversion path
- Optional implementation-plan cross-reference if docs convention expects it

## API or data impact

- No database changes.
- No new coffee-app endpoint.
- Uses existing `/v1/price-index` data and entitlement contract.
- Does not expose raw supplier-level rows.
- Does not change catalog proof summaries, process transparency fields, or catalog projections.
- Adds a stable CLI and library consumer for the existing API product.

## Program rationale

A multi-stage program is stronger than one cross-repo PR because the CLI package has its own release boundary. The command can ship independently in `purveyors-cli`. If the docs PR never lands, the product still gains a real agent/terminal capability. The docs PR should wait until the CLI command name, version, and examples are stable enough not to advertise unreleased behavior.

## Ordered PR sequence and stop points

1. **PR 1: CLI price-index command in purveyors-cli.**  
   Stop point: mergeable if it adds the command, exported function, manifest coverage, tests, docs, and version bump. No coffee-app changes required.

2. **PR 2: Docs and conversion path in coffee-app.**  
   Stop point: mergeable after the CLI command is released or the docs clearly name the unreleased version. If CLI release is blocked, keep docs limited to API curl examples and do not claim the command is available.

## Acceptance criteria

Program-level acceptance:

- `purvey intelligence price-index --origin Ethiopia --json` calls `/v1/price-index` and returns usable machine output.
- The command supports the endpoint's documented filters and preserves API error detail.
- The command appears in the CLI manifest with options, auth requirements, examples, and output-mode notes.
- The exported function is importable by agent workflows without shelling out.
- CLI tests cover URL construction, auth/entitlement errors, JSON output, human output, and manifest metadata.
- coffee-app docs show both curl and CLI usage after the CLI behavior is actually available.
- Public docs keep the boundary clear: `/analytics` is a web surface; `/v1/price-index` plus the CLI command are the stable machine interfaces.

## Test plan

PR 1 validation:

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm test
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts intelligence price-index --origin Ethiopia --limit 5 --json
pnpm exec tsx src/index.ts manifest --json | jq '.commands[] | select(.name == "intelligence")'
```

PR 2 validation:

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm lint
pnpm check --fail-on-warnings
pnpm exec vitest run src/lib/docs/content.test.ts
```

Live smoke after deploy and publish:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)
curl -sS 'https://www.purveyors.io/v1/price-index?origin=Ethiopia&limit=5' \
  -H "Authorization: Bearer $API_KEY" | jq '.data | length'
PARCHMENT_API_KEY="$API_KEY" purvey intelligence price-index --origin Ethiopia --limit 5 --json
```

## Risks and rollback

- **Risk: command namespace churn.** Mitigation: confirm `purvey intelligence price-index` versus `purvey catalog price-index` before coding. Prefer `intelligence` because price-index is not a catalog row search.
- **Risk: CLI response shape over-normalizes the API envelope.** Mitigation: preserve canonical `data`, `pagination`, `meta`, and error details in JSON output.
- **Risk: published CLI version lags docs.** Mitigation: docs PR waits for the versioned CLI release or states the future version explicitly.
- **Risk: entitlement errors look like generic auth failures.** Mitigation: add tests for API `401` and `403` responses and surface upgrade/account context.
- **Rollback:** Remove or hide the command from CLI manifest and docs. Since this consumes an existing API without changing it, rollback does not affect `/v1/price-index` callers.

## Open questions for Reed

1. Should the command namespace be `purvey intelligence price-index` or `purvey catalog price-index`?
2. Should JSON output preserve the exact API envelope by default, or should the CLI offer a flattened `--rows-only` style helper later?
3. Should docs wait for a published npm version before mentioning CLI usage, or can they reference the unreleased next version if the PR is merged but not tagged?
4. Should the first human table include both average and median prices, or bias toward median plus sample size for less noisy decision-making?
