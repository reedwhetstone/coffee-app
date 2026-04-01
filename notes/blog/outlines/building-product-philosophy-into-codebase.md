# Outline: Building Product Philosophy into the Codebase

**Created:** 2026-03-26
**Pillar:** agentic-stack
**Status:** outline
**Source:** #blog discussion 2026-03-25
**Companion post:** `brain/blog/outlines/sycophancy-the-final-hurdle.md`

---

## Working Titles (2-3 options)

1. **"Building Product Philosophy into the Codebase"**
2. **"Your AI Agents Need an Onboarding Stack, Not a Better Prompt"**
3. **"The Codebase Is the Onboarding Manual"**

Lean toward option 1 for clarity and searchability. Option 2 is the sharper HN title. Option 3 is the cleanest thesis in one line.

---

## Core Thesis (2-3 sentences)

If agents are blank slate coworkers, the hard problem is no longer getting them to write code. It is getting them to internalize why the product exists, what tradeoffs matter, which patterns are sacred, and where the business is actually trying to go. The teams that scale agentic development will win by turning product philosophy into load-bearing context inside the codebase itself: rules, ADRs, strategy docs, plans, examples, and retrieval layers that agents can actually read at execution time.

---

## Why Now

- The technical baseline has shifted. Agents can already generate, refactor, and review meaningful amounts of production code. The bottleneck moved from code generation to codebase steering.
- The sycophancy post already established the failure mode. Models implement what was asked. This post should explain how to make the right thing legible in the first place.
- The first wave of public evidence on context infrastructure is finally here. "Codified Context" formalizes the problem. Meta's REA and Confucius papers show what enterprise-scale persistent memory starts to look like. Tool vendors are all converging on the same primitives: memories, rules, indexing, code maps, review layers.
- More product decisions are now being executed by agents, not just suggested by them. If GTM strategy, design philosophy, and architectural rationale live in Notion, Slack, or someone's head, they are off-graph when the agent is coding.
- This is already happening in miniature inside Purveyors. The repo is not just source code. It contains strategy, plans, blog posts, audits, and agent rules, and those documents are already steering daily implementation choices.

---

## Section-by-Section Outline

### 1. The Blank Slate Coworker Problem

**Goal:** Reframe agent context as an onboarding problem, not a prompting trick.

**Content:**
- Open with the metaphor directly. If I hired ten new engineers tomorrow, I would not hand them Slack access and say "figure it out." I would onboard them. Agents deserve the same treatment, except they are faster, more literal, and less forgiving of missing context.
- New hire onboarding is not just tool setup. It is culture transfer, product intent, system boundaries, examples of good judgment, and an escalation path for ambiguous decisions.
- That maps cleanly to agentic software development:
  - orientation becomes repo-level rules and architecture docs
  - mentorship becomes review loops and scoped specialist agents
  - institutional knowledge becomes ADRs, plans, and searchable summaries
  - cultural norms become always-on constraints in AGENTS.md / CLAUDE.md / rules
- Stress the asymmetry. Human coworkers can infer culture from conversation and hallway context. Agents only know what they can read or retrieve. Missing context is not social overhead for them. It is operational blindness.
- This section should set up the whole post: product philosophy is a form of onboarding material.

**Evidence targets:**
- Systematic mapping study on onboarding in software organizations. Onboarding is a structured process of integration, support, communication, and culture transfer, not just technical setup.
- "Onboarding Bot for Newcomers to Software Engineering". Mentorship is valuable, but costly; structured tooling can offload part of the onboarding burden.
- "A Field Study of Developer Documentation Format" and "On-demand Developer Documentation". Documentation quality and presentation materially affect how quickly developers can orient themselves.

---

### 2. Docs in the Repo or It Doesn't Count

**Goal:** Make the strongest version of Reed's core insight: strategy docs outside the codebase are invisible to agents when it matters.

**Content:**
- Argue that docs-in-the-codebase is not just a docs preference. It is an execution primitive for agentic teams.
- Notion, Confluence, and slide decks are fine for humans, but they are separate retrieval systems. Unless explicitly indexed and ranked, they are absent at the moment of implementation.
- Docs-as-code has been pushing this for years for human teams: version control, code review, automation, merge-time proximity to change. Agentic development raises the stakes because colocated docs are not just easier to maintain, they are automatically available to the coder.
- Small, modular docs beat giant specs. Nygard's ADR argument applies perfectly here: large documents rot, small records preserve rationale.
- Make the stronger claim: blog posts, GTM memos, positioning docs, and implementation plans belong in the repo if they are supposed to shape agent behavior. A product's philosophy is not external commentary. It is part of the build context.
- Use a memorable line here: if the codebase is where work happens, it should also be where the reasons for the work live.

