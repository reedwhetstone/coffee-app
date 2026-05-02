# PR 2: CLI proof output

**Date:** 2026-05-01  
**Repo:** purveyors-cli  
**Branch suggestion:** `feat/catalog-proof-output`  
**Purpose:** Let CLI and agent consumers request the canonical catalog proof summary.

## PR goal

Add `--include-proof` to read-only catalog CLI commands and exported catalog helpers so agents can inspect the same proof summaries exposed by coffee-app.

## Why this slice comes now

After PR 1 creates the canonical proof contract, the CLI should become the machine-friendly surface for the same trust signal. This keeps proof logic centralized in coffee-app and avoids a parallel CLI scoring model.

## In scope

- Add `--include-proof` to relevant read-only catalog commands such as `catalog search` and `catalog get` if present.
- Pass `include=proof` to `/v1/catalog` in API-backed catalog mode.
- Preserve current CLI output when `--include-proof` is omitted.
- Include proof option metadata in the manifest so agents can discover it.
- Add JSON output tests and docs examples.

## Out of scope

- Reimplementing proof scoring in the CLI.
- Member-only or write-command API-key support.
- Coffee-app docs beyond references needed in CLI docs.
- Paid proof filters or proof-based sorting.
- CSV export changes unless current command architecture already supports additive fields safely.

## Files to change

- `src/commands/catalog.ts`
- `src/lib/catalog.ts`
- `src/lib/manifest.ts`
- `src/lib/index.ts` or catalog subpath exports if needed
- Catalog command tests
- CLI docs

## Acceptance criteria

- `purvey catalog search --include-proof --json` includes canonical proof summaries when the API supports them.
- Existing catalog commands preserve their output contracts without the flag.
- Error handling is clear if the configured API endpoint does not yet support `include=proof`.
- Manifest metadata documents the new flag for agent callers.
- CLI docs show one example using `PARCHMENT_API_KEY` or `PURVEYORS_API_KEY` where API-key catalog mode is available.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm test
PARCHMENT_API_KEY="$PURVEYORS_API_KEY" pnpm exec tsx src/index.ts catalog search --origin Ethiopia --include-proof --limit 5 --json
```

## Risks

- If API-key catalog mode has not shipped yet, CLI proof output may depend on session auth or need to wait for catalog API-key parity.
- CLI output shape can drift from web/API if proof fixtures are copied instead of consumed from the canonical response.

## Exact follow-on dependency

PR 3 can use the proof helper and CLI behavior to shape reporting, but it does not strictly depend on the CLI shipping.
