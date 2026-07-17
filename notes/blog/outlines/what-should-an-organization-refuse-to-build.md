# Outline: What Should an Organization Refuse to Build?

**Created:** 2026-07-16

**Pillar:** agentic-stack

**Status:** drafted (PR #480)

**Source:** #blog discussions 2026-07-16 and 2026-07-17; `brain/ideas/verifier-latency-canonical-constraints.md`

**Target length:** 900 to 1,100 words

## Thesis

Organizations need a two-layer governance system: an opinionated canonical vision layer that defines direction, tradeoffs, and rejection criteria, plus an execution layer whose projects, incentives, architecture, people, and AI agents are governed against it. Each canonical throughline needs a Vision Decision Record preserving the assumptions and evidence behind it so conviction can strengthen when those assumptions hold and the canon can change when they fail.

Verifier latency is one important consequence, not the entire thesis. Canon gives product, design, marketing, and AI systems a fast coherence check while slower empirical feedback is still pending. It does not replace reality or turn qualitative judgment into quantitative evidence.

## Structure

### 1. Vision statements are not vision systems

- Open with the distinction between describing a destination and governing work toward it.
- Briefly ground the framework in Reed's experience applying the pattern first to marketing strategy at Gates and now to AI agents.
- Establish the failure mode: excellent local work can still move the larger system in the wrong direction.

### 2. The canonical layer must reject plausible work

- Define opinionated throughlines as future-facing choices, not descriptions of current practice.
- Use Porter's tradeoff argument to show why strategy requires choices about what not to do.
- Use GOV.UK as a concrete canon whose principles change decisions.
- Explain why broad organizational values become inconsequential as they are softened to satisfy every division.

### 3. Vision Decision Records keep conviction revisable

- Adapt the architecture decision record into a VDR containing assumptions, rejected alternatives, time horizon, consequences, and supersession evidence.
- Use Nygard's blind acceptance versus blind reversal distinction.
- Make the VDR at least as important as the throughline because it prevents both cargo-cult standards and casual reversals.
- Treat identity, multi-year strategy, and operating-window commitments as different clocks.

### 4. The execution layer turns belief into behavior

- Include roadmaps, budgets, briefs, incentives, review gates, architecture, prompts, humans, and agents.
- Require each meaningful proposal to map to a throughline; conflicts are parked, reshaped, or used to challenge the canon.
- Explain nested canons: local strategies can be more specific but should inherit from the parent strategy.
- Use the constitutional analogy narrowly: canon supplies continuity, execution administers it, and VDRs preserve reasoning and amendment history.

### 5. AI exposes the missing governance layer

- Use Constitutional AI as a direct example of principles participating in production rather than sitting above it.
- Return to verifier latency: canon gives data-starved functions a fast coherence check, not empirical truth or quantitative evidence.
- Close with the operational test: can the vision reject a reasonable proposal, explain why, and name the evidence required to change the answer?

## Sources

1. [Michael E. Porter, "What Is Strategy?", Harvard Business Review](https://hbr.org/1996/11/what-is-strategy)

   Supports strategy as a system of tradeoffs rather than universal best-practice optimization.

2. [GOV.UK, "Government Design Principles"](https://www.gov.uk/guidance/government-design-principles)

   Concrete example of opinionated, context-aware principles that reject plausible alternatives while explicitly remaining open to change.

3. [Michael Nygard, "Documenting Architecture Decisions"](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

   Supplies the rationale, status, consequences, and supersession structure adapted into Vision Decision Records.

4. [Anthropic, "Constitutional AI: Harmlessness from AI Feedback"](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)

   Demonstrates an AI system using explicit principles to critique and revise its own output with reduced direct human labeling.

## Verification

- [x] Body is under 1,200 words excluding frontmatter (890 words).
- [x] All four sources return HTTP 200 and are linked inline in the post.
- [x] No em dashes.
- [x] Canonical direction is clearly separated from empirical validation.
- [x] Vision Decision Records include assumptions, time horizons, consequences, and supersession evidence.
- [x] The constitutional analogy is bounded rather than treated as a literal organizational design.
- [x] Hero exists at `static/blog/images/what-should-an-organization-refuse-to-build/hero.webp` and still matches the revised thesis: many candidate directions compress against a canonical boundary and only coherent work passes through.