**Evidence targets:**
- Write the Docs docs-as-code guide. Shared tools, code reviews, automated checks, documentation required for merge.
- docs-as-co.de. Treat docs with the same toolchain as code so they stay in sync and reviewable.
- Nygard's ADR essay. Small, modular records preserve rationale and reduce blind acceptance or blind reversal.
- "On-demand Developer Documentation". The gap between documentation creators and consumers is a core failure mode; repo-adjacent generation and maintenance narrows it.

---

### 3. From Manifest File to Context Stack

**Goal:** Show the actual mechanisms people use today, then explain why a single root prompt file is necessary but insufficient.

**Content:**
- Start with the current baseline: CLAUDE.md, AGENTS.md, .cursorrules, Windsurf rules, playbooks, local examples, and PR review agents.
- Explain what these files are good at: stable conventions, forbidden patterns, tooling instructions, directory-specific rules, architecture summaries.
- Then make the scaling argument. A single manifest works for a vibe-coded SPA. It breaks when the system has multiple services, long-lived tradeoffs, non-obvious rationale, and dozens of recurring workflows.
- Use the "Codified Context" paper as the central research anchor. Their three-tier architecture is the cleanest articulation of the stack:
  - hot memory: constitution, always-loaded conventions and orchestration rules
  - specialist agents: domain-scoped expertise with embedded context
  - cold memory: on-demand specification documents and retrieval hooks
- Tie in ADRs here. ADRs are the missing bridge between style guides and judgment. They answer the exact question agents routinely fail on: why does this pattern exist, and under what conditions should I not simplify it away?
- Bring in Martin Fowler's autonomy experiment as a pragmatic counterpoint. Even with multiple agents, curated command allowlists, reference apps, code examples, and review loops, autonomy required structure everywhere. The lesson is not "agents are bad." It is "autonomy is scaffolding hungry."
- Strong sub-thesis: what scales is layered context, not longer prompts.

**Evidence targets:**
- "Codified Context: Infrastructure for AI Agents in a Complex Codebase". Single-file manifests do not scale; tiered hot/cold memory and specialist routing do.
- Nygard's ADR format and the 2024 ADR-in-practice action research study. ADRs are still one of the best compact formats for preserving rationale.
- Martin Fowler, "How far can we push AI autonomy in code generation?" Structured multi-agent workflow, reference examples, deterministic scripts, and review loops all matter.
- Windsurf Memories & Rules docs. They explicitly recommend Rules or AGENTS.md for durable, shareable knowledge rather than relying on auto-generated memories.

---

### 4. The Purveyors Case Study: Product Philosophy Already Living in the Repo

**Goal:** Ground the piece in a real operating example. Show how this works today at small scale.

**Content:**
- This is the practical core of the post. Show that Purveyors is already treating the codebase like an onboarding surface for agents.
- Evidence to highlight:
  - `repos/coffee-app/AGENTS.md` functions as stable repo guidance for coding agents.
  - `notes/DEVLOG-DAILY-PR-AUDIT.md` requires every daily feature plan to cross-check DEVLOG priorities, recent published blog posts, and active outlines before choosing what to build.
  - Implementation plans explicitly include a "Strategy Alignment Audit" that lists which active product themes a change supports.
  - `notes/genui-platform-transition-plan.md` describes workspace summaries, global summaries, and persisted context docs as first-class product primitives.
  - `notes/API_notes/API-strategy.md` and `notes/MARKET_ANALYSIS.md` encode market segmentation, pricing, and product direction in plain text inside the repo.
  - The published post "Building a Coffee Data Pipeline from Scratch" already frames the human role as direction and review while agents handle the loop.
- This is the key move: the blog is not downstream marketing. The blog, notes, plans, and implementation docs feed back into product execution. The repo becomes a recursive strategy engine.
- Make the case that even small teams should practice this now, because the enterprise version is the same pattern with more retrieval infrastructure.

**Evidence targets:**
- Local source files:
  - `/root/.openclaw/workspace/AGENTS.md`
  - `/root/.openclaw/workspace/repos/coffee-app/AGENTS.md`
  - `/root/.openclaw/workspace/repos/coffee-app/notes/DEVLOG-DAILY-PR-AUDIT.md`
  - `/root/.openclaw/workspace/repos/coffee-app/notes/implementation-plans/2026-03-19-bean-profile-data-completeness.md`
  - `/root/.openclaw/workspace/repos/coffee-app/notes/implementation-plans/2026-03-24-wholesale-markers-roast-profiles.md`
  - `/root/.openclaw/workspace/repos/coffee-app/notes/genui-platform-transition-plan.md`
  - `/root/.openclaw/workspace/repos/coffee-app/notes/API_notes/API-strategy.md`
  - `/root/.openclaw/workspace/repos/coffee-app/src/content/blog/building-a-coffee-data-pipeline.svx`
