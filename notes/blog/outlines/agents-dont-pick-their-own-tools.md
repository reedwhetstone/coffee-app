# Outline: Agents Don't Pick Their Own Tools

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** brain/references/b2cc-agents-as-customers.md, repos/coffee-app/notes/API_notes/API-strategy.md, repos/coffee-app/notes/API_notes/APITIER.md

## Thesis

The B2CC narrative says agents are your next customers and API quality is the new competitive moat. The premise is seductive: agents evaluate docs, test endpoints, and pick the best service with zero switching costs. But agents don't actually choose their own tools. Humans install them, configure them, and approve them. The real competitive surface in an agentic world isn't agent discovery; it's the human allowlist. And the governance data suggests that allowlist is getting stricter, not looser.

## Voice Constraints
- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: take the B2CC consensus ("optimize for agents!") and invert it. The counterintuitive insight is that agentic adoption makes traditional B2B dynamics harder, not irrelevant.
- No salesmanship. Purveyors appears once as a brief illustration of the dual-gate problem.
- Data and analysis: Torii 2026 numbers, principal-agent framework, concrete MCP/tool configuration examples.
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist
- [ ] Torii 2026 stats: average enterprise runs 830 apps, 61.3% shadow IT, only 15.5% formally sanctioned
- [ ] Torii: 700+ new AI applications entered enterprise environments in one year
- [ ] Torii: large enterprises average 2,191 applications
- [ ] MCP tool configuration is human-controlled (verify Claude Desktop config, Cursor settings, etc. require manual server setup)
- [ ] Caleb John B2CC article accurately quoted (agents read docs, switching costs collapse)
- [ ] Stocker & Lehr "shadow principals" concept accurately represented

## External References

1. **Torii 2026 SaaS Benchmark Report** (Feb 24, 2026) — "AI Isn't Consolidating SaaS; It's Expanding Shadow IT." Average enterprise runs 830+ apps, 61.3% are shadow IT, only 15.5% formally sanctioned. 700+ new AI applications entered enterprise environments in one year. Key quote from CPO Uri Nativ: "Applications, especially AI tools, are being adopted faster than traditional procurement and identity controls were designed to handle." https://www.globenewswire.com/news-release/2026/02/24/3243646/0/en/Torii-2026-Benchmark-Report-AI-Isn-t-Consolidating-SaaS-It-s-Expanding-Shadow-IT.html

2. **Stocker & Lehr, "Principal-Agent Dynamics and Digital (Platform) Economics in the Age of Agentic AI"** (Oct 2025, Network Law Review) — Applies principal-agent framework to AI systems. Introduces "shadow principals": agents may reflect objectives of developers, platform providers, or advertisers rather than end-users. "These shadow principals create persistent information asymmetries and reduce user control." Key insight: the agent's principal is ambiguous, which is exactly why human allowlisting becomes the control mechanism. https://www.networklawreview.org/stocker-lehr-ai/

3. **Caleb John, "B2CC: Claude Code Is Your Customer"** (Jan 21, 2026) — The article this post directly engages with. "API docs ARE the product now. When an agent evaluates competing services, it's reading docs, not landing pages." Frames agents as pure utility-maximizers where best docs win. The tension John himself acknowledges: "agent decisions are still shaped by the humans configuring them. Brand, trust, and community still matter because the human decides which tools the agent is allowed to use." https://calebjohn.xyz/blog/b2cc/

## Structure

### The B2CC Promise (~300 words)
Open with the B2CC framing at its most compelling. Caleb John's thesis: agents are the new end users, API docs are the new primary UI, switching costs collapse to near zero. An agent can evaluate, integrate, and switch services in minutes. Per-seat pricing dies. Volume economics explode. The Bezos API Mandate arrives at its final destination: fully autonomous customers.

This isn't fringe. Google, AWS, and Microsoft all launched MCP documentation servers in late 2025 and early 2026. They're designing their docs to be machine-readable because they expect agent consumers. The infrastructure investment is real.

The B2CC argument has one critical assumption baked in: that the agent is the decision-maker. That the agent discovers Stripe, evaluates its docs, compares it to Square, and picks Stripe because Stripe's error messages are better. This assumption is wrong.

### The Allowlist Layer (~400 words)
Walk through what actually happens when an agent "picks" a tool. Take Claude Desktop: the user manually edits a JSON config file to add MCP servers. Take Cursor: the user installs extensions and configures API keys. Take an enterprise coding agent: IT provisions a set of approved integrations.

