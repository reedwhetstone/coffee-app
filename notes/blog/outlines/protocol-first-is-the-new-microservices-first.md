# Outline: Protocol-First Is the New Microservices-First

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-app/notes/archive/MCP-FIRST-ARCHITECTURE.md, repos/coffee-app/notes/archive/MCP-SERVER-PROPOSAL.md, repos/coffee-app/notes/API_notes/API-strategy.md

## Thesis

Every protocol hype cycle produces the same architecture mistake: teams optimize for the protocol's ideal consumer instead of their product's actual consumer. MCP is designed for AI agents talking to tools. If your product's primary interface is a web app, going "MCP-first" means building your entire data layer for the wrong audience. We evaluated a full MCP-first architecture for a data-heavy product and found five concrete ways it made things worse before arriving at the approach that actually works.

## Voice Constraints
- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: the microservices parallel is the creative lens. "We've seen this movie before" energy.
- No salesmanship. Purveyors appears once, briefly, as a concrete example of the evaluation. The lessons are fully transferable.
- Data and analysis: specific technical tradeoffs (caching, bundle size, serialization overhead, security model), not vibes.
- Every section earns its place. No "what is MCP?" primer beyond one sentence.
- 1-2 research citations reinforcing specific claims.

## Verification Checklist
- [ ] MCP server count accurate (16K+ on mcp.so, 12K+ on mcpmarket.com as of Feb 2026)
- [ ] MCP SDK monthly download number accurate (97M+ cited in MCP-SERVER-PROPOSAL.md)
- [ ] MCP content response format correct (returns `{ content: [{ type: 'text', text: '...' }] }` not structured JSON)
- [ ] MCP transport is JSON-RPC 2.0 over stdio/SSE/HTTP streaming (verify against MCP spec)
- [ ] Confirm MCP is session-based/stateful vs REST stateless (key architecture difference)
- [ ] Microservices backlash timeline roughly accurate (2015 peak hype, 2018-2020 "monolith-first" counter-movement)
- [ ] Verify that MCP client SDK adds meaningful bundle size (~50KB+ gzipped estimate in source material)

## External References

1. **Equixly: "How MCP Servers Challenge Traditional API Security Models"** (Feb 12, 2026) — Key quote: "Critics see MCP as a shim; an additional layer on top of REST APIs that adds latency and maintenance without offering unique functionality." Also documents reasoning degradation from context window bloat when connecting multiple MCP servers. Validates the "wrong consumer" thesis from the security angle: MCP assumes a trusted client (AI assistant with user oversight), not an untrusted browser. https://equixly.com/blog/2026/02/12/how-mcp-servers-challenge-traditional-api-security-models/

2. **Scalekit: "Should You Build MCPs Before APIs?"** (Feb 2026) — Useful counterpoint showing when MCP-first IS correct (AI-native apps, workflow automation, enterprise integration hubs). The key distinction: MCP-first makes sense when AI agents are your primary consumer. It breaks when humans using a web browser are. Also reports 16K+ MCP servers indexed on mcp.so. https://www.scalekit.com/blog/should-you-build-mcps-before-apis

## Structure

### The Familiar Pattern (~300 words)
Open with the microservices parallel. In 2015, Netflix published their microservices architecture. Within two years, three-person startups were running Kubernetes clusters to serve a to-do app. The tool was right for Netflix. It was wrong for everyone who copied Netflix without Netflix's problems.

The pattern repeats: a protocol solves a real problem at massive scale, gets adopted by the companies that need it, then gets cargo-culted by everyone else. The cost is always the same: unnecessary complexity where simplicity would have shipped faster and more reliably.

MCP (Model Context Protocol) is the 2025-2026 iteration. Backed by Anthropic, adopted by OpenAI, Google, and Microsoft. Over 16,000 public MCP servers indexed. 97M+ monthly SDK downloads. The protocol is real. The problem it solves is real. But "MCP-first" product architecture is repeating the microservices mistake: choosing the tool before understanding the problem.

The microservices correction took years. The "monolith-first" counter-movement (Sam Newman, Martin Fowler) didn't emerge until the damage was done. This is the MCP version of that correction, but earlier.

### What MCP Actually Solves (~250 words)
Give MCP its due. Before MCP, connecting an AI assistant to external tools required bespoke integrations. N models times N data sources equals N-squared connectors. Custom auth, custom error handling, custom schemas per integration. MCP standardizes this: expose tools once, any MCP-compatible client can use them.

