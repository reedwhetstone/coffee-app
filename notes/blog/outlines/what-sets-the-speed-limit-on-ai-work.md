# Outline: What Actually Sets the Speed Limit on AI Work?

**Created:** 2026-07-16

**Pillar:** agentic-stack

**Status:** drafted (PR #480)

**Source:** #blog discussion 2026-07-16; `brain/ideas/verifier-latency-canonical-constraints.md`

**Target length:** approximately 600 words

## Thesis

AI work compounds at the speed of its verifier, not the speed of generation. Coding accelerates quickly because compilers, tests, and runtime behavior make many failures cheap to detect. Product and design have slower, noisier empirical feedback, but a small hierarchy of opinionated, revisable principles can create a fast coherence loop before ideas enter the slow reality loop with customers.

The framework does not claim to define universally good design. It defines what coherent product and design decisions mean for a particular operating environment and business strategy.

## Structure

### 1. Generation is not the bottleneck

- Open on the gap between fast production and slower verification.
- Use DORA's 2024 findings: AI adoption improved documentation quality, code quality, and review speed, while the same analysis associated higher adoption with lower delivery throughput and stability.
- Establish the term `verifier latency`.

### 2. Coding is unusually checkable

- Compilers, tests, schemas, linting, and runtime signals make many failures immediate.
- Product and design are ill-structured: the outcome depends on context, behavior, positioning, and delayed evidence.
- AI therefore magnifies the asymmetry between generating an answer and knowing whether it is the right answer.

### 3. Replace universal goodness with local coherence

- Product and design are opinionated systems, not universal optimization functions.
- Porter's strategy argument provides the business anchor: a strategy requires tradeoffs and choices about what not to do.
- GOV.UK provides a concrete design constitution: principles such as start with user needs, do less, design with data, iterate, and be consistent rather than uniform.
- A useful principle excludes at least one plausible choice; otherwise it is a value-shaped platitude.

### 4. Two feedback loops

- Fast coherence loop before implementation or experimentation.
- Slow reality loop after contact with users and the market.
- Canonical principles: hard-to-vary identity constraints.
- Operating rules and hypotheses remain revisable when reality contradicts them.

### 5. Every constitution needs an amendment gate

- New evidence should first challenge the hypothesis, then the operating rule, and finally the constitutional principle.
- Require repeated contradiction, name the identity consequence, and update downstream rules with the principle.
- End on the implication: AI makes explicit judgment infrastructure more important because generation is cheap.

## Sources

1. [Google Cloud, "Announcing the 2024 DORA report"](https://cloud.google.com/blog/products/devops-sre/announcing-the-2024-dora-report)

   Supports the measured gap between individual AI-assisted improvements and software delivery throughput/stability; also names small batches and robust testing as necessary foundations.

2. [Michael E. Porter, "What Is Strategy?", Harvard Business Review](https://hbr.org/1996/11/what-is-strategy)

   Supports strategy as a system of tradeoffs rather than universal best-practice optimization.

3. [GOV.UK, "Government Design Principles"](https://www.gov.uk/guidance/government-design-principles)

   Concrete example of opinionated, context-aware design constraints that explicitly remain open to improvement as user needs change.

## Verification

- [x] Body is approximately 600 words excluding frontmatter.
- [x] All three sources return HTTP 200 and are linked inline in the post.
- [x] DORA directionality matches the cited 2024 report summary.
- [x] No em dashes.
- [x] No unsupported universal claim that design quality can be empirically settled.
- [x] Constitutional principles are described as hard to vary, not immutable.
- [x] Alteration gate is present so the framework does not become the moat-prison failure mode.
- [x] Hero exists at `static/blog/images/what-sets-the-speed-limit-on-ai-work/hero.webp` and passes the vector-like abstract expressionist style gate: flat planes, crisp edges, no text or objects, and article-specific compression-through-a-boundary composition.
