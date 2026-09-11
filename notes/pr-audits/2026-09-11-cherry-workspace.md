# Cherry integrated shell and evidence workspace — slice 4a

## Outcome and sequence

This follows merged [web #609](https://github.com/reedwhetstone/coffee-app/pull/609) and [runtime #301](https://github.com/reedwhetstone/parchment-api/pull/301) under the [accepted overhaul plan](../implementation-plans/2026-09-11-cherry-agent-overhaul.md). Answers remain useful inline; the optional evidence workspace provides additional room without automatically taking over the conversation.

- One identity/header, one context-aware composer, and one evidence toggle on page and drawer.
- A single retained evidence component switches between keyboard-resizable desktop split, expanded comparison, and full-height mobile/drawer presentation.
- Coffee shortlists use responsive shared cards instead of a one-card carousel; canonical coffee details remain available.
- Individual page-context entities can be excluded from subsequent requests. Labels describe entities in view, not invented explicit selections or evidence authorization.
- Incoming agent presentations preserve the active scene and unfinished proposals. Pins retain existing protection. Agent-driven clear/replace retain proposed or executing proposals, including the `/clear` command, until the outcome arrives; completed outcomes can age out when the user focuses other evidence.
- Nested coffee, memory and generic details own keyboard focus, Tab and Escape, returning to their trigger. Returning to a source message closes evidence and focuses that exact answer.

## Ownership, lifetime, and boundaries

Parchment still owns tools, authorization, confirmed actions and durable workspace state. No endpoint, SDK version, persisted schema, execution ID, provider choice, or confirmation requirement changes. Existing interrupted-answer recovery and grounded coffee references remain in place; intermediary search cards do not return.

One mounted evidence surface preserves local proposal fields and in-flight UI state across close/reopen, expanded mode, and viewport changes. Scene scroll offsets are retained during mounted shelf switching. Existing saved canvas/transcript state restores selected evidence, pins, historical answers and canonical action outcomes. **Unsent composer drafts, unsubmitted proposal edits and pixel scroll positions are not newly persisted across full reload/navigation.** That remaining continuity work and the analytical/roastery family journeys are explicit follow-ups; this PR does not claim completion of every slice 4 acceptance criterion or the entire overhaul.

Coffee details now expose their actual dialog role and use the same nested keyboard-ownership helper as generic evidence details. The existing coffee panel remains nonmodal; this does not claim a new platform-wide modal manager or prevention of every simultaneous detail panel.

## Validation

- `VALIDATION_PASS`: `pnpm lint`; `git diff --check`; changed-document relative links.
- `VALIDATION_PASS`: `pnpm check --fail-on-warnings` (zero errors/warnings).
- `VALIDATION_PASS`: `pnpm exec vitest run src/lib/components/chat src/lib/components/canvas src/lib/components/genui src/lib/components/CoffeeCard.svelte.test.ts src/lib/components/layout/MobileOverlayShell.test.ts src/lib/services/coffeeReferences.test.ts src/lib/services/inlineCoffeeResults.test.ts src/lib/services/chatPersistence.test.ts src/lib/services/blockExtractor.test.ts src/lib/stores/canvasStore.svelte.test.ts src/routes/api/chat` (187 tests, 29 files).
- Browser: isolated system Chrome at 1440×1000 and 390×844 with actual ChatWorkspace/Canvas/card components, synthetic initial workspace data and mocked network responses. No model calls or real mutations.
- Twelve deterministic journey groups passed with zero browser page errors: closed initial evidence; keyboard split resizing; expanded comparison columns; retained composer/proposal edits; mobile resize continuity; nested coffee Escape; chart rendering; exact source-message focus return; selected evidence/pins through save/reload; error presentation; long history without horizontal overflow; drawer header, nested Escape, draft retention and full-workspace link.
- Nested coffee, memory and generic detail Escape/focus return have component regressions. Store tests prove agent-driven clear/replace retain unfinished proposals while completed outcomes age out after focus moves. Existing transport/recovery, historical references, pin/action-state and retired confirmed-action route tests also pass.
- Review found nested-detail focus/Escape, a slash-clear execution-retention bypass, inaccurate selected-entity copy, completed action-card accumulation, live-context opt-out resets, and nested memory keyboard ownership gaps. The four current Codex findings were corrected. Final red-team review also fixed Escape ownership when focus leaves a nested detail panel for an ancestor workspace control; the regression is covered by the evidence-workspace test.

The original interrupted browser check queried a dialog role that the coffee sheet did not expose. Inspection also established a real nested Escape bug; the sheet semantics and event ownership were fixed rather than simply weakening the assertion. Temporary harness files are not shipped.

Local toolchain is Node 24.19.0/pnpm 10.33.0 versus the repository's Node 22.x declaration; static env values are synthetic. Screenshots are a mounted deterministic harness, **not authenticated deployed E2E proof**. Production streaming timing, live-model link frequency, real entitled navigation/action writes, and access-loss journeys remain unverified. The existing admission/role rules are unchanged.

## Screenshots

- [Desktop answer](assets/cherry-workspace/desktop-answer.png), [split evidence](assets/cherry-workspace/desktop-split.png), [expanded comparison](assets/cherry-workspace/desktop-expanded.png)
- [Mobile answer](assets/cherry-workspace/mobile-answer.png), [evidence](assets/cherry-workspace/mobile-evidence.png), [edited proposal](assets/cherry-workspace/mobile-proposal.png)
- [Mobile chart](assets/cherry-workspace/mobile-chart.png), [error recovery](assets/cherry-workspace/mobile-error.png), [drawer](assets/cherry-workspace/mobile-drawer.png)
