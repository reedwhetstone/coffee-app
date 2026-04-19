# Outline: Your API Docs Are Your New Landing Page

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** brain/references/b2cc-agents-as-customers.md, repos/coffee-app/notes/API_notes/API-strategy.md, repos/coffee-app/notes/API_notes/APITIER.md

## Thesis

Companies spend millions on beautiful websites, onboarding flows, and marketing funnels. A growing share of their customers will never see any of it. AI agents evaluate services by reading API documentation and parsing error responses, not by browsing landing pages. The companies that redesign their developer experience for this invisible audience will win the next wave of platform adoption. This isn't speculation; all three major cloud providers launched machine-readable documentation servers in the past year.

## Voice Constraints

- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: the familiar concept (landing page optimization) reframed for an audience nobody's thinking about (AI agents)
- No salesmanship. Purveyors appears once as a brief illustration, not a pitch.
- Data and analysis: concrete examples of what breaks when agents hit your API, real infrastructure moves by Google/AWS/Microsoft
- Every section earns its place. If it doesn't deliver new insight, cut it.

## Verification Checklist

- [ ] Google Developer Knowledge API launch details accurate (Feb 2026, public preview)
- [ ] AWS Knowledge MCP Server status accurate (GA)
- [ ] Microsoft Learn MCP Server status accurate (available)
- [ ] Bezos API Mandate quote accurate ("All teams will henceforth expose their data and functionality through service interfaces")
- [ ] Purveyors API tier structure (200/10k/unlimited) matches actual implementation
- [ ] MCP SDK download numbers verifiable (97M+ monthly cited in sources)

## External References

1. **InfoQ: "Google Brings Its Developer Documentation Into the Age of AI Agents"** (Feb 25, 2026) — All three major cloud providers (AWS, Google, Microsoft) now have official MCP servers for their developer documentation. "The release fits into a broader pattern of MCP adoption across the industry." https://www.infoq.com/news/2026/02/google-documentation-ai-agents/
2. **Caleb John: "B2CC: Claude Code Is Your Customer"** (Jan 21, 2026) — Coined the B2CC framing. "API docs ARE the product now. When an agent evaluates competing services, it's reading docs, not landing pages." https://calebjohn.xyz/blog/b2cc/

## Structure

### The Landing Page Nobody Sees (~300 words)

Open with the irony: the entire discipline of conversion rate optimization assumes a human customer. A/B testing button colors, hero image selection, onboarding wizard flows. Now consider the customer that arrives via API call. It never sees the homepage. It never reads the tagline. It evaluates your service by hitting your endpoints, parsing your error messages, and reading your documentation.

This isn't a thought experiment. Google launched a Developer Knowledge API two days ago specifically so AI agents can query their documentation programmatically. AWS and Microsoft already have equivalent MCP servers. The three biggest platform companies on earth are investing in making their docs machine-readable. Not for human developers. For agents.

Key point: the "landing page" for an agent customer is your API reference. The "onboarding flow" is your auth documentation. The "customer support" is your error responses.

### The Bezos Mandate's Unintended Audience (~350 words)

In 2002, Jeff Bezos issued his famous internal memo: "All teams will henceforth expose their data and functionality through service interfaces." Point 6: "Anyone who doesn't do this will be fired." He was thinking about human developers building on Amazon's platform. That reasoning spawned AWS.

But the actual "external consumer" Bezos was preparing for wasn't a developer reading docs in a browser. It was an AI agent parsing them programmatically. The mandate was architecturally prescient for reasons he didn't anticipate.

Connect to the B2CC thesis (Caleb John): the arc from the Bezos mandate through the API economy to fully autonomous customers who evaluate, integrate, and use your product without human intervention. B2B became B2D (business-to-developer), and now B2D is becoming B2CC (business-to-Claude-Code, or whatever agent your customer is running).

MCP adoption data: 97M+ monthly SDK downloads, backed by Anthropic, OpenAI, Google, Microsoft. This is the infrastructure layer being built for agent-to-service communication.

### Error Messages Are the New UX (~400 words)

This is the meatiest section. When a human hits a bad API, they might Google the error, check Stack Overflow, or contact support. When an agent hits a bad API, it either figures it out from the response or moves to a competitor. There's no patience, no brand loyalty, no sunk cost fallacy.

What agent-hostile APIs look like:

- Cryptic error codes with no context ("Error 1042")
- Undocumented rate limits that return 429 with no retry-after header
- Auth flows that require browser-based OAuth with no service account path
- Inconsistent response schemas between endpoints
- Docs that describe aspirational behavior, not actual behavior

What agent-friendly APIs look like:

- Structured error responses with actionable fix suggestions
- Machine-readable rate limit headers (X-RateLimit-Remaining, Retry-After)
- API key auth with clear "get your key in 30 seconds" flow
- Consistent, typed response schemas with OpenAPI specs
- Docs that are the source of truth, not marketing collateral

The Stripe analogy: Stripe won developers with documentation quality when the customer was a human developer. The next platform-level advantage will come from the same dynamic, but the "developer" is an agent. Whoever builds the Stripe-quality developer experience for agent consumers gets the compounding adoption loop.

### What This Actually Changes (~350 words)

Three structural shifts that follow from agents-as-customers:

**Switching costs collapse.** An agent can evaluate, integrate, and switch to a competitor in minutes. The traditional SaaS moats (workflow lock-in, integration complexity, retraining costs) evaporate. New moats: proprietary data depth, API reliability, and response quality. Brief Purveyors illustration: normalized green coffee data across 14+ suppliers isn't replicable by switching to a competitor API, because the competitor doesn't have the data.

**Per-seat pricing breaks.** One human + an agent replaces a team of five. The agent makes 100x the API calls the human would. Usage-based pricing is the only model that survives this math. Purveyors' tier structure (free/200 calls, pro/10k, enterprise/unlimited) is designed for this: the pricing scales with consumption, not headcount.

**Volume economics explode.** A developer makes 100 API calls a day. That developer with an agent makes 10,000. Agent-to-agent orchestration compounds this further. The APIs that handle this volume reliably, with clear rate limiting and predictable pricing, win by default.

### Building for Invisible Customers (~300 words)

Practical close. What "agent-first" API design looks like today:

1. **"Test with agents first" as QA methodology.** Before launching an endpoint, have an AI agent try to integrate it from docs alone. If the agent can't figure it out, your docs aren't good enough.
2. **Structured, machine-readable documentation.** OpenAPI specs that are accurate (not aspirational). Google's Developer Knowledge API is the template: searchable, retrievable, versioned.
3. **Error responses as coaching.** Every error should tell the caller what went wrong and how to fix it. Agents don't need empathy; they need specificity.
4. **Auth that doesn't require a browser.** Service account paths, API key generation without OAuth dance. The agent can't click through a consent screen.

Close with the parallel to mobile-first circa 2012: the companies that designed for the new form factor first didn't just adapt; they won the decade. The companies designing for agent customers now are making the same bet.
