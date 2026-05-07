# PR 02: Coffee-App Chat Tool Similarity Alignment

**Program:** Canonical Similarity CLI and Agent Alignment  
**Repo:** `coffee-app`  
**Status:** Proposed

## PR goal

Update coffee-app's `find_similar_beans` chat/agent tool so it returns the same canonical similarity semantics as `/v1/catalog/:id/similar` and the updated CLI: grouped canonical candidates, similar recommendations, classification metadata, blockers, proof summaries, pricing, and score dimensions.

## Why this slice comes now

After PR 01, the CLI will expose the canonical machine contract. The web/API route already speaks that contract. The remaining drift is the app-owned agent surface in `src/lib/services/tools.ts`, which currently describes and returns old embedding-similarity rows. Fixing it prevents the model from treating blocked similar coffees as same-lot candidates.

## In-scope

- Bump `@purveyors/cli` after PR 01 is published, updating `package.json` and `pnpm-lock.yaml`.
- Update `find_similar_beans` tool description so the model understands the distinction between likely same-lot candidates and similar recommendations.
- Route tool execution through coffee-app's canonical similarity service or a thin adapter around it.
- Preserve shared CLI schema/types where they remain useful, but keep server-side business execution and authorization in coffee-app.
- Add tests proving the tool preserves grouped output, blockers, classification metadata, proof summaries, and error behavior.
- Update any app docs that describe chat similarity semantics.

## Out-of-scope

- Adding new API endpoints.
- Changing similarity SQL, thresholds, or identity gates.
- Public catalog UI rendering changes.
- Durable identity schema or review queue work.
- Procurement recommendations, saved sourcing briefs, or write actions.
- Broad GenUI/canvas changes.

## Files to change

Likely files:

- `package.json`
- `pnpm-lock.yaml`
- `src/lib/services/tools.ts`
- Tool/service tests near `src/lib/services/tools*` or existing chat tests
- Optional small adapter file if needed, for example `src/lib/services/catalogSimilarityTool.ts`
- Relevant docs content only if current docs mention `find_similar_beans`

## Acceptance criteria

- `find_similar_beans` model-facing description says results are grouped into canonical candidates and similar recommendations.
- The tool result preserves `data.canonical_candidates[]`, `data.similar_recommendations[]`, `meta.classification_version`, `meta.query_strategy`, blockers, confidence, score dimensions, pricing, and proof summaries.
- The tool does not return a flat old `SimilarBean[]` array as its primary shape.
- The tool does not bypass server-side access/rate/capability semantics for the canonical route or service.
- Tests cover at least one canonical candidate, one blocked similar recommendation, an empty result, malformed input, and upstream/service failure.
- `pnpm-lock.yaml` is updated with the published CLI version.

## Test plan

- Confirm CLI publish before dependency bump:

```bash
npm view @purveyors/cli version
```

- Update lockfile:

```bash
pnpm install
```

- Targeted tests for the tool adapter and service normalization.
- `pnpm check --fail-on-warnings` where local env permits.
- Manual non-destructive app/chat smoke if a local or preview environment is available.

## Risks

- If the chat tool self-calls HTTP inside the same app, auth and latency can get awkward. Prefer direct service invocation with the same normalization contract, using CLI types/schema for shared machine clarity rather than forcing an HTTP loop.
- If the CLI release is delayed, this PR is blocked. Do not bump coffee-app to an unpublished local package.
- Overly verbose tool output may bloat model context. Keep the canonical response complete but consider truncating or summarizing large result sets using the API limit.

## Exact follow-on dependency

None required for this program. Once PR 02 lands, later work can safely build procurement briefs, Buy Copilot recommendations, or identity review flows on a consistent similarity contract across API, CLI, web, and agent surfaces.
