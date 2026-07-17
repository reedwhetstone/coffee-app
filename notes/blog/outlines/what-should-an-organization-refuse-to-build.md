# Outline: What Should an Organization Refuse to Build?

**Created:** 2026-07-16

**Pillar:** agentic-stack

**Status:** drafted (PR #480)

**Source:** #blog discussions 2026-07-16 and 2026-07-17; `brain/ideas/verifier-latency-canonical-constraints.md`

**Target length:** 800 to 1,000 words

## Thesis

Strategy becomes useful when it is explicit enough to exclude attractive alternatives, reasoned enough to earn conviction, and concrete enough to improve everyday decisions. Consequential choices should be backed by Strategic Conviction Records that put both the strategy and the basis for believing in it on the record. This turns strategy from aspiration into a durable constraint on output without pretending that conviction is certainty.

AI makes the value unusually visible because cheap generation produces more plausible work to evaluate. Verifier latency remains one benefit, not the thesis: a Conviction Record provides a fast coherence check while slower empirical feedback is still pending, but it cannot prove the strategy correct.

## Structure

### 1. Strategy has to exclude attractive alternatives

- Open with the distinction between documenting an ambition and making a consequential choice.
- Briefly ground the framework in Reed's experience applying the pattern first to marketing strategy at Gates and now to AI agents.
- Establish the failure mode: excellent local work can still move the larger system in the wrong direction.
- Use Porter's tradeoff argument to show why strategy requires choices about what not to do.
- Use GOV.UK as a concrete example of principles carrying decision consequences.
- Explain why broad organizational values become inconsequential as they are softened to satisfy every division.

### 2. Strategic Conviction Records make confidence legible

- Define the Strategic Conviction Record as a durable document containing the choice, intended direction, accepted tradeoff, rejected alternatives, assumptions, evidence, time horizon, reversal conditions, status, and revision history.
- Use Nygard's blind acceptance versus blind reversal distinction.
- Clarify that conviction means calibrated commitment, not leadership confidence or timeless certainty.
- Show how surviving assumptions strengthen conviction while contradictory evidence triggers revision without erasing institutional memory.

### 3. Conviction should improve output

- Make the mechanism explicit: choices create justified conviction; stable constraints reduce repeated debate; shared constraints improve coherence.
- Apply the commitments to roadmaps, briefs, designs, architecture, and marketing ideas.
- Treat conflicts as work to park, reshape, or use as evidence against the strategy rather than allowing quiet exceptions.
- Preserve a time-bounded experimental lane that can deliberately test the assumptions inside a Conviction Record.

### 4. AI makes the value visible

- Use Constitutional AI as a direct example of principles participating in production rather than sitting above it.
- Return to verifier latency: Conviction Records give data-starved functions a fast coherence check, not empirical truth or quantitative evidence.
- Close with the operational test: can the strategy reject a reasonable proposal, explain why, and name the evidence required to change the answer?

## Sources

1. [Michael E. Porter, "What Is Strategy?", Harvard Business Review](https://hbr.org/1996/11/what-is-strategy)

   Supports strategy as a system of tradeoffs rather than universal best-practice optimization.

2. [GOV.UK, "Government Design Principles"](https://www.gov.uk/guidance/government-design-principles)

   Concrete example of opinionated, context-aware principles that carry consequences for real decisions.

3. [Michael Nygard, "Documenting Architecture Decisions"](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

   Supplies the rationale, status, consequences, and supersession structure adapted into Strategic Conviction Records.

4. [Anthropic, "Constitutional AI: Harmlessness from AI Feedback"](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)

   Demonstrates an AI system using explicit principles to critique and revise its own output with reduced direct human labeling.

## Verification

- [x] Body is under 1,200 words excluding frontmatter (806 words).
- [x] All four sources return HTTP 200 and are linked inline in the post.
- [x] No em dashes.
- [x] Strategic conviction is clearly separated from empirical validation.
- [x] Strategic Conviction Records contain the choice, tradeoffs, assumptions, evidence, horizon, status, and revision history.
- [x] The governance and constitutional analogy detour has been removed.
- [x] Hero exists at `static/blog/images/what-should-an-organization-refuse-to-build/hero.webp` and still matches the revised thesis: many candidate directions compress against a strategic boundary and only coherent work passes through.
