# Parchment CLI API-Key Catalog Parity Program

**Date:** 2026-04-29
**Selected improvement:** Let Parchment CLI catalog read commands use the canonical `/v1/catalog` API-key contract in headless environments
**Recommended shape:** Two-stage implementation program
**Planning mode:** Planning only, no code changes in this PR

## Problem description with live API evidence

The canonical Parchment API is now stable enough for public and server-to-server catalog reads, but the CLI catalog surface still depends on a browser-style stored session. That creates a cross-surface gap for the exact agent and cron workflows the product vision treats as first-class consumers.

Live checks against `https://www.purveyors.io` on 2026-04-29 showed the HTTP contract is healthy:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS -D /tmp/v1.headers -o /tmp/v1.json \
  'https://www.purveyors.io/v1/catalog' \
  -H "Authorization: Bearer $API_KEY"

curl -sS -D /tmp/legacy.headers -o /tmp/legacy.json \
  'https://www.purveyors.io/api/catalog-api' \
  -H "Authorization: Bearer $API_KEY"

curl -sS -D /tmp/filtered.headers -o /tmp/filtered.json \
  'https://www.purveyors.io/v1/catalog?origin=Ethiopia&stocked=true&limit=10' \
  -H "Authorization: Bearer $API_KEY"
```

Observed API behavior:

- `GET /v1/catalog` with the live API key returned `HTTP 200`, the canonical `{ data, pagination, meta }` envelope, 100 rows, `pagination.total: 1058`, and `X-RateLimit-*` headers.
- `GET /api/catalog-api` with the same key returned the same canonical envelope through the deprecated alias.
- `GET /v1/catalog?origin=Ethiopia&stocked=true&limit=10` returned `HTTP 200`, 10 rows, `pagination.total: 111`, and the same API-key rate headers.
- Anonymous `GET /v1/catalog` returned `HTTP 200` with the same public data shape and no `X-RateLimit-*` headers, matching current docs.
- Anonymous `GET /api/catalog-api` returned `HTTP 401` with `{ "error": "Authentication required" }`, matching the legacy alias contract.
- `GET /v1/catalog?limit=banana` returned `HTTP 400` with the strict typed validation message.
- `GET /v1/catalog?limit=1000` returned `HTTP 200`, 1000 rows, and a 4.2 MB full response. `GET /v1/catalog?limit=5000` returned `HTTP 400`, confirming the current hard maximum is 1000.

The CLI did not share that reliability in the same cron environment:

```bash
purvey --version
purvey auth status
purvey catalog stats
purvey catalog search --origin "Ethiopia" --pretty
```

Observed CLI behavior:

- The globally installed CLI is `0.14.0`, while `repos/purveyors-cli` main is `0.15.1`.
- `purvey auth status` returned `authenticated: false`.
- `purvey catalog stats` failed with `AUTH_ERROR` and `Run \`purvey auth login\` first.`
- `purvey catalog search --origin "Ethiopia" --pretty` failed with the same `AUTH_ERROR`.
- `purvey catalog search --help` still states `Requires an authenticated viewer session.`
- Source inspection in `repos/purveyors-cli` confirms `src/commands/catalog.ts` calls `requireAuth('viewer')`, and `src/lib/catalog.ts` reads directly from Supabase rather than the canonical `/v1/catalog` resource.

This means the API-first contract is available, but the CLI cannot act as a headless API-key client for public catalog reads. Agents must drop down to custom `curl` even though the CLI is supposed to be the shared agent-first product surface.

## Root cause analysis

The CLI catalog commands were built before `/v1/catalog` became the canonical compatibility promise. They still model catalog access as a Supabase session workflow:

1. The command layer calls `requireAuth('viewer')`.
2. The library layer queries `coffee_catalog` through a Supabase client.
3. Missing or stale local OAuth credentials stop even public catalog reads.
4. API-key catalog access exists only through raw HTTP examples in docs, not through the CLI.

That split is now strategically stale. `/v1/catalog` owns validation, response envelopes, tier headers, public-only behavior, row caps, and compatibility semantics. The CLI should reuse that contract for public catalog reads instead of duplicating a parallel direct-Supabase path that cannot operate in headless API-key contexts.

The member-only CLI commands should remain session-authenticated because they read or write personal inventory, roasts, sales, and tasting data. The gap is narrower: catalog read commands are public/API-safe and should support API-key mode when a session is unavailable or when a caller explicitly chooses API-key mode.

## Proposed program

Ship a two-stage program:

1. **PR 1, purveyors-cli:** Add API-key catalog mode for read-only catalog commands by calling `/v1/catalog` when `PARCHMENT_API_KEY` or `PURVEYORS_API_KEY` is available, while preserving existing session behavior and output contracts.
2. **PR 2, coffee-app docs:** Update public docs and CLI docs after the CLI release so users and agents know when to use session auth, API-key catalog mode, or raw HTTP.

This should not turn the CLI into a generic HTTP wrapper for all product routes. It should make the catalog read surface match the canonical API-first contract while leaving member workflows session-bound.

## Strategy Alignment Audit

- **Canonical direction:** This directly supports `notes/PRODUCT_VISION.md`: the CLI is a core agent-first product surface, and API-first means shared behavior across web, CLI, API, and agents rather than one-off paths.
- **API-first contribution:** Catalog reads would go through the canonical `/v1/catalog` contract for API-key mode, aligning validation, pagination, auth metadata, row caps, and rate headers with the public API.
- **Public value legibility:** A developer with an API key could use `purvey catalog search` as the quickest proof that the Parchment API works, instead of switching from CLI docs to hand-written curl calls.
- **Cross-surface consistency:** HTTP API, CLI, and agent workflows would use the same external catalog contract for server-to-server reads. Session-backed CLI catalog reads can remain for account-linked interactive use.
- **Scope discipline:** This excludes inventory, roast, sales, tasting, write commands, API-key creation, billing, tier upgrades, summary projection work, and changes to `/v1/catalog` response shape.

