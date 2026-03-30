# PR D Execution Plan: Parchment Console and Docs Consolidation

**Goal:** Consolidate docs under `/docs` and align product naming with the corrected architecture.

## Scope
- Rebrand dashboard copy from API Dashboard to Parchment Console
- Remove/redirect `/api-dashboard/docs`
- Make `/docs` the single canonical docs tree for API + CLI + Platform
- Update nav labels and route entry points to match final naming

## Candidate files
- `src/routes/api-dashboard/*`
- `src/routes/docs/*`
- nav/header components
- docs content modules
- redirects from `/api-dashboard/docs`

## Out of scope
- Rewriting every doc page’s content from scratch if that belongs in PR E

## Acceptance criteria
- `/docs` is canonical
- `/api-dashboard/docs` no longer exists as a competing docs destination
- Parchment naming is coherent in app navigation and dashboard surfaces
- `pnpm check` passes
- `verify-pr` runs before merge recommendation
