# Outline: Benchmark Leaders, Agentic Laggards

**Pillar:** agentic-stack
**Target:** 1,500-1,900 words (HARD CEILING)
**Status:** published (outline archived)
**Source material:** conversation 2026-03-01 (#blog), OpenClaw operational experience, model eval references

## Thesis

The industry keeps treating benchmark rank as a proxy for real-world usefulness. That shortcut breaks down in agentic coding systems. A model can top static reasoning benchmarks and still underperform in production if it cannot reliably plan, use tools, recover from failures, and maintain trajectory across long multi-step tasks. The highest-signal evaluation right now is not chatbot eloquence; it is coding-in-the-loop agentic performance measured by documented work done: completed tasks that save real time and money.

## Voice Constraints
- Curious and analytical, not combative. The question is "what are we missing," not "who is wrong."
- No lab tribalism. Focus on capability surfaces and evaluation design, not brand warfare.
- Keep it dense and practical. No hype language.
- Purveyors/OpenClaw examples as concrete illustrations, not self-promotion.
- Tie claims to outcomes. If a claim cannot connect to work completed, it does not belong.
- 3-4 citations in final draft, each tied to a specific claim.

## Verification Checklist
- [ ] Confirm exact model naming/versioning used in the post ("Gemini 3.1 Pro" vs current official naming at publication time)
- [ ] Verify current Artificial Analysis ranking language and date
- [ ] Verify benchmark definitions for any leaderboard cited (what is actually measured vs not measured)
- [ ] Verify GDPval framing and methodology details (economically valuable task coverage, scoring method)
- [ ] Verify FoodTruck Bench setup and limitations (simulation assumptions, robustness, reproducibility)
- [ ] Verify at least one coding benchmark (e.g. SWE-bench Verified) and what it captures/omits
- [ ] Validate any claim about market usage/adoption with evidence (community surveys, operator reports, public usage signals) or frame as observation/hypothesis
- [ ] Validate at least one concrete "work done" example in measurable terms (hours saved, intervention count, cost delta)
- [ ] Sanity-check all references to OpenClaw capabilities and constraints against current docs/config

## External References (working set)
1. **Artificial Analysis — Intelligence Index / model rankings**
   https://artificialanalysis.ai/
2. **GDPval-AA leaderboard**
   https://artificialanalysis.ai/evaluations/gdpval-aa
3. **GDPval paper** (economically valuable task benchmark)
   https://arxiv.org/abs/2510.04374
4. **FoodTruck Bench** (business simulation benchmark)
   https://foodtruckbench.com/
5. **SWE-bench / SWE-bench Verified** (real software tasks, repo-grounded)
   https://www.swebench.com/
6. **Google DeepMind — Gemini technical report / model cards**
   https://deepmind.google/technologies/gemini/

## Structure

### 1) The leaderboard paradox (~220 words)
Open with the tension: some models lead broad benchmark aggregates but lag in practitioner trust for autonomous coding workflows. Acknowledge the obvious pushback: benchmarks matter and often correlate with capability. Then draw the boundary: correlation weakens when tasks become long-horizon, tool-mediated, and execution-bound.

Key framing line: "The computer, not the chat window, is where value is created."

### 2) Two different products hiding in one model (~250 words)
Distinguish:
- **Chatbot performance:** single-turn reasoning quality, articulation, broad knowledge.
- **Agentic system performance:** planning + execution loop across tools, files, terminals, browser actions, retries, and state persistence.

Argument: buyers think they are purchasing one thing ("best model"), but operationally they need another ("best loop participant"). This is why benchmark leaders can still feel behind in agentic coding stacks.

### 3) Work done is the north-star metric (~300 words)
Make the core economic argument explicit:
- The best model is the one that completes verifiable work with low supervision.
- If output does not reduce labor hours, cycle time, or operating cost, benchmark rank is trivia.
- This mirrors the pricing shift already happening in agentic products: pay per ticket closed, per issue resolved, per workflow completed.

Anchor with practical operator metrics:
- Tasks completed per day
- Human interventions per task
- Mean time to successful completion
- Rework rate
- Cost per completed unit of work

### 4) Which benchmarks actually test work capability (~300 words)
Compare benchmark categories by signal quality:
- **Static intelligence aggregates:** broad capability hints, weak direct link to deployed outcomes.
- **GDPval-style evals:** stronger because they target economically valuable tasks.
- **FoodTruck Bench-style simulations:** useful for long-horizon decision quality, but sensitive to sim assumptions.
- **SWE-bench Verified:** strong signal for repository-grounded coding tasks.

Point: the interesting benchmarks now are those that approximate work systems, not trivia systems.

### 5) Case study frame: Gemini vs frontier agentic workloads (~300 words)
Present this as hypothesis-driven field observation, not a universal verdict:
- In chat mode, output quality can look strong.
- In agentic coding mode, operators report lower trust due to trajectory drift, verbose but weakly grounded reasoning, or fragile tool-loop behavior (to be evidence-backed in draft).
- Compare with models that may score lower on some static metrics but perform better under sustained tool use.

Important tone constraint: "behind the pack" should be framed as **behind on this surface**, not globally behind.

### 6) A better scoreboard: Work-Done Index (~230 words)
Evolve the earlier Agentic Performance Index into an economic scorecard:
- **Completion rate** on multi-step coding tasks
- **Median interventions per task**
- **Recovery rate after first failure**
- **Time-to-correct-PR**
- **False-progress rate** (claimed completion vs verifiable completion)
- **Cost per completed task**
- **Net labor-hours saved**

Point: this index maps model quality to business value.

### 7) What labs and buyers should do next (~200 words)
For labs:
- Publish agentic evals with full traces, not just final-answer scores.
- Report reliability under long context + tool loops.
- Include outcome-oriented metrics, not just pass/fail.

For teams:
- Run eval bake-offs inside your own agent framework.
- Pick models by completed work per dollar, not benchmark prestige.
- Consider model specialization by role (planner vs executor) if it improves throughput.

### Closing (~100 words)
Close on the central reframing: benchmark intelligence is necessary but insufficient. In this cycle, the winning model is the one that converts reasoning into verified actions on a real computer and produces measurable work outcomes.

## Verification (Blog → Code / Reality)
Before drafting, collect:
- 2-3 concrete task traces showing benchmark/agentic mismatch
- 1 counterexample where Gemini performs well in agentic settings (to avoid one-sided framing)
- 1 documented work-output example with measurable savings (time, intervention reduction, or cost)
- 1 explicit definition section so readers can reproduce the evaluation approach

## Candidate Hero Image Concepts (for later)
1. **Core tension:** high leaderboard peak vs low production confidence
2. **Structural motion:** split and divergence (single line bifurcating into stable vs unstable execution paths)
3. **Emotional tone:** analytical, not adversarial

Style note for next image pass: abstract expressionist + vector-like forms, minimal canvas texture, article-specific symbolism.