# PR 09: Retire coffee-app legacy catalog RAG

## PR goal

Delete the legacy direct-Supabase catalog-chunk retrieval path unless evidence
proves a live supported caller.

## Why this slice comes now

The current `/api/tools/coffee-chunks` route exposes obsolete structured catalog
RAG and reaches `match_coffee_chunks` directly. Product direction calls for
structured tools for current numeric/filterable data and a future
provenance-aware knowledge corpus for narrative retrieval.

## In scope

- Repository caller graph, public docs references, production access telemetry,
  and known integration check
- Delete `/api/tools/coffee-chunks`, `ragService.ts`, embedding glue, tests, and
  docs when no supported caller exists
- Remove `match_coffee_chunks` and catalog join access from the boundary manifest
- If a live caller exists, document the blocker and stop

## Out of scope

- Building the future Market Wire knowledge layer
- Porting the legacy route to Parchment
- Deleting database functions before all non-coffee-app callers are verified

## Files to change

- `src/routes/api/tools/coffee-chunks/`
- `src/lib/services/ragService.ts`
- related docs/tests/config and boundary manifest

## Acceptance criteria

- Evidence supports deletion, or the PR is not opened and the plan records the
  exact live caller and required canonical replacement.
- No coffee-app runtime calls `match_coffee_chunks`.
- Structured catalog chat tools continue to pass.

## Test plan

- Caller scan and production telemetry evidence
- Chat/catalog tool regression tests
- coffee-app check, lint/format, and build

## Risks

- An undocumented external consumer may exist. A clean repository graph alone is
  insufficient; require route telemetry or an explicit observation window.

## Follow-on dependency

Any required narrative retrieval waits for the separately planned Parchment
knowledge-search contract.
