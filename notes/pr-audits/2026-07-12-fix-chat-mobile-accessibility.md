# Pre-submission audit: chat mobile evidence and accessibility

**Date:** 2026-07-12  
**Base:** `origin/main` (`e049b81`)  
**Head:** `f0a8bb3`  
**Intent:** Address audit findings 5, 8, 9, and 10 with inline mobile evidence, shared dialog focus behavior, controlled assistive announcements, and a remaining-height chat shell.

## Verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:
- none
CONFIDENCE: medium-high
SCOPE_ASSESSMENT: mergeable
VALIDATION_STATUS: focused tests and targeted lint pass; full check blocked by baseline CLI type drift
```

## Forest-level review

The slice is independently useful: small-screen chat now renders the complete evidence block while desktop retains the compact canvas jump; both drawer and evidence workspace use the existing shared focus-trapping dialog primitive; streaming suppresses token-by-token log announcements while summarized activity remains a status region; errors are alerts; and `/chat` owns a bounded `100dvh` shell slot instead of nesting `h-screen` under authenticated navigation padding.

The initial pass found and corrected two cheap P2 gaps before this final verdict:

- The first height correction was page-local and did not account for authenticated-shell padding. The final change makes the authenticated layout allocate the dynamic viewport and removes bottom padding only for `/chat`.
- The first accessibility pass left errors without explicit alert semantics and lacked regression coverage for dual mobile/full versus desktop/preview rendering. Both are now covered.

No Accepted ADR is contradicted. The web client remains the reference experience while the portable tool/data boundary stays unchanged.

## Validation

- `VALIDATION_PASS` `pnpm vitest run src/lib/components/genui/GenUIBlockRenderer.svelte.test.ts src/lib/components/layout/MobileOverlayShell.test.ts src/lib/components/chat/ChatDrawer.svelte.test.ts src/routes/chat/page.svelte.test.ts` (9/9)
- `VALIDATION_PASS` targeted ESLint for all changed Svelte and test files
- `VALIDATION_PASS` `git diff --check`
- `VALIDATION_BLOCKED_ENV` placeholder-env `pnpm check`: `origin/main` consumes Market Index and Parchment client members absent from the locked `@purveyors/cli@0.25.0`; 39 baseline errors appear outside this slice. CLI PR #126 is the queued dependency migration.

Browser-level mobile viewport evidence remains delegated to the PR preview because the local browser service was not part of this run.
