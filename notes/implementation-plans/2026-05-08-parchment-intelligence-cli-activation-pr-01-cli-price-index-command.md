# PR 01: CLI Price-Index Command

**Date:** 2026-05-08  
**Repo:** `purveyors-cli`  
**Branch suggestion:** `feat/intelligence-price-index-command`  
**Purpose:** Add the first terminal and agent command over the shipped `/v1/price-index` Parchment Intelligence API contract.

## PR goal

Implement `purvey intelligence price-index` and an exported TypeScript helper that call `GET /v1/price-index` with API-key auth and preserve the canonical response/error envelope for agent consumers.

## Why this slice comes now

`/v1/price-index` is already live in coffee-app. The product gap is the CLI and agent surface. This PR is independently useful even if docs conversion, weekly briefs, saved sourcing briefs, or copilots never ship.

## In scope

- Add an `intelligence` command group if none exists.
- Add `price-index` command flags matching supported endpoint params: `origin`, `process`, `grade`, `from`, `to`, `wholesale`, `limit`, and `page`, subject to actual API support.
- Add `--json` output as the primary machine contract.
- Add a reusable exported function for price-index calls.
- Preserve structured API errors for auth, entitlement, invalid params, rate limits, and server failures.
- Add manifest/help/README or docs entries.
- Add tests and a version bump per CLI release process.

## Out of scope

- Changing `/v1/price-index` behavior.
- Adding CSV export, alerts, webhooks, procurement recommendations, saved briefs, or weekly brief delivery.
- Coffee-app docs updates before the CLI is released.
- Similarity, proof, catalog, inventory, roast, sales, or tasting behavior.

## Files to change

Likely files:

- `src/program.ts`
- `src/commands/intelligence.ts`
- `src/lib/intelligence.ts`
- `src/lib/manifest.ts`
- `src/index.ts` and package exports if needed
- `tests/intelligence.test.ts`
- `tests/exit-codes.test.ts` if exit behavior changes
- `README.md` and docs command reference
- `package.json` and release notes/version metadata

## Acceptance criteria

- `purvey intelligence price-index --origin Ethiopia --json` requests `/v1/price-index?origin=Ethiopia`.
- JSON output preserves `data`, `pagination`, `meta.resource`, `meta.namespace`, and structured API errors.
- Unsupported local flags fail locally rather than becoming silent API no-ops.
- Missing API key and insufficient Parchment Intelligence access produce clear CLI errors.
- Manifest/help examples advertise the command and auth requirement.
- Tests cover success, auth failure, entitlement failure, invalid options, malformed API response, and manifest metadata.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm exec vitest run tests/intelligence.test.ts tests/exit-codes.test.ts
pnpm lint
pnpm test
```

Optional live smoke if a suitable API key is available:

```bash
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts intelligence price-index --origin Ethiopia --limit 5 --json
```

## Risks

- Namespace debate: default recommendation is `intelligence`, not `catalog`, because this is aggregate market intelligence.
- Entitlement confusion: API-key auth can be valid while Parchment Intelligence access is missing. Keep the error explicit.
- Release sequencing: include the version bump in this PR so the coffee-app docs PR can reference a released command.
- Human output polish: do not let table formatting delay machine-usable JSON.

## Exact follow-on dependency

After this PR merges, tag and publish the CLI release. Then run PR 02 in `coffee-app` to update docs and conversion copy with the released command.
