# Chat Conversation-First Redesign

**Date:** 2026-07-13
**Status:** Implemented
**Scope:** `/chat` presentation, evidence choreography, transcript controls, and responsive behavior

## Problem

The current chat is capable but visually behaves like an internal AI workbench. The transcript, composer, tool telemetry, and evidence window all compete for attention. Structured results automatically open a 40% side pane, the composer reads as an edge-to-edge form, and the empty state is a dense onboarding card. This conflicts with the brand requirement that app tools be dense, calm, and scannable and with the product direction that intelligence should reduce navigation.

## Decision

Adopt a **conversation-first, evidence-on-demand** interaction model:

- the transcript remains visually stable while the assistant works
- evidence summaries remain available inline
- the full evidence workspace opens only after explicit user action
- the composer becomes one focused raised surface with progressive context controls
- raw tool telemetry collapses into a quiet research-status disclosure
- the empty state gets one restrained editorial moment without turning the operational chat into a marketing page

This is one atomic PR because the shell, composer, transcript spacing, status treatment, and evidence-open behavior form one connected user flow and touch overlapping components. Splitting them would leave intermediate states internally inconsistent and create conflicting edits.

## Acceptance criteria

### Conversation shell

- `/chat` has a clear compact identity row with `Ask Parchment`, evidence access, and secondary actions in overflow.
- The empty state uses a single concise editorial heading, one sentence of scope, and four compact starter prompts.
- Assistant text uses a narrower reading measure and more deliberate vertical rhythm.
- User messages use a subtle accent treatment rather than the full primary action color.

### Composer

- The composer is a centered raised surface rather than a full-width footer panel.
- Send/stop is integrated into the composer surface.
- Context is summarized compactly and detailed inclusion toggles are progressively disclosed.
- Error and suggestion states remain keyboard-accessible and do not obscure the primary input.

### Evidence and tool activity

- New structured results do not automatically resize the transcript.
- Users can explicitly open the evidence workspace from inline results or the chat header.
- Tool activity is summarized behind a disclosure rather than rendered as a persistent monospaced trace.
- The evidence header defaults to a focused review experience; multi-layout controls remain available through a labeled secondary menu when multiple blocks exist.

### Trust and responsive behavior

- Completed assistant messages expose copy and ask-again affordances without cluttering streaming messages.
- Mobile retains compact evidence links in chat; activating one opens the full evidence block in the canvas overlay without losing the conversation path.
- Existing stop/retry, workspace readiness, clear/export, context opt-in, action execution, and persistence behavior remain intact.

## Validation

- Focused component tests for toolbar, composer, message list, and chat page
- `pnpm lint`
- `pnpm check --fail-on-warnings`
- Relevant Vitest suite
- Desktop and mobile screenshot inspection from a deterministic component/page harness when available
- Independent pre-submission `verify-pr` red-team gate

## Strategy alignment

- `notes/PRODUCT_VISION.md`: advances intelligence as a replacement for navigation and makes the conversational layer a decision surface.
- `notes/BRAND.md`: applies the calm operational sans system, compact radii, warm surfaces, and one restrained editorial moment.
- ADR-009: preserves evidence, source, and action access on mobile through progressive disclosure rather than desktop-layout compression.
