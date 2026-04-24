# Deterministic Core, Adaptive Edge

## Working title options

1. **Inference Is in the Name: If Nothing Is Unknown, Why Are You Calling an LLM?**
2. **Deterministic Core, Adaptive Edge: Where AI Belongs in Real Systems**
3. **Human-in-the-Loop Is Not a Religion: A Risk-Based Framework for AI Operations**

## Pillar

- Agentic Stack

## Thesis

Most teams are misframing the architecture choice as app vs agent. The real design decision is deterministic core vs adaptive edge. If inputs, transforms, and outputs are fixed, runtime inference adds cost and failure modes. If uncertainty and drift are real, AI can create compounding value only when paired with strong data foundations and tight feedback loops.

## Why now

A large portion of current AI products are "LLM wrappers" around deterministic workflows. At the same time, safety discussions default to "human in the loop" without modeling automation bias and monitoring failures.

## Core argument arc

### 1) Cheeky opening: inference implies uncertainty

- Hook line: "Inference is in the name. If your system has no unknowns, what exactly are you inferring?"
- Translate to engineering: deterministic problem classes should compile into software, not prompt templates.
- Decision test:
  - known data source
  - fixed cadence
  - stable transformation
  - fixed output schema
  - low ambiguity in evaluation
- If all five are true, prefer deterministic implementation.

### 2) Data first, always

- Product quality is capped by data quality and connectivity, not model size.
- Required foundations:
  - source coverage and access durability
  - normalized schemas and canonical entities
  - lineage and observability
  - quality checks + drift detection
- Claim: AI without data connective tissue produces impressive demos and fragile products.

### 3) Adaptive edge: where AI actually earns its keep

- AI is high-leverage for:
  - ranking and prioritization under uncertainty
  - exception handling
  - context-aware recommendations
  - natural language interfaces over structured systems
- AI should improve system behavior over time via feedback loops:
  - user corrections
  - outcome signals
  - model/policy updates
- Without feedback loops, "AI product" is often just beta software with higher cloud costs.

### 4) Human-in-the-loop vs human-out-of-the-loop is a control design problem

- Not binary. Control can be layered:
  - human-on-the-loop (monitor/override)
  - human-in-the-loop (approval gate)
  - human-out-of-the-loop (fully automated path)
- Key point: humans are not automatically safer in real-time loops.
  - monitoring fatigue and automation bias can degrade safety
  - handoff failure is a known failure mode
- Better framing: use risk-tiered control placement by domain, harm potential, and reversibility.

### 5) Practical framework: where each mode belongs

- Human-out-of-loop candidate characteristics:
  - high-volume repetitive decisions
  - mature test coverage and rollback paths
  - bounded action space and clear guardrails
  - rapid anomaly detection
- Human-in-loop candidate characteristics:
  - high consequence and low reversibility
  - weak observability or limited confidence signals
  - legal/regulatory requirements
  - novel edge cases not represented in training/eval
- Automated tests, CI/CD feedback, policy checks:
  - not in opposition to human oversight
  - table stakes infrastructure for both modes
  - they reduce toil and increase reliability regardless of loop placement

### 6) Close: architecture principle

- Build deterministic systems for guarantees.
- Add AI where adaptation is economically meaningful.
- Move humans to the highest-leverage points: policy, escalation, and exception adjudication.

## Suggested section-level evidence

- **NIST AI RMF 1.0**: human oversight is context- and lifecycle-dependent; risk prioritization is contextual, not one-size-fits-all.
- **CSET (2024) AI Safety and Automation Bias**: human-in-the-loop alone cannot prevent all failures; automation bias and monitoring limitations are real.
- **EU AI Act Article 14**: oversight measures must be proportionate to risk, autonomy level, and context of use; explicitly calls out automation bias.
- **DORA continuous delivery research**: automated testing/deployment and fast feedback loops improve reliability and reduce risk, including in regulated domains.

## Keep this post scoped

If the draft exceeds ~2,000 words, split:

- **Post A (this one):** deterministic core + adaptive edge + loop placement framework
- **Post B (follow-up):** deep dive on human-in/out loop safety with case studies and failure modes

## CTA options

- "Where in your product are you paying inference cost to solve a deterministic problem?"
- "What decisions in your stack should be machine-fast and fully automated, and which ones still need human authority?"

## Notes for voice

- Keep it direct and technical.
- Use one or two concrete examples; avoid a sprawling case-study list.
- Stay opinionated: this is a systems design argument, not a vibes post.
