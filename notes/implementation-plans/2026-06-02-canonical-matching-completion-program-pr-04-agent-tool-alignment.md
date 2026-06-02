# PR 04: App Agent and Tool Alignment

**Parent plan:** `2026-06-02-canonical-matching-completion-program.md`
**Branch suggestion:** `feat/canonical-matching-agent-tool-alignment`
**Purpose:** Make coffee-app chat tools speak the canonical matching contract.

## PR goal

Update app-owned chat/tool behavior so agents receive accepted identity listings, canonical candidates, similar recommendations, source-aware blockers, proof summaries, and beta language from the same coffee-app contract as the API/UI.

## Why this slice comes fourth

Agents should not be aligned to a contract until source-aware filtering and identity state exist. Once PRs 01-03 land, stale flat similarity rows become a trust risk.

## Mergeable-slice gate

This PR is mergeable even if CLI repo parity waits. Coffee-app chat can use the internal server service directly and avoid stale same-coffee claims.

## In scope

- Update `find_similar_beans` tool description to distinguish accepted identity listings, canonical candidates, and similar recommendations.
- Return grouped output plus blockers/proof/pricing to the model.
- Update chat route instructions so the model does not call similar recommendations “same coffee.”
- Add tests for tool schema, result shape, and blocked identity language.
- Prefer coffee-app internal service execution over HTTP self-calls.

## Out of scope

- Publishing a new `@purveyors/cli` version.
- Changing external CLI command behavior.
- New procurement workflows.
- New public UI.

## Files to change

- `src/lib/services/tools.ts`
- `src/routes/api/chat/+server.ts`
- Related tool/chat tests
- `src/lib/server/catalogSimilarity.ts` or `src/lib/server/beanIdentity.ts` only if a small adapter is needed

## Acceptance criteria

- Tool output preserves `groups.canonical_candidates` and `groups.similar_recommendations`.
- Tool output includes accepted identity state when available.
- Model-facing copy says similar recommendations are substitutes/market comps, not same-lot claims.
- Tests fail if the tool collapses grouped output into a flat score-only list.
- No direct legacy RPC path becomes the default agent-facing contract.

## Test plan

```bash
pnpm exec vitest run <targeted tool/chat test files>
pnpm check --fail-on-warnings
pnpm run lint
```

## Risks

- The tool may expose too much nested payload. Keep output machine-clear but cap or summarize where needed.
- If the current CLI import owns `findSimilarBeansSchema`, app code may need a local schema bridge until purveyors-cli catches up.

## Exact follow-on dependency

PR 05 creates the app-side intake contract for future scraper-generated candidates.
