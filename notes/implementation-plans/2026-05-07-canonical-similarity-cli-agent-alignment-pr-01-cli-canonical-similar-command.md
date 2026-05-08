# PR 01: CLI Canonical Similar Command

**Program:** Canonical Similarity CLI and Agent Alignment  
**Repo:** `purveyors-cli`  
**Status:** Proposed

## PR goal

Move `purvey catalog similar <id>` from the old direct RPC similarity contract to the canonical `GET /v1/catalog/:id/similar` response contract, including grouped candidates/recommendations, blockers, classification metadata, proof summaries, pricing, and score dimensions.

## Why this slice comes now

The API contract is already present in `coffee-app` `origin/main`, while the CLI still exposes the older flat `SimilarBean[]` mental model. This PR is independently useful because the CLI is a real product surface for terminal users and agents. It also creates the package release needed before coffee-app chat tools can share the updated contract.

## In-scope

- Add TypeScript types for the canonical similarity target, match, grouped response, classification, blocker, proof, pricing, and metadata shapes.
- Add an API-backed catalog similarity client that calls `/v1/catalog/:id/similar` with API-key auth when `PARCHMENT_API_KEY` or `PURVEYORS_API_KEY` is set, and session auth where the CLI's existing auth model supports it.
- Update `purvey catalog similar <id>` to prefer the canonical route.
- Preserve command options that still map cleanly, such as `--threshold`, `--limit`, and `--stocked-only`, only when the API supports the equivalent query parameter.
- Update JSON and pretty output so `canonical_candidates` and `similar_recommendations` are visually and structurally distinct.
- Update manifest metadata, help text, examples, README/docs, and command tests.
- Include the appropriate CLI version bump for release.

## Out-of-scope

- Changing `coffee-app` routes or similarity SQL.
- Adding durable identity tables.
- Adding procurement, alerting, or saved search commands.
- Publishing the npm package if repository policy handles publish after merge/tag. The PR should still include the version bump and release notes expected by repo practice.
- Keeping old direct RPC behavior as the default canonical path.

## Files to change

Likely files:

- `src/lib/catalog.ts`
- `src/commands/catalog.ts`
- `src/lib/manifest.ts`
- `src/program.ts`
- `tests/catalog.test.ts`
- `tests/exit-codes.test.ts`
- `README.md`
- Any command-reference docs maintained in the repo
- `package.json`

## Acceptance criteria

- `purvey catalog similar 1182 --json` returns a canonical grouped object, not a flat undifferentiated similarity array.
- Returned JSON includes `canonical_candidates`, `similar_recommendations`, `classification_version`, `query_strategy`, score dimensions, blockers, proof summaries, and pricing where supplied by the API.
- Pretty output labels likely same-lot candidates separately from similar recommendations and prints blocker reasons for non-identity matches.
- Auth failures and API route failures preserve structured error envelopes and actionable copy.
- Malformed IDs are rejected before auth, preserving existing exit-code expectations.
- Manifest/help text tells agents that this command uses the canonical `/v1/catalog/:id/similar` contract.
- Tests cover canonical response mapping, error handling, malformed IDs, JSON output, pretty output, and option mapping.

## Test plan

- `pnpm test -- catalog`
- `pnpm test -- exit-codes`
- Any repo-standard typecheck/lint command documented in `purveyors-cli`.
- Manual smoke, if an API key is available:

```bash
PURVEYORS_API_KEY=*** purvey catalog similar 1182 --json | jq '.data | has("canonical_candidates") and has("similar_recommendations")'
PURVEYORS_API_KEY=*** purvey catalog similar 1182 --pretty
```

## Risks

- Existing scripts may expect a flat array. Favor the canonical grouped output for agents, but document the migration clearly and consider a narrow compatibility flag only if test evidence shows it is needed.
- Session auth may not map cleanly to the `/v1` route. If so, make API-key mode the canonical supported path and return explicit session-mode guidance instead of silently falling back to RPC.
- CLI command options may not all map to API query params. Unsupported options should fail closed or be removed from this command path rather than becoming no-ops.

## Exact follow-on dependency

PR 02 depends on this PR being merged, released, and visible to coffee-app via `npm view @purveyors/cli version` before bumping `@purveyors/cli` and updating the chat tool contract.
