# Active Scene Evidence Shelf Pre-Submission Audit

**Date:** 2026-07-14
**Branch:** `feat/active-scene-evidence-shelf`
**Mode:** Pre-submission red-team gate

## Final verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
```

The branch is independently mergeable. It replaces the canvas window-manager presentation with one active scene and a pinned-aware evidence shelf while preserving chat focus, mobile overlay, persistence compatibility, action identity, and pin/clear/replace behavior.

## Findings resolved before submission

1. Inactive non-action renderers were initially kept mounted, which would have triggered hidden roast-chart fetches and chart initialization as the shelf grew. The final implementation mounts only the focused ordinary scene while retaining inactive action cards for local edit and execution state.
2. The initial action-state test mocked the renderer and did not prove lifecycle behavior. The final integration test uses the real action card, edits a field, switches focus away and back, and confirms that the local value survives.
3. Parent review also aligned removal fallback with pinned-first shelf order, scrolled focused coffee results to the correct initial card, and removed inactive coffee slides from keyboard navigation.

## Validation

- `pnpm lint`: VALIDATION_PASS
- Placeholder-env `pnpm check --fail-on-warnings`: VALIDATION_PASS, 0 errors and 0 warnings
- Focused canvas, GenUI, store, chat-message, action-card, and route Vitest suites: VALIDATION_PASS
- `git diff --check origin/main...HEAD`: VALIDATION_PASS

The host uses Node 24.18.0 while the repository declares Node 22.x. Validation passed despite the engine warning. Authenticated visual validation remains assigned to the Vercel preview deployment.
