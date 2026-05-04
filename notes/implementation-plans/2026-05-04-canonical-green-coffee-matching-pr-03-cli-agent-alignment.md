# PR 03: CLI and Agent Matching Alignment

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Make `purvey catalog similar` and app tool calls use the same canonical matching contract as `/v1/catalog/:id/similar`.

## Why this slice comes later

The CLI is a first-class product and agent surface, but user feedback puts member UI ahead of CLI polish for this program. This slice should land after the web/API beta proves the data contract so the CLI mirrors a validated product shape instead of leading it.

## In-scope

- In `purveyors-cli`, add API-key mode support for `catalog similar` against `/v1/catalog/:id/similar`.
- Preserve session-mode compatibility only if needed, but normalize output to the canonical contract.
- Update `SimilarBean` types to include canonical price fields and dimension scores.
- Update CLI manifest metadata and examples.
- In coffee-app tools, route `find_similar_beans` through the canonical service or endpoint semantics.
- Add tests for JSON output shape and API-key behavior.

## Out-of-scope

- New canonical identity command.
- Web UI.
- Identity schema.
- Publishing a CLI release, unless this PR is implemented in the CLI repo and ready to release.

## Files to change

- `repos/purveyors-cli/src/lib/catalog.ts`
- `repos/purveyors-cli/src/commands/catalog.ts`
- `repos/purveyors-cli/src/lib/manifest.ts`
- `repos/purveyors-cli/src/program.ts`
- `src/lib/services/tools.ts`
- Relevant coffee-app tool tests

## Acceptance criteria

- `purvey catalog similar <id> --json` includes canonical price fields, dimension scores, and match category.
- API-key mode uses the member/API route and respects access errors.
- Session mode does not produce a materially different response shape.
- Agent tool output matches the canonical route semantics.

## Test plan

- CLI unit tests for API response mapping.
- CLI command tests for output shape.
- Coffee-app tool tests for matching tool result normalization.
- Manual smoke with an API key if available.

## Risks

- This is cross-repo work. Keep the coffee-app endpoint PR mergeable first, then land CLI alignment in `purveyors-cli` with a release note.
- API-key catalog parity work may overlap. Reuse that direction rather than creating a second HTTP client path.

## Exact follow-on dependency

PR 04 can calibrate thresholds using one route and one output shape across human and machine consumers.