- Key proof point to quote: daily planning in Purveyors must read recent blog posts and active outlines before deciding what to build.

---

### 5. Enterprise Scale: From Repo Docs to a Second Brain

**Goal:** Explain what changes at 500K+ lines and dozens of services. Show why layered retrieval becomes necessary.

**Content:**
- At enterprise scale, the core problem is no longer writing the docs. It is ranking, routing, and refreshing them.
- A single repo-level instruction file collapses under scope. Different services have different constraints. Different teams encode conflicting assumptions. Product strategy changes faster than foundational architecture.
- The scalable pattern is a layered memory system:
  - always-loaded product constitution and engineering norms
  - service-local rules and examples
  - ADRs and design docs for rationale
  - generated maps/wiki artifacts for navigation
  - cold-memory retrieval over lower-frequency specs and historical decisions
  - reviewer and audit agents to prevent drift
- Public Meta evidence is thin but important. REA describes a historical insights database, runbooks of failure patterns, codebase navigation tools, and an internal framework that preserves state across long-horizon workflows. Confucius adds persistent note-taking for cross-session continual learning. That is very close to the "second brain for agents" idea, even if Meta does not publish the full internal knowledge architecture.
- Important nuance: retrieval alone is not enough. At scale, you also need authority ranking. The agent has to know which document wins when GTM notes, architecture docs, stale README content, and recent PRs disagree.
- Tie this to the existing Purveyors post idea "Embeddings Are Not Search." Enterprise second brains need ranking by recency, locality, ownership, and strategic authority, not just nearest-neighbor similarity.

**Evidence targets:**
- Meta REA engineering post. Historical insights database, runbooks, codebase navigation tools, hibernate-and-wake persistence.
- Confucius Code Agent paper. Persistent note-taking system, unified orchestrator, large-codebase context management.
- Codified Context paper. Hot/cold memory split and retrieval hooks as codebase size grows.
- Optional callback to the existing Purveyors outline "Embeddings Are Not Search" as an adjacent argument.

---

### 6. What the Market Is Building, and What It Still Misses

**Goal:** Compare how current products attack the context problem. Distill the converging design pattern.

**Content:**
- Use four buckets instead of a shallow tool roundup.

**Bucket 1: Rules and durable local knowledge**
- Windsurf is explicit: auto-generated memories are helpful, but durable knowledge should be written into Rules or AGENTS.md.
- This is a strong signal that the market has learned "memory" without version control is too soft for real team context.

**Bucket 2: Indexing and codebase understanding**
- Devin indexes repos, supports Ask Devin for codebase Q&A, generates DeepWiki artifacts, and now offers Devin Review plus codemaps through the broader Cognition stack.
- The pattern is not just coding. It is indexing, explanation, review, and delegation.

**Bucket 3: Parallel agent orchestration**
- Devin's managed Devins and Meta's REA/Confucius both treat large tasks as decomposition problems. Clean sub-sessions beat one bloated session.
- This is context engineering by task partitioning.

**Bucket 4: Enterprise platform positioning**
- Factory emphasizes secure enterprise integration and smoother onboarding to unfamiliar codebases.
- Blitzy publicly claims dedicated agents map and understand the codebase before generation, then validate outputs at compile and runtime.
- Public detail is thin, but the repeated claim is revealing: everyone is selling some version of pre-generation codebase understanding.

- Then deliver the synthesis: all of these tools are converging on the same architecture.
  - indexed codebase context
  - durable rules
  - generated summaries/maps
  - task decomposition
  - review surfaces
- What is still missing in most public tooling is first-class product philosophy and GTM context. Many tools understand the codebase. Fewer understand why the product exists.

**Evidence targets:**
- Windsurf home page and Memories & Rules docs.
- Cognition posts on Ask Devin / DeepWiki / Devin Review / managed Devins / Codemaps.
- Factory enterprise pages and public case-study language.
- Blitzy public product descriptions from homepage and "how it works" materials.

---

### 7. A Practical Blueprint for Building Product Philosophy into the Codebase

**Goal:** End with a concrete operating model that teams could adopt tomorrow.

**Content:**
- Present a layered blueprint, maybe as a numbered list rather than a framework graphic.

**Layer 1: Constitution**
- Root AGENTS.md / CLAUDE.md with product principles, engineering norms, forbidden shortcuts, and review policy.