This is genuinely valuable when your consumer is an AI agent. Claude Desktop can browse a coffee catalog, query inventory, log roasts, all through one standardized protocol. The agent discovers tools at runtime, understands their schemas, and chains them together without custom code.

The problem starts when teams extrapolate from "MCP is great for AI agents" to "MCP should be our primary data layer." That's the leap from "microservices work at Netflix" to "microservices should be how we build everything."

### Five Ways MCP-First Breaks a Web Product (~500 words)
This is the meat. Drawn from an actual architecture evaluation (not hypothetical). Each point is concrete and technical.

**1. The shape mismatch.** MCP returns `{ content: [{ type: 'text', text: '...' }] }`. REST returns `[{ id: 1, name: "Ethiopia Guji", price: 7.50 }]`. MCP's response format is designed for LLM context windows, not UI components. Every tool call requires an extra parse-and-extract step that provides zero value for browser rendering. You're using a translation API to talk to someone who already speaks your language.

**2. Stateful sessions kill web caching.** MCP is session-based. REST is stateless. This isn't a minor implementation detail; it determines your entire caching strategy. A REST catalog endpoint can sit behind a CDN, serve 10,000 users from a single cache hit, and use ETags for conditional requests. An MCP tool call is a dynamic session interaction. 10,000 users loading your catalog means 10,000 MCP sessions instead of one CDN hit. The performance math doesn't work.

**3. Client-side bloat.** MCP requires a client SDK in the browser: protocol handshake, capability negotiation, persistent SSE connection, reconnection handling. Estimate: ~50KB+ gzipped. The alternative: `fetch()`, which is free, native, and already in every browser. You're shipping kilobytes of protocol plumbing to accomplish what the browser does natively.

**4. Wrong security model.** MCP servers expose tools designed for AI agents: `search_coffees`, `update_inventory`, `execute_query`. The protocol assumes a trusted client (an AI assistant with human oversight). Exposing an MCP server to an untrusted browser effectively gives every user a command-line interface to your backend. Building a proxy layer to strip sensitive tools means you've reinvented a bad REST API with extra steps.

**5. Debugging goes dark.** REST calls show up in the browser's Network tab: URL, status code, response JSON, timing. MCP interactions flow through SSE connections as opaque frames. "Where did it fail? Which tool? What was the context?" becomes a question instead of a glance. Your team's debugging productivity drops measurably.

### The One-Question Architecture Test (~350 words)
Every protocol decision reduces to one question: **Who is consuming this interface?**

If the consumer is an LLM context window → MCP. The protocol was designed for exactly this. Tool discovery, structured responses for reasoning, session context.

If the consumer is a browser or mobile app → REST (or GraphQL, or tRPC, or whatever your team already knows). These protocols were designed for exactly this. Stateless, cacheable, native browser support, transparent debugging.

If both → build both, with a shared service layer underneath. The service layer contains your business logic once. REST endpoints and MCP tools are thin wrappers that format responses for their respective consumers.

This is the architecture we landed on after the MCP-first evaluation. The web app hits REST/Supabase for everything. The MCP server exists exclusively for AI clients (Claude Desktop, partner agents, future third-party integrations). Both call the same service layer. Zero duplication of business logic.

The insight seems obvious in retrospect. But the hype cycle makes the obvious answer feel risky, like you're "not AI-first enough." The same gravity pulled teams toward microservices in 2015, GraphQL in 2018, and serverless-everything in 2020. The pattern is always the same: the correct architecture for most products is less interesting than the trending one.

### The Exception That Proves the Rule (~300 words)
There is one context where MCP in a web product makes perfect sense: Generative UI. When the user types "show me my Ethiopian coffees sorted by roast date" and the LLM generates a UI component in response, MCP is the right data layer. Why? Because the consumer of the data is the LLM (on your server), not the browser. The LLM calls MCP tools, gets text-formatted responses it can reason over, generates a component specification, and the browser renders the pre-built component.

This is MCP used correctly: the LLM intermediates between the data and the user. The browser never touches MCP directly. The protocol's strengths (tool discovery, rich descriptions, context-friendly responses) serve the actual consumer.

The takeaway: the question isn't "MCP or REST." It's "who is consuming this interface, right now, in this specific data flow?" When the answer changes (LLM for GenUI, browser for static pages), the protocol should change with it. Consumer-first architecture, not protocol-first.
