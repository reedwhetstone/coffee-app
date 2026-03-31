# PR E Execution Plan: Docs Respin After Architecture Correction

**Goal:** Replace the conflicted PR #178 work with docs that describe the now-true product architecture.

## Scope
- Re-author the docs refresh against post-PR A/B/C/D reality
- Use Parchment Platform / Parchment API / Parchment CLI / Parchment Console naming consistently
- Public docs only under `/docs`
- Clarify canonical API contracts vs internal orchestration surfaces
- Align coffee-app docs with purveyors-cli PR #58 where overlapping concepts exist

## Candidate files
- docs content modules
- `/docs` routes
- README.md
- AGENTS.md
- relevant product marketing copy if it references developer surfaces

## Acceptance criteria
- No contradictions between docs and implementation
- No stale references to removed pseudo-roles or `/api-dashboard/docs`
- Parchment naming hierarchy is consistent everywhere touched
- `pnpm check` passes
- `verify-pr` runs before merge recommendation
