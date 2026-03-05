# DEVLOG Daily PR Automation Audit

Date: 2026-03-05
Scope: coffee-app implementation cadence and cron/agent workflow behavior

## What has worked

1. **One PR, one purpose**

   - Recent sequence (#56, #58, #59, #60, #61, #62, #65) merged quickly when each PR had a narrow scope.
   - Review and rollback risk stayed low.

2. **Plan-before-code flow**

   - The best outcomes happened when work was first framed in a concrete plan doc (example: wholesale/price-tiers sequence).
   - Reduced churn and rework during implementation.

3. **CI-gated loops**

   - Reliable pattern: local `lint + check + vitest`, then watch Code Quality + Playwright before merge.
   - Caught regressions early and prevented "green locally, red in CI" drift.

4. **Small docs-only PRs for backlog hygiene**
   - DEVLOG updates in dedicated docs PRs merged fast with low friction.

## What has not worked

1. **Overloaded cron prompts time out**

   - Some long, multi-phase cron jobs regularly hit timeout (`lastRunStatus: error`, timeout).
   - Too much breadth in one run reduces completion reliability.

2. **Ambiguous backlog items create planning drag**

   - Items with unclear requirements or broad wording cause repeated clarification loops.

3. **"Easy win" selection is inconsistent without explicit scoring**

   - Priority alone is not enough; complexity/risk/dependencies must be scored.

4. **Mixing planning + coding in one automated run is risky**
   - Best pattern is two-phase: (A) select + plan + summary, (B) code after feedback.

## Recommended operating model

## Phase A (daily cron): Plan only

- Read DEVLOG.
- Score candidates for easy-win selection.
- Write full implementation plan in `notes/implementation-plans/`.
- Post summary/questions for Reed review.
- **No code, no PR in this phase.**

## Phase B (manual trigger after approval)

- Implement approved plan.
- Run validation.
- Open PR.

## Easy-win selector rubric

Use weighted score:

- Priority score: P0=10, P1=8, P2=6, P3=5, P4+=4
- Complexity: easy=10, medium=6, hard=2
- Risk penalty: low=0, medium=-2, high=-5
- Dependency penalty: none=0, some=-2, blocked=-5

Pick the highest total that fits one clean PR.

## Exclusion rules for daily automation

Skip candidates that involve:

- DB migrations or schema redesign
- large refactors across many pages/components
- infrastructure/config overhauls
- vague or unclear requirements (`??` items)
- unresolved product ambiguity requiring discovery first

## Strategy alignment gate (mandatory)

Before selecting a daily feature, planning must cross-check current strategy context:

- DEVLOG priorities and latest notes
- Most recent published blog posts (`src/content/blog/*.svx`, non-draft)
- Active outlines (`brain/blog/outlines/`) when relevant

Each plan must include a **Strategy Alignment Audit** section that states:

- Which active strategy themes the feature supports
- Whether it conflicts with any current direction
- Why this is still the right next move now

## Deliverable contract (daily planning run)

The planning run must always produce:

1. Selected feature ID/title from DEVLOG
2. `notes/implementation-plans/YYYY-MM-DD-<slug>.md`
3. Concise summary with:
   - why selected
   - strategy alignment verdict
   - implementation outline
   - acceptance criteria
   - explicit questions for approval