## Candidate scoring summary

Selected candidate: **CLI API-key catalog parity**

- User and data impact: high for developers, crons, and agents. It removes a recurring headless auth failure from catalog discovery.
- Platform coherence: high. It brings CLI behavior closer to the canonical API contract and product vision.
- Implementation complexity: medium. The CLI needs an HTTP client path plus mapping from current flags to `/v1/catalog` query params.
- Risk: medium-low if limited to read-only catalog commands and opt-in or fallback API-key behavior.
- Strategic leverage: high. It makes the CLI a trustworthy Parchment API consumer instead of a separate Supabase-session surface.

Rejected alternatives for this run:

- **Re-plan `fields=summary`:** already planned in `2026-04-28-v1-catalog-summary-projection.md` and remains a strong performance improvement, but duplicating yesterday's plan is lower value.
- **Lower the `/v1/catalog` maximum limit below 1000:** useful, but the current limit is documented and tested. Summary projection should land before changing maximum page-size policy.
- **Fix only the local cron CLI auth state:** operationally helpful but not a product improvement. API-key catalog mode fixes the product-level fragility that caused the cron audit to fall back to raw HTTP.
- **Add API-key support to all CLI commands:** too broad and unsafe. Personal data and write commands need session semantics until explicit API-key scopes exist.

## Program rationale

A two-stage program is better than one large cross-repo PR because the product behavior and the docs have different release boundaries. The CLI can add API-key catalog mode and publish a new version first. The coffee-app docs can then describe the released behavior accurately and avoid advertising unreleased CLI capabilities.

## Ordered PR sequence

1. `2026-04-29-cli-api-key-catalog-parity-pr-01-cli-api-key-catalog-mode.md`
2. `2026-04-29-cli-api-key-catalog-parity-pr-02-docs-and-examples.md`

## Dependencies and stop points

- PR 1 can ship independently in `purveyors-cli`. If PR 2 never ships, the CLI still becomes more usable for headless API-key catalog reads.
- PR 2 should wait until the CLI release is published or the docs clearly say the capability is available in the next CLI version.
- Stop after PR 1 if implementation reveals `/v1/catalog` cannot yet express an existing CLI catalog behavior without a compatibility change.
- Stop before any member-only API-key command support unless a separate API-key scope model is designed.

## Acceptance criteria

Program-level acceptance:

- `purvey catalog search` can run in a clean headless environment with no `~/.config/purvey/credentials.json` when `PARCHMENT_API_KEY` or `PURVEYORS_API_KEY` is set.
- API-key catalog mode uses `GET /v1/catalog`, not direct Supabase table reads.
- Existing session-authenticated catalog behavior remains supported.
- Existing JSON, pretty, CSV, exit-code, and error-envelope contracts remain stable.
- Member-only commands still require session auth and do not accept API keys as a substitute.
- Docs clearly distinguish session CLI mode, API-key catalog mode, anonymous HTTP reads, and member-only workflows.

## Test plan

CLI implementation validation:

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm test
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts catalog search --origin Ethiopia --stocked --limit 5 --json
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts catalog stats --json
```

Coffee-app docs validation:

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
```

Live smoke after release:

```bash
unset SUPABASE_ACCESS_TOKEN
mv ~/.config/purvey/credentials.json ~/.config/purvey/credentials.json.bak 2>/dev/null || true
PARCHMENT_API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-) \
  purvey catalog search --origin Ethiopia --stocked --limit 5 --json
PARCHMENT_API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-) \
  purvey catalog stats --json
```

API comparison smoke:

```bash
API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-)

curl -sS 'https://www.purveyors.io/v1/catalog?origin=Ethiopia&stocked=true&limit=5' \
  -H "Authorization: Bearer $API_KEY" > /tmp/api-catalog.json

PARCHMENT_API_KEY="$API_KEY" purvey catalog search --origin Ethiopia --stocked --limit 5 --json \
  > /tmp/cli-catalog.json

jq 'length' /tmp/cli-catalog.json
jq '.data | length' /tmp/api-catalog.json
```

## Risk assessment

- **Risk: API-key mode changes interactive CLI expectations.** Mitigation: preserve session auth priority unless the caller explicitly opts into API-key mode, or only fall back to API key when no valid session exists.
- **Risk: CLI output shape drifts when backed by `/v1/catalog`.** Mitigation: map API rows to the existing `CatalogItem` output shape and add snapshot or contract tests.
- **Risk: catalog stats semantics differ between direct Supabase and `/v1/catalog`.** Mitigation: compute stats from canonical API pages only for public data, document that API-key stats reflect public catalog visibility, and do not pretend they include privileged session-only rows.
- **Risk: large catalog stats require multiple API pages.** Mitigation: page through `/v1/catalog?fields=dropdown&limit=1000` or use a future lightweight aggregate endpoint if stats become slow.
- **Risk: API-key env var naming confusion.** Mitigation: support `PARCHMENT_API_KEY` as the public docs name and `PURVEYORS_API_KEY` as a compatibility alias for existing internal tooling.
- **Risk: scope creep into member workflows.** Mitigation: explicitly keep inventory, roast, sales, tasting, and write commands out of scope.

## Recommended first PR

Open the first implementation PR in `repos/purveyors-cli` titled roughly:

`feat: support API-key catalog reads in CLI`

The PR should add only read-only catalog API-key mode, tests, and CLI docs for that repo. It should not change member-only command auth, coffee-app docs, or `/v1/catalog` response shape.
