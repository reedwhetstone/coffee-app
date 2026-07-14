# Pre-submission audit: conversation-first chat redesign

**Date:** 2026-07-13

**Branch:** `feat/chat-conversation-first`

**Base:** `origin/main`
**Verdict:** Ready

## Canonical verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
TOP_FIXES:
- None.
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
```

## What was reviewed

The audit reviewed the complete conversation-first redesign against its claimed intent, existing chat recovery and persistence behavior, evidence access, action safety, mobile parity, and the relevant product and brand direction.

The gate required three correction passes before reaching ready:

- Relabeled append-only response reuse from `Retry response` to the truthful `Ask again` and preserved unsent drafts.
- Added connected workspace coverage, safe clipboard failure feedback, and disabled message actions during active or clearing states.
- Captured failed ask-again requests so error recovery replays the correct prompt and request body without consuming, replacing, or repopulating the composer draft.

## Validation

- `pnpm exec vitest run src/lib/components/chat src/lib/components/canvas src/lib/components/genui src/routes/chat`: pass, 12 files and 39 tests before the final empty-composer regression test.
- `pnpm exec vitest run src/routes/chat/page.svelte.test.ts`: pass, 1 file and 6 tests after the final regression test.
- `pnpm lint`: pass.
- Placeholder-env `pnpm check --fail-on-warnings`: pass with 0 errors and 0 warnings.
- `git diff origin/main...HEAD --check`: pass.

## Known validation limit

No deterministic authenticated screenshot harness was available. Anonymous `/chat` requests redirect, so desktop and mobile visual inspection remains a preview-deployment review item rather than a claimed local validation result.

## Canvas-only evidence amendment

After preview review, the chat rendering contract was tightened so full GenUI components render only in the evidence canvas on every viewport. Desktop and mobile transcripts now use the existing compact preview links; mobile activation opens the canvas overlay focused on the corresponding block.

The amendment's first red-team pass found that companion previews reused their parent canvas ID and shifted later preview IDs. The final implementation centralizes canvas contribution ordering in `buildToolCanvasDispatchPlan`, which both canvas dispatch and transcript mapping consume. Errors use no canvas ID, primary and companion blocks receive distinct IDs, and subsequent tool results remain aligned.

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

- Focused Vitest suites: pass, 3 files and 16 tests.
- `pnpm lint`: pass.
- Placeholder-env `pnpm check --fail-on-warnings`: pass with 0 errors and 0 warnings.
- Amendment diff check: pass.
