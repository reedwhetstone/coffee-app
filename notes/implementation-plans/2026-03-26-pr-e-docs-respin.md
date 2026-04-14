# PR E Execution Plan: Docs Respin After Architecture Correction

> **Superseded context note (2026-04-13):** This plan captures a transitional docs rewrite target from the March platform sequence. Keep it for history, but do not reuse its umbrella naming blindly. Current docs and product copy should follow the naming in `notes/README.md` and `notes/PRODUCT_VISION.md`.

**Goal:** Replace the conflicted PR #178 work with docs that describe the now-true product architecture.

## Scope
- Re-author the docs refresh against post-PR A/B/C/D reality
- Use the then-current developer/docs naming consistently; for any new work today, prefer current canonical naming from `notes/README.md`
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
