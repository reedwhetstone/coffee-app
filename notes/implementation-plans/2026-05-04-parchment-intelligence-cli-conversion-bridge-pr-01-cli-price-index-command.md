# PR 1: CLI Price-Index Command

**Date:** 2026-05-04  
**Repo:** `purveyors-cli`  
**Branch suggestion:** `feat/intelligence-price-index-command`  
**Purpose:** Add the first CLI and library consumer for the shipped `/v1/price-index` Parchment Intelligence contract.

## PR goal

Make Parchment Intelligence available to terminal users and agents through `purvey intelligence price-index` plus an exported TypeScript function.

## Why this slice comes now

`/v1/price-index` has shipped in coffee-app, but purveyors-cli still has no intelligence command group. The product vision treats the CLI as the agent-first surface, so the endpoint is only half-productized until the CLI can call it reliably.

## In scope

- Add `src/commands/intelligence.ts`.
- Add `src/lib/intelligence.ts`.
- Register the command in `src/program.ts`.
- Add manifest metadata for the command, options, examples, auth requirements, and output shape.
- Export a library subpath such as `@purveyors/cli/intelligence` if it fits the current package export model.
- Support endpoint filters: `--origin`, `--process`, `--grade`, `--from`, `--to`, `--wholesale`, `--limit`, and `--page`.
- Support JSON output and a concise human table.
- Preserve API error details for missing API keys, invalid API keys, and entitlement failures.
- Add a package version bump appropriate for a new CLI feature.

## Out of scope

- coffee-app endpoint changes.
- coffee-app docs and conversion copy.
- CSV export.
- Alerts, saved searches, watchlists, or Procurement Brief generation.
- API-key support for member-only write or personal-data commands.
- Changes to catalog proof output.

## Files to change

- `src/commands/intelligence.ts`
- `src/lib/intelligence.ts`
- `src/program.ts`
- `src/lib/manifest.ts`
- `src/lib/index.ts`
- `package.json`
- Tests under the existing command/client test structure
- README or CLI docs where command references are kept

## Acceptance criteria

- `purvey intelligence price-index --origin Ethiopia --json` calls `/v1/price-index?origin=Ethiopia`.
- The command accepts the documented endpoint filters and rejects unsupported options clearly.
- JSON output preserves `data`, `pagination`, `meta`, and API errors.
- Human output includes date, origin, process, grade, wholesale segment, average or median price, supplier count, listing count, and aggregation tier when present.
- Auth and entitlement failures preserve API detail and produce actionable CLI messages.
- The CLI manifest includes the command and examples.
- The exported function can be imported by agent workflows without shelling out.
- Existing catalog, proof, inventory, roast, sales, and tasting tests still pass.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm test
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts intelligence price-index --origin Ethiopia --limit 5 --json
pnpm exec tsx src/index.ts manifest --json | jq '.commands[] | select(.name == "intelligence")'
```

## Risks

- The repo checkout may not be on `main`; use a clean worktree from `origin/main` before implementation.
- If the API envelope changes, the CLI must follow the endpoint rather than preserving stale fixture assumptions.
- Avoid duplicating endpoint validation logic deeply in the CLI. The CLI should validate obvious option types, then preserve server-side contract errors.

## Exact follow-on dependency

PR 2 in coffee-app should wait until this PR is merged and either released to npm or clearly versioned for the next release.