**Layer 2: Locality**
- Directory-scoped rules for service-specific constraints, examples, and contracts.

**Layer 3: Rationale**
- ADRs for non-obvious decisions. Make the strange parts of the system legible.

**Layer 4: Strategy artifacts in repo**
- GTM notes, market analysis, implementation plans, blog drafts, positioning docs, and pricing logic live beside the product.

**Layer 5: Generated context**
- Code maps, DeepWiki-style summaries, architecture indexes, dependency graphs, and searchable snapshots.

**Layer 6: Cold memory retrieval**
- Lower-frequency docs, past incidents, experiments, and design discussions are retrievable on demand with authority ranking.

**Layer 7: Independent review**
- Separate reviewer agents or humans verify not just correctness, but intent alignment.

- Then cover failure modes:
  - giant monolithic manifests
  - duplicated truths across docs
  - stale notes that outrank current reality
  - context hidden in Slack/Notion/email
  - retrieval with no authority model
  - no review loop to catch bad local optimizations
- Close with the strongest sentence in the piece: if agents are coworkers, onboarding is infrastructure. Product philosophy should be treated like code because, in an agentic organization, it effectively is.

**Evidence targets:**
- Reuse citations from sections 2-6.
- Pull one crisp internal Purveyors example per layer where possible.

---

## Scope Control

**In scope:**
- Agent context as an onboarding problem
- Docs-in-the-codebase as execution infrastructure
- Current mechanism stack: manifest files, rules, ADRs, plans, generated maps, retrieval
- Purveyors as the small-scale case study
- Enterprise-scale memory and retrieval patterns
- Vendor comparison only insofar as it reveals the emerging architecture

**Out of scope:**
- Re-explaining RLHF or sycophancy mechanics in depth; the companion post handles that
- A generic RAG implementation tutorial
- Benchmark horse-race content between coding tools
- Security and governance deep dive; mention only when relevant to enterprise context
- A claim that markdown files alone solve enterprise context. The point is layered infrastructure, not "just write more docs"

**How this differs from the sycophancy post:**
- **Sycophancy** is the diagnosis: why agents implement the wrong thing too eagerly.
- **This post** is the systems response: how to encode enough product and architectural intent that "the right thing" is actually available to the agent at decision time.
- The two pieces should read as problem and solution, not as two independent essays.

**Target length:** 2,000-2,800 words. Dense, practical, no filler.

---

## Reference / Citation List

### Core research and essays

1. **Codified Context: Infrastructure for AI Agents in a Complex Codebase**
   - <https://arxiv.org/html/2602.20478v1>
   - Use in sections 3 and 5

2. **How far can we push AI autonomy in code generation?**
   - <https://martinfowler.com/articles/pushing-ai-autonomy.html>
   - Use in section 3

3. **Documenting Architecture Decisions** by Michael Nygard
   - <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
   - Use in sections 2, 3, and 7

4. **Architecture Decision Records in Practice: An Action Research Study**
   - <https://doi.org/10.1007/978-3-031-70797-1_22>
   - Use in section 3

### Onboarding and documentation literature

5. **A Systematic Mapping Study of the Onboarding Process in Software Development Organizations**
   - <https://doi.org/10.1145/3629479.3629500>
   - Use in section 1

6. **Onboarding Bot for Newcomers to Software Engineering**
   - <https://doi.org/10.1145/3379177.3388901>
   - Use in section 1

7. **On-demand Developer Documentation**
   - <https://doi.org/10.1109/icsme.2017.17>
   - Use in sections 1 and 2

8. **A Field Study of Developer Documentation Format**
   - <https://doi.org/10.1145/3544549.3585767>
   - Use in section 1

9. **Docs as Code** by Write the Docs
   - <https://www.writethedocs.org/guide/docs-as-code/>
   - Use in section 2

10. **Documentation As Code**
   - <https://docs-as-co.de/>
   - Use in section 2

### Enterprise and product examples

11. **Ranking Engineer Agent (REA): The Autonomous AI Agent Accelerating Meta's Ads Ranking Innovation**
   - <https://engineering.fb.com/2026/03/17/developer-tools/ranking-engineer-agent-rea-autonomous-ai-system-accelerating-meta-ads-ranking-innovation/>
   - Use in section 5

12. **Confucius Code Agent: Scalable Agent Scaffolding for Real-World Codebases**
   - <https://arxiv.org/abs/2512.10398>
   - Use in section 5

13. **How Cognition Uses Devin to Build Devin**
   - <https://cognition.ai/blog/how-cognition-uses-devin-to-build-devin>
   - Use in sections 5 and 6

