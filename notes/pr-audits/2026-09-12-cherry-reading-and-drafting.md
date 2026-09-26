# Cherry reading position and in-flight drafts

## Outcome and scope

Implements two selected items from the [chat UX audit](2026-09-11-cherry-chat-ux-benchmark.md), on top of merged #616's compact layout. One main-targeted PR delivers both behaviors without a flag or backend change.

- Scrolling up away from the latest output pauses following. A floating 44px-target **Jump to latest** control appears without allocating another toolbar row. It changes to **New output · Jump to latest** when assistant text or tool progress changes. A stable polite announcement reports new output without announcing every token.
- Clicking the control or manually returning to the bottom acknowledges output and resumes following. Frame callbacks recheck reading intent, and evidence-source navigation cancels pending following. Container/content resize observation follows late layout only when following is enabled. No smooth-scroll loop competes with reading; explicit latest navigation is instant and works with reduced motion.
- The composer remains editable during submission and streaming. Enter and form submission are guarded in both the composer and its parent. Shift+Enter remains a newline, IME composition does not submit, and no queue is created. The placeholder and accessible description explain drafting while Cherry responds.
- Stop explicitly prevents the native click's default form submission. Otherwise synchronous completion can turn the same button into Send during that click and unintentionally submit the draft, a defect reproduced by the browser fixture and corrected here.
- Completion, Stop, and failures preserve the new draft, including a deliberately emptied draft. Retry resends the failed prompt and its original context, never the unsent follow-up. Expanded slash-command prompts preserve their actual sent meaning on retry. If no draft was edited, the existing convenience of restoring the failed prompt remains.

Search, durable drafts across reload, server history pagination, model changes, and automatic queuing are not included. Existing workspace admission remains required; editing stays disabled during conversation clearing. Explicitly sending a request or retrying it navigates to the latest turn. This does not add persistence of pixel reading positions across reloads.

## State ownership and transitions

`ChatWorkspace` remains the owner of the draft and active request snapshot for both page and retained drawer. `ChatComposer` reports user editing and never owns a second queue. Draft state lasts for the mounted workspace, including drawer close/reopen, not full reload.

The same workspace owns following intent, last-seen assistant output, and the pending animation frame. `ChatMessageList` exposes its scroll container and content element for geometry observation. Following and new-output state are local UI state, not saved conversation or canvas data. Evidence source navigation explicitly pauses following before moving the reader. Existing persistence, action receipts, permissions, and context selection remain in their established owners.

## Validation and inherited invariants

- `VALIDATION_PASS`: 156 focused tests across 21 files, including chat components, mobile overlays, canvas persistence, workspace storage, and server canvas routes. New cases cover complete/stop/disconnect/erased draft, original-prompt retry, slash-command retry, Enter/form gating, and composition behavior.
- [100-turn browser runner](../../tests/ui/cherry-compact/reading.mjs) mounts the actual root layout/chat components with synthetic auth and intercepted network responses. Desktop, mobile, and drawer journeys check wheel scrolling, new-output indication, stable reading position across streaming and draft resize, keyboard jump/focus, resumed following, manual return to bottom, evidence-source return, Stop's native form action, and draft retention through retry and drawer reopen. [Results](assets/cherry-reading/results.json).
- `VALIDATION_PASS`: all 27 existing compact-layout browser journeys at 1440px desktop, laptop, mobile, 320px narrow, and 200%-equivalent reflow.
- Existing #610/#616 focus, context opt-out, one evidence surface, and compact-space invariants are covered by the combined component/browser suites.
- Existing #614/#615 codec bounds, Unicode cutoff, corrupt-state handling, retryable conflicts, historical pinned evidence, canonical action outcomes, autosave/unload, and quota-rejected unload recovery are retained in the 156-test suite. No persistence codec or route implementation is changed.
- `VALIDATION_PASS`: strict type checks (zero errors/warnings), repository lint, and diff checks. Local validation uses Node 24.19.0 (repo declares Node 22) and example environment values. Browser fixtures contain no customer data and do not establish production authentication, physical mobile-keyboard behavior, or a live-model run.

## Search recommendation, not implemented

The reload endpoint currently requests only 50 messages. Searching the browser's loaded list alone would not implement whole-conversation search.

Recommended first version: a debounced, literal case-insensitive phrase search over saved user/assistant prose in Parchment, constrained to the authorized conversation. Return stable message IDs, short excerpts, and enough cursor information to navigate results. Fetch the surrounding history on selection, highlight matches in rendered prose without rewriting stored content, and leave source/evidence actions usable. An in-chat field, result count, previous/next controls, Enter/Shift+Enter, and Escape make the behavior discoverable and keyboard-operable. Closing search should restore the previous message anchor and offset. No raw tool-payload, summary-memory, or semantic search in the initial version.

The server must search the authoritative retained history, not just the 24 messages sent to the model or the 50 fetched on reload. This needs a Parchment-owned search/history contract and corresponding web integration as a separately authorized slice.

## Screenshots

- [Desktop reading while drafting](assets/cherry-reading/desktop-reading.png)
- [Mobile reading while drafting](assets/cherry-reading/mobile-reading.png)
- [Retained drawer](assets/cherry-reading/drawer-reading.png)