In every case, a human made the selection before the agent touched anything. The agent operates within a sandbox of pre-approved tools. It can choose between tools on its allowlist, but it cannot expand the allowlist itself.

This isn't a temporary limitation that better tool discovery will solve. It's a feature. The Torii data shows why: 61.3% of enterprise applications are already shadow IT. Only 15.5% are formally sanctioned. 700 new AI applications entered enterprise environments in a single year. The governance response isn't "let agents pick freely." It's stricter allowlists, faster detection, and more aggressive procurement gates.

The MCP tool discovery conversation (TrueFoundry, various Medium posts) assumes discovery leads to adoption. But enterprise reality is the opposite: discovery triggers governance review. Finding an unapproved tool in an agent's config is exactly what shadow AI detection platforms are built to catch.

Key insight: the agent doesn't replace the procurement decision. It adds a second evaluation layer on top of it. Your API now needs to pass two gates: (1) a human decides to install/approve it, and (2) the agent effectively uses it. B2CC doesn't simplify your go-to-market. It doubles the number of surfaces you need to win.

### Who Is the Agent's Principal? (~350 words)
This section grounds the intuition in economic theory. Stocker and Lehr's principal-agent framework for AI asks: whose interests does the agent actually serve?

The B2CC narrative assumes the agent is a pure utility-maximizer for its user. But Stocker and Lehr identify "shadow principals": the agent's developer, the platform provider, the model vendor. Each has their own optimization function. When Claude recommends a tool, is it because that tool has the best API, or because Anthropic has a partnership? When an enterprise agent routes to a specific vendor, is it maximizing for the developer or for the IT team that configured the approved vendor list?

This ambiguity is precisely why human allowlisting persists. The human doesn't fully trust the agent's selection criteria because they can't verify what the agent is optimizing for. The information asymmetry runs both directions: the agent can't observe the full vendor landscape, and the human can't observe the agent's decision weights.

Traditional procurement exists because principals can't fully monitor agents. Software procurement committees, security reviews, vendor assessments: these are all mechanisms to handle the principal-agent problem when the "agent" was a human employee picking tools. Replacing the human employee with an AI agent doesn't dissolve the principal-agent problem. It deepens it, because AI agents are even harder to monitor than human ones.

### What Actually Wins (~350 words)
If agents don't pick their own tools, what does the competitive landscape actually look like?

**Getting on the allowlist is a B2B sale, not a B2CC one.** The buyer is a human (developer, IT admin, procurement officer) evaluating trust, compliance, pricing, and reputation. Brand matters. Case studies matter. SOC 2 matters. These are the unglamorous dynamics that the B2CC framing dismisses as legacy overhead.

**API quality is table stakes, not a moat.** Good docs, structured errors, reliable uptime: these are necessary conditions. But they don't win the allowlist decision. They prevent disqualification. The moat is what makes you un-substitutable once you're on the list: proprietary data depth that no competitor can replicate by scraping or aggregating.

**The allowlist is stickier than B2CC predicts.** Once a tool is approved, integrated, configured with API keys, and wired into workflows, removing it has real costs. Not the old-world costs of retraining and migration, but new costs: updating agent configs across teams, re-validating workflows, re-testing edge cases. Switching costs didn't collapse; they shifted from user-facing to infrastructure.

Brief Purveyors illustration (one sentence): purveyors' normalized green coffee data from 27+ suppliers is a proprietary dataset that can't be replicated by switching to another API, which is why it survives the allowlist test even in a world of near-zero agent switching costs.

### The Doubled Surface (~300 words)
Close with the practical implication. The B2CC thesis isn't wrong about agent evaluation mattering. It's wrong about agent evaluation replacing human evaluation. Both happen. The API strategy that works is one designed for two audiences simultaneously:

1. **For the human gatekeeper:** Trust signals, compliance documentation, predictable pricing, clear value proposition. This is marketing and sales. The API landing page still matters because a human still visits it first.

2. **For the agent consumer:** Structured docs, machine-readable schemas, clear error responses, fast auth. This is developer experience. The B2CC playbook is right here; it just isn't the whole picture.

The companies that win the next wave aren't the ones optimizing exclusively for agents (B2CC) or exclusively for humans (traditional B2B). They're the ones who recognize that agentic adoption created a dual-gate funnel: human approval, then agent execution. Skip either gate and you lose.

The irony of B2CC is that it promises a world where the best API wins automatically. What it actually delivers is a world where you need to win two competitions instead of one.
