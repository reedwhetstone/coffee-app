# Cherry compact chat — audit pass 1 / overhaul slice 4b

## Outcome and sequence

Implements the first recommended pass from the [66-point audit, PR #611](https://github.com/reedwhetstone/coffee-app/pull/611), originally stacked on the integrated workspace in [PR #610](https://github.com/reedwhetstone/coffee-app/pull/610). The [overhaul plan](../implementation-plans/2026-09-11-cherry-agent-overhaul.md) retains the larger connected-conversation/evidence outcome.

- Desktop `/chat` has no dedicated identity strip or decorative outer gutters. The existing app rail and bounded transcript/composer widths remain.
- Page evidence and conversation actions sit beside the composer. Context inclusion and suggestions are available through compact, bounded upward disclosures; context opt-outs retain their actual request semantics.
- A short placeholder avoids an empty mobile textarea growing just to display its instructions. The repeated role footer is removed; the input keeps its accessible agent name and keyboard description.
- Mobile uses one 56px app bar, plus the top safe-area inset. It retains app navigation and actions, removes the redundant self-navigation chat launcher, and does not link its current-chat label to the dashboard.
- The drawer retains its own title, close button and full-workspace link. Menus close on outside focus/pointer or Escape; selecting a menu action gives dialogs a visible focus-return target. The drawer focus trap includes summaries and skips controls in closed disclosures.
- Resting controls keep 44px touch targets; the composer reserves the bottom safe-area inset. The evidence component and proposal state are not remounted or moved to another store.

## Boundaries

No auth, runtime, SDK, business-write, persistence schema or action-execution changes. Stop, errors/retry, context exclusions, single-conversation history and existing state owners remain intact. This does not add search, jump-to-latest, drafting during streaming, durable unsent drafts, save-failure UI, or new market/roastery workflows. Those remain later audit passes. It does not remove navigation from host pages when opening the drawer.

## Validation

- `VALIDATION_PASS` — `pnpm lint`; `git diff --check`; changed-document relative links.

- `VALIDATION_PASS` — `pnpm check --fail-on-warnings`: zero errors/warnings.
- `VALIDATION_PASS` — `pnpm exec vitest run src/lib/components/chat src/lib/components/layout/MobileAppShell.svelte.test.ts src/lib/components/layout/MobileOverlayShell.test.ts src/lib/stores/canvasStore.svelte.test.ts`: 94 tests across 16 files. Includes actual request context exclusions, interrupted-turn persistence/recovery, proposal state, drawer retention, menus, summaries and nested Escape.

- `VALIDATION_PASS` — 27 deterministic browser journey groups via `pnpm exec vite --config tests/ui/cherry-compact/vite.config.mjs` plus `node tests/ui/cherry-compact/run.mjs`. [Harness instructions](../../tests/ui/cherry-compact/README.md), [results](assets/cherry-compact/results.json), [raw geometry](assets/cherry-compact/geometry.json).
- Browser matrix: empty, settled, working, error, expanded context, evidence and drawer at 1440×900, 1366×768 and 390×844; settled/context/drawer also at 320×640 and 683×384. The latter approximates 200% CSS-pixel reflow, not native zoom certification.
- Interaction checks: context toggle state, menu-only Escape, memory focus return, suggestions into focused draft, mobile app menu, source-message return, drawer initial focus and draft retention on close/reopen. No page errors or horizontal document overflow. Menus and input remain within the viewport.
- Review found a 320px drawer menu extending 28px off-screen. Anchoring that menu to the full drawer header fixed the clipping; the narrow regression is retained in the browser runner.

### Full-shell geometry

At default zoom, settled synthetic conversation, context closed, one-line empty input and evidence closed:

| Viewport   | Transcript | Composer | Mobile top row |
| ---------- | ---------: | -------: | -------------: |
| 1440 × 900 |     778 px |   122 px |              — |
| 1366 × 768 |     646 px |   122 px |              — |
| 390 × 844  |     666 px |   122 px |          56 px |

Laptop reading space exceeds the audit's 624px hypothesis; mobile receives 78.9% of its viewport before an on-screen keyboard. The 122px composer exceeds the aspirational 112px by 10px to retain 44px controls, padding and a separate input row; removing the entire desktop identity strip still exceeds the overall reading-space target. Expanded menus overlay the transcript without reallocating its height. Multiline drafts and visible errors may intentionally consume more height. Insets are zero in emulation, with CSS reserving actual device safe areas when supplied by the browser.

The audit's earlier PR610 fixture measured 483px laptop and 341px mobile reading space. Those are historical measurements under its documented fixture, not a claim of an authenticated deployment A/B test.

The browser harness mounts the actual root layout, `/chat` page and child components with synthetic auth, workspace data and intercepted network responses. It is client-side fixture proof, not server admission, deployed authenticated E2E, a live model run, assistive-technology certification or an actual mobile keyboard test. No real business writes are made. Static environment values come from the repository example; local Node 24 differs from the declared Node 22 toolchain.

## Screenshots

- [Laptop conversation](assets/cherry-compact/laptop-settled.png), [desktop conversation](assets/cherry-compact/desktop-settled.png), [mobile conversation](assets/cherry-compact/mobile-settled.png)
- [Laptop context](assets/cherry-compact/laptop-context.png), [mobile context](assets/cherry-compact/mobile-context.png), [mobile evidence](assets/cherry-compact/mobile-evidence.png)
- [Working](assets/cherry-compact/laptop-working.png), [mobile error](assets/cherry-compact/mobile-error.png), [mobile drawer](assets/cherry-compact/mobile-drawer.png), [narrow drawer](assets/cherry-compact/narrow-drawer.png)

## September 12 main-branch delivery correction

[PR #613](https://github.com/reedwhetstone/coffee-app/pull/613) merged into the old `openclaw/cherry-integrated-workspace` branch at `67f0a39b`, not into `main`. #610 had already merged before that branch received the compact-layout commit. Production commit `b44cb16e` therefore contained #610, #614 and #615, but not #613. This was a PR-target/sequence error, not stale browser cache or a release flag.

The correction cherry-picks the original compact-layout commit `0a23edba` onto current `origin/main` at `b44cb16e`. The commit applies without conflicts. The main-relative ChatWorkspace diff contains only control placement and related UI changes; automatic compression, terminal-error handling, unload replay, and the analytics rejection fix are retained.

- `VALIDATION_PASS`: 150 focused tests across 21 files cover the compact chat and mobile controls together with canvas/store/route persistence and recovery.
- `VALIDATION_PASS`: all 27 browser journey groups on the combined implementation, including desktop, mobile, 320px narrow and 200%-equivalent reflow. Screenshots and geometry are refreshed, not inherited from the retired feature preview.
- `VALIDATION_PASS`: strict type checks (zero errors/warnings), repository lint, and `git diff --check`.
- The correction PR targets `main` directly. Normal merge and deployment deliver the UI without a separate activation step. Production UI remains unchanged until that merge/deploy.
