# What an AI Center of Excellence Actually Needs

## Meta
- **Pillar:** agentic-stack
- **Tags:** enterprise-ai, governance, agentic-workflows
- **Target length:** 1,800-2,200 words
- **Status:** outlined
- **Source idea:** DaVita AI TPM rejection feedback (Mar 17, 2026). Winning candidates had "defined processes for an AI Center of Excellence" or "implemented AgentForce in a large enterprise." This post addresses the underlying question: what does an AI CoE actually require, stripped of vendor branding?
- **Career angle:** This doubles as a portfolio artifact. Reed can reference it in interviews to demonstrate AI governance thinking grounded in real implementation experience.

## Thesis

Most AI Centers of Excellence fail because they start with the agent and work backwards to governance. Building an AI agent is trivially easy in 2026. Maintaining one at enterprise scale is not. The real work is the same work it's always been: governance, adoption, and trust infrastructure. The enterprises getting this right aren't the ones with the best models; they're the ones whose governance frameworks were already strong enough to absorb AI as a new layer.

## Counterintuitive Angle

The people best positioned to build AI Centers of Excellence aren't AI specialists. They're enterprise adoption PMs who understand governance frameworks, change management, and heterogeneous environments. The AI part is the easy layer; the organizational scaffolding underneath it is the hard one. And the biggest advantage of enterprise AI platforms isn't their AI; it's that they're already inside the building.

## Outline

### 1. The POC Illusion (opener, ~300 words)
- Building an AI agent is technically accessible. Vercel AI SDK, n8n, frontier models: functional proof-of-concept in days.
- The 2026 reality: the hidden cost is indefinite maintenance. RAG pipeline upkeep, API breakages as providers change, model drift as foundational models update. Buying gets feature parity in weeks; building means owning maintenance forever.
- Gartner stat: 75%+ of enterprises moving from AI experimentation to operationalization; most fail without a strategic framework (Source: Gartner via Tredence, Sep 2025).
- MIT Sloan (Nov 2025): "Build centralized governance infrastructure before deploying autonomous agents." 250% growth expected in AI decision-making authority.
- **The question:** If building the agent is the easy part, what's the hard part? The answer is everything underneath it.

### 2. The Five Layers of an AI CoE (~700 words)
Strip away vendor names. An AI CoE needs exactly five things:

**Layer 1: Build-vs-Buy at Enterprise Scale (not POC scale)**
- Evaluation dimensions: integration complexity, vendor lock-in risk, data residency, cost structure (per-seat vs per-call vs per-token), extensibility, and the one most teams skip: ongoing maintenance burden.
- The maintenance trap: custom RAG pipelines need chunking strategy updates, embedding model migration, retrieval tuning. A custom agent that works in January may hallucinate by March if the underlying model changes.
- *Our experience:* Model routing with fallback chains. Primary provider, secondary on rate-limit, cost-optimized for batch. Every routing decision is a build-vs-buy micro-decision with real TCO implications.

**Layer 2: Security, Governance, and the "Already Inside the Building" Advantage**
- In enterprise, data access is labyrinthine. Rebuilding RBAC (role-based access control) and field-level security from scratch for a custom AI tool is a massive compliance risk.
- The incumbent advantage: platforms like Salesforce AgentForce natively inherit existing permission sets. Their trust layers (data masking, zero-retention) are already signed off by the CISO. That eliminates months of procurement and compliance friction.
- This isn't about the AI being better. It's about the AI being pre-approved.
- *Our experience:* We design explicit permission boundaries for what agents can and cannot do autonomously. Content hardening against prompt injection. Untrusted-data wrapping. These are engineering decisions that belong in a governance framework. At enterprise scale, the question isn't "can we build these controls?" It's "can we get them through security review faster than a platform that already passed?"

**Layer 3: Data Architecture (RAG vs. Real-Time Context)**
- The custom approach: chunk CRM data, store in a vector database, retrieve at query time. This works for POCs.
- The enterprise problem: copying data creates latency, security vulnerabilities, and stale context. When an agent reasons over data that's 4 hours old, it makes decisions on yesterday's customer.
- The shift: enterprise platforms increasingly use "zero-copy" architectures (Salesforce Data Cloud, Snowflake federation). Agents reason over the live, unified, current customer profile without duplicating data.
- *Our experience:* purveyors.io ingests from 30+ suppliers and the stale-data problem is real. We've built deduplication and freshness tracking because copied data drifts. At enterprise scale with customer records, this is orders of magnitude harder.

