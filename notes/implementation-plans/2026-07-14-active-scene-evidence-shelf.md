# Active Scene and Evidence Shelf

**Date:** 2026-07-14
**Status:** Implemented
**Scope:** `/chat` canvas presentation and canvas-local evidence navigation

## Problem

The evidence canvas currently presents retained results as category windows with sub-tabs, layout modes, per-window minimize controls, and a minimized tray. That desktop-window grammar fragments a narrow companion surface and makes individual GenUI blocks feel assembled rather than authored around the current conversational question.

The canvas still needs persistence beyond a single chat turn. Pinned evidence must survive agent replacement and clear operations, chat references must focus the exact retained block, and action cards must preserve their durable execution lifecycle.

## Decision

Replace the window manager with an **active scene plus persistent evidence shelf**:

- exactly one retained block is visually active at a time
- every other retained block appears as a compact shelf item
- selecting a shelf item focuses its block without changing the persistence contract
- pinned evidence is visually distinguished and remains protected by clear/replace
- active-scene controls are contextual: source message, detail, pin, and remove
- coffee-card blocks use a horizontal snap navigator with one prominent coffee at a time and explicit position controls
- all retained action cards remain mounted while inactive so in-flight execution and edited fields are not lost during shelf switching; the server execution ledger remains the duplicate-write authority

Legacy `layout` and `minimized` fields and mutations remain readable for persisted-state compatibility, but the canvas no longer exposes or renders their window-management behavior.

## Acceptance criteria

- The canvas renders one coherent active scene, with no category windows, sub-tabs, layout selector, minimize controls, or minimized tray.
- The compact shelf lists all retained evidence, prioritizes pinned items, and switches the active scene.
- Pin/unpin, remove with deterministic fallback, source-message focus, and supported detail expansion remain available for the active scene.
- Chat evidence references still focus the correct block on desktop and in the mobile overlay.
- Coffee result blocks present one focused coffee at a time with horizontal snap, previous/next controls, and an accessible position indicator.
- Tables, charts, and action cards retain their purpose-built presentations rather than inheriting the coffee navigator.
- Action execution state remains durable when the user changes active evidence.
- Focused component/store tests cover active selection, shelf switching, pin state, remove fallback, coffee navigation, and mobile evidence focus.

## Validation

- `pnpm lint`
- placeholder-env `pnpm check --fail-on-warnings`
- focused Vitest suites for canvas, canvas store, coffee GenUI, chat GenUI, and chat page behavior

## Strategy alignment

- `notes/PRODUCT_VISION.md`: reduces navigation and makes chat evidence a clearer decision surface.
- `notes/BRAND.md`: uses a calm, compact operational shell with one focal hierarchy.
- ADR-009: preserves evidence, source, action, and drill-in parity in the mobile overlay.
- ADR-011: keeps action execution identity and persisted status authoritative across remounts and retries.
