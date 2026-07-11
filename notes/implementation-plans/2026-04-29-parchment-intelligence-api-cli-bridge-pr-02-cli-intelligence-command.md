# PR 2: CLI Intelligence Price Index Command

**Date:** 2026-04-29  
**Repo:** purveyors-cli  
**Branch suggestion:** `feat/intelligence-price-index-command`  
**Purpose:** Add a CLI and exported function for the `/v1/price-index` contract.

## PR goal

Make Parchment Intelligence usable from terminals and agents by adding a first-class `purvey intelligence price-index` command and an exported TypeScript function that consumes the public API endpoint.

## Why this slice comes now

`notes/PRODUCT_VISION.md` treats the CLI as a core product surface and the cleanest agent-facing workflow. Once `/v1/price-index` exists, leaving it web/curl-only would undercut the agent-first strategy.

## In scope

- Add `src/commands/intelligence.ts`.
- Add `src/lib/intelligence.ts`.
- Register the command in `src/program.ts`.
- Export a subpath such as `@purveyors/cli/intelligence`.
- Add manifest metadata for the command.
- Support filters matching the API contract: `--origin`, `--process`, `--grade`, `--from`, `--to`, `--wholesale`, `--limit`, and `--page`.
- Support existing JSON/table output conventions.
- Add tests for URL construction, auth errors, output mode, and manifest coverage.

## Out of scope

- New API endpoint behavior.
- New authentication flow.
- CSV export unless the shared output helpers make it trivial and consistent.
- Local database access.
- Web docs changes in coffee-app.

## Files to change

- `src/commands/intelligence.ts`
- `src/lib/intelligence.ts`
- `src/program.ts`
- `src/lib/manifest.ts`
- `src/lib/index.ts`
- `package.json` exports
- Tests under `tests/` matching existing command and manifest patterns
- CLI README/docs if required by repo conventions

## Acceptance criteria

- `purvey intelligence price-index --origin Ethiopia --json` calls `/v1/price-index` with the correct query parameters.
- The command produces machine-readable JSON when requested.
- Human-readable output includes date, origin, process, median/average price, supplier count, and sample size.
- Auth and entitlement errors are surfaced without losing API error detail.
- The manifest includes the command and its options.
- The new library function is importable from the published package export map.

## Test plan

- Command parser tests.
- HTTP/client tests with mocked API responses.
- Output mode tests.
- Manifest parity tests.
- `pnpm check`.
- `pnpm test` and `pnpm verify:contract`.

## Risks

- CLI package version and publish workflow must be handled in the implementation PR, not this planning PR.
- If PR 1 changes the endpoint shape, this PR must follow that contract rather than preserving stale assumptions from this plan.
- Avoid duplicating response transformation logic in multiple CLI files.

## Exact follow-on dependency

Depends on PR 1. PR 3 should wait until this command name and examples are stable enough to document publicly.