**Layer 4: Deterministic Action Execution**
- A prototyped agent can hit APIs or trigger webhooks. That works for demos.
- Enterprise operations require stateful, multi-step workflows: verify warranty status, process refund, log compliance audit, escalate to human. Each step needs to succeed or roll back cleanly.
- Schema awareness: enterprise reasoning engines don't guess API payloads. They have deterministic, native access to the org's exact data schema and objects, with full audit trails.
- The gap between "call this API" and "execute this business process with guaranteed consistency and auditability" is where custom agents break down.
- *Our experience:* Human-in-the-loop patterns, approval gates, confidence thresholds, escalation paths. We design these for every agentic workflow. The discipline is the same at enterprise scale; the stakes are higher.

**Layer 5: Adoption Measurement**
- The adoption trap: high deployment, low usage. Same problem as any enterprise tool rollout.
- Metrics that matter: usage frequency, override rate (how often humans reject the AI's output), time-to-value, confidence distribution.
- Executive dashboards: not "how many agents are deployed?" but "are they actually faster? Are people trusting them?"
- *Our experience:* At Gates, executive dashboards tracked adoption, cycle time, and compliance risk across 45+ plants. The measurement framework is identical for AI tools.

### 3. Why Enterprise Adoption PMs Are the Right Builders (~400 words)
- The pattern recognition: every Layer maps to a pre-AI enterprise challenge
  - Build-vs-buy at scale = vendor evaluation (the Gates 6+ supplier assessment with TCO analysis)
  - Security governance = compliance frameworks (ISO/IATF, data governance)
  - Data architecture = system integration (PLM/ERP/MES, single source of truth)
  - Deterministic execution = process governance (structured workflows, audit trails)
  - Adoption measurement = rollout dashboards
- The AgentForce roundtable insight (ERP Today, Dec 2025): "agents need clear guardrails and standardized processes when they touch money, inventory, or regulated data... no size fits all approach." The practitioner who said this was describing enterprise governance, not AI expertise.
- The mistake: hiring AI researchers to do governance work, or hiring consultants to deploy a platform without adoption infrastructure
- The real skill: designing governance that adapts to heterogeneous environments (sites with different maturity, teams with different technical comfort, departments with different data sensitivity)

### 4. The Platform Is the Easy Part (closer, ~250 words)
- AgentForce, Copilot Studio, custom agents on Vertex AI: interchangeable tools. The AI CoE that survives platform changes is built on governance, not features.
- The "already inside the building" test: when evaluating an AI platform, the technical capabilities matter less than the compliance path. How fast can it get through security review? Does it inherit existing permissions? Can it reason over live data without copying it?
- If you've driven adoption of a unified system across 45+ sites with varying maturity, you know the hard part of an AI CoE. The AI layer just changes what flows through the governance framework.
- Close: The question isn't "which AI platform?" It's "do you have the governance infrastructure to make any AI platform work?" If you don't, no amount of AgentForce or Copilot will save you. If you do, the platform choice is a procurement decision, not a strategic one.

## Verification Checklist
- [ ] Confirm Gartner stat source and accuracy (75% stat from Tredence blog citing Gartner)
- [ ] Confirm MIT Sloan "250% growth" stat (from Nov 2025 article on agentic enterprise)
- [ ] Confirm AgentForce roundtable quotes (ERP Today, Dec 2025)
- [ ] Verify zero-copy architecture claims (Salesforce Data Cloud, Snowflake federation)
- [ ] Review purveyors.io claims against actual implementation (model routing, fallback chains, guardrails, freshness tracking)
- [ ] Review Gates claims against interview playbook (45+ plants, governance framework, dashboards, vendor evaluation)
- [ ] Ensure no over-claiming: keep personal illustrations to one sentence each, transferable framing
- [ ] Check: does the Microsoft Cloud Adoption Framework AI CoE doc add a useful citation?
- [ ] Verify RBAC/FLS claims about AgentForce trust layer (Salesforce documentation)

## Source Stack
1. **Gartner (via Tredence, Sep 2025):** 75%+ of enterprises moving from experimentation to operationalization; most fail without framework
2. **MIT Sloan Management Review (Nov 2025):** "The Emerging Agentic Enterprise" - governance infrastructure before autonomous agents, 250% growth in AI decision-making authority
3. **ERP Today (Dec 2025):** Salesforce AgentForce roundtable - practitioners on guardrails, standardized processes, no-size-fits-all, lead management transformation
4. **Microsoft Cloud Adoption Framework:** "Establish an AI Center of Excellence" - multidisciplinary team, security/governance standards (potential 4th citation)

## Voice Constraints
- First person singular ("I")
- No em-dashes
- No "leverage," "synergy," "spearhead"
- Opinionated: take the position that governance > tooling, enterprise platforms win on compliance not AI
- Keep purveyors.io and Gates as illustrations, not pitches. One sentence each per section, move on.
- HN-frameable: the insight is "enterprise AI platforms win because they're pre-approved, not because they're smarter"
- Dense and technical. This audience understands RBAC, vector DBs, RAG. Don't over-explain.