14. **Devin Review: AI to Stop Slop**
   - <https://cognition.ai/blog/devin-review>
   - Use in section 6

15. **Devin can now Manage Devins**
   - <https://cognition.ai/blog/devin-can-now-manage-devins>
   - Use in section 6

16. **Windsurf Codemaps: Understand Code, Before You Vibe It**
   - <https://cognition.ai/blog/codemaps>
   - Use in section 6

17. **Windsurf Memories & Rules**
   - <https://docs.windsurf.com/windsurf/cascade/memories>
   - Use in sections 3 and 6

18. **Windsurf product site**
   - <https://windsurf.com/>
   - Use in section 6

19. **Factory Enterprise**
   - <https://factory.ai/enterprise>
   - Use in section 6

20. **Blitzy homepage / product materials**
   - <https://blitzy.com/>
   - <https://blitzy.com/how_it_works>
   - Use in section 6, but keep claims narrow because public technical detail is limited

---

## Purveyors Case-Study Source Files Examined

- `/root/.openclaw/workspace/AGENTS.md`
- `/root/.openclaw/workspace/repos/coffee-app/AGENTS.md`
- `/root/.openclaw/workspace/repos/coffee-app/notes/DEVLOG-DAILY-PR-AUDIT.md`
- `/root/.openclaw/workspace/repos/coffee-app/notes/implementation-plans/2026-03-19-bean-profile-data-completeness.md`
- `/root/.openclaw/workspace/repos/coffee-app/notes/implementation-plans/2026-03-24-wholesale-markers-roast-profiles.md`
- `/root/.openclaw/workspace/repos/coffee-app/notes/genui-platform-transition-plan.md`
- `/root/.openclaw/workspace/repos/coffee-app/notes/API_notes/API-strategy.md`
- `/root/.openclaw/workspace/repos/coffee-app/notes/MARKET_ANALYSIS.md`
- `/root/.openclaw/workspace/repos/coffee-app/src/content/blog/building-a-coffee-data-pipeline.svx`

---

## Voice Notes

- First person singular throughout. This should sound like I am writing from operating experience, not summarizing a literature review.
- Keep the "blank slate coworker" metaphor front and center. Use it in the opening and again in the close.
- Dense, practical, opinionated. This should read like HN bait written by someone actually doing the work.
- Make the repo-level insight concrete fast. Do not wait 1,000 words to explain why blog posts and GTM docs should live in the codebase.
- Do not oversell any vendor. Use them as convergent signals, not as authorities.
- Be honest that public evidence on Meta and Blitzy is partial. Partial evidence is still useful if framed carefully.
- ADRs should be framed as anti-amnesia tools. They preserve rationale, not just decisions.
- Avoid MBA tone like "knowledge management solution." Prefer sharper language: onboarding, memory, rationale, authority, retrieval, drift.
- No em dashes. No fluff. No generic "AI is changing everything" throat clearing.
- One line worth keeping: **"If the agent is coding inside the repo, then the product philosophy has to be there too."**

---

## Connection to Existing Posts

- **Primary companion:** `brain/blog/outlines/sycophancy-the-final-hurdle.md`
  - That post is the failure mechanism.
  - This post is the infrastructure response.
  - Suggested handoff sentence from sycophancy into this piece: "Once you understand why agents agree too easily, the next question is obvious: where do you put the judgment you wish they had?"

- **Direct case-study predecessor:** `src/content/blog/building-a-coffee-data-pipeline.svx`
  - That post established the "economy of directors" pattern and the human role as strategy plus review.
  - This post should extend it by asking what happens when the agentic surface area grows beyond a narrow, audit-friendly pipeline into the full product codebase.

- **Useful adjacent post:** `brain/blog/outlines/embeddings-are-not-search.md`
  - Enterprise second brains need authority ranking, not just retrieval.
  - Good cross-link if section 5 leans into ranking and retrieval.

- **Useful adjacent post:** "Benchmark Leaders, Agentic Laggards"
  - Reinforces that workflow integration and context engineering matter more than abstract model rank.

---

## Notes on the Sharpest Argument

The strongest non-obvious claim in this piece is not "write better docs." It is this: **product strategy itself is now part of the execution environment.** In a human-only team, strategy can remain half-explicit because developers absorb it socially. In an agentic team, anything not encoded is effectively absent. That is the conceptual leap this post should own.

A second strong claim: **ADRs, blog posts, and implementation plans are all the same class of artifact now.** They are not just communication outputs. They are retrieval surfaces for future agents.

A third strong claim: **enterprise "second brain" systems are not exotic.** They are the scaled-up version of what small teams can already practice in Git today.
