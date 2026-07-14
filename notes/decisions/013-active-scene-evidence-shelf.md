# ADR 013: Active Scene and Persistent Evidence Shelf

**Status:** Accepted
**Date:** 2026-07-14

## Context

The chat canvas is the persistent distillate of a conversation, but its first implementation used a desktop window-manager model: blocks were grouped into category windows, duplicate categories became sub-tabs, users selected a multi-window layout, and minimized windows moved into a tray.

That model preserved many artifacts at once, but it gave every block equal structural weight and spent scarce split-pane space on managing containers. It also made GenUI components feel like generic content dropped into independent frames instead of one intentional workspace for the current question.

Frontier chat products commonly replace a focused artifact with each turn. Purveyors needs more continuity than that because sourcing evidence, comparisons, and proposed actions can remain relevant across several turns, and users can pin evidence against agent-driven clear or replacement.

## Decision

The canvas uses one **active scene** plus a compact **persistent evidence shelf**.

Only the focused canvas block is visually presented as the active scene. Every retained block remains reachable from the shelf, and selecting a shelf item changes focus. Pinned blocks are visibly differentiated, prioritized in shelf order, and retain their existing protection from clear and replace operations.

The active scene owns contextual controls for its evidence: source-message focus, supported detail expansion, pin/unpin, and removal. The canvas does not render category windows, category sub-tabs, manual layout modes, minimize controls, a minimized tray, or multiple simultaneous block frames.

GenUI blocks remain purpose-specific within the scene. Coffee results use a compact horizontal snap navigator with one prominent card at a time and explicit comparison access. Tables, charts, and action cards retain their own interaction models.

Persisted `layout` and `minimized` fields remain tolerated as compatibility data, and existing mutations remain accepted while older conversations and agent responses age out. They no longer control the rendered canvas. Inactive action cards remain mounted but visually hidden so local edited or in-flight state survives shelf switching; durable execution IDs, persisted action status, and the atomic server ledger remain the final duplicate-write safeguards.

## Consequences

### Positive

- The canvas has one clear focal hierarchy at split-pane and mobile widths.
- Retained evidence keeps object permanence without requiring simultaneous windows.
- Chat references, pins, clear/replace, detail views, and source-message links keep their existing contracts.
- Components can develop a coherent GenUI grammar around scene intent rather than window chrome.

### Negative

- Comparing different block types requires shelf switching or a purpose-built comparison block instead of placing arbitrary windows side by side.
- Legacy layout hints remain in the transport and persistence shape until a later contract migration removes them.
- Keeping inactive action cards mounted has a small client-side cost, accepted to preserve editable and executing state.

### Risks and tradeoffs

- A shelf can become crowded in long conversations. This decision intentionally keeps the first slice compact and horizontally navigable; search, grouping, or a larger open workspace can be explored later with usage evidence.
- Coffee snap navigation must not become a universal component pattern. It is appropriate for repeated comparable cards, not for charts, tables, or actions.
- A future freeform or fullscreen workspace should be introduced as an expanded mode, not by reintroducing window-manager controls into the default split pane.
