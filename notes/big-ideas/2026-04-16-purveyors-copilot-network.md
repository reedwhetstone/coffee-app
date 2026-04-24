# Proposal: Purveyors Copilot Network

_Created: 2026-04-16_
_Status: Proposal_

## One-line thesis

Turn Purveyors from a coffee data product into the agent operating layer for coffee buyers and roasters by launching a shared network of decision-grade copilots powered by the same catalog, analytics, CLI, and API surfaces.

## Why this matters

Purveyors already has the hard part: normalized supply data, historical pricing, public analytics, an API-first direction, a CLI, and an explicit product vision centered on machine-readable coffee intelligence. The bigger move is to stop thinking of AI as a convenience interface inside the app and start treating agents as a new customer class and distribution channel. If Purveyors becomes the place where coffee teams and their agents plan buys, monitor markets, compare options, and trigger workflow recommendations, the product stops being a nice catalog and starts looking like category infrastructure.

## Why now

Three things line up now.

First, the internal assets are unusually aligned: coffee-app is tightening its public intelligence funnel, the CLI is becoming a stable machine-readable contract, and the scraper has enough supplier coverage and audit discipline to support higher-trust workflows.

Second, the strategic docs already point in this direction. PRODUCT_VISION explicitly says Purveyors should serve web, CLI, API, and agentic consumers from the same data layer, and should replace navigation with intelligence where possible.

Third, the external market is moving toward multiproduct vertical SaaS and agent-native software. Stripe's 2025 vertical SaaS benchmark reports that multiproduct platforms more than doubled median addressable market from $250M to $513M and grew 21% faster, while platforms offering AI products outpaced the market in growth by 8 percentage points. OpenAI wrote on March 11, 2025 that agents are systems that independently accomplish tasks on behalf of users. That matters here because coffee is exactly the kind of narrow, data-starved vertical where a trustworthy agent can outperform generic copilots.

## Existing assets this leverages

- coffee-app: public catalog, analytics gate, authenticated workflows, conversational UX direction, subscription funnel, docs/public discovery work
- purveyors-cli: machine-readable command surface, shared business logic, auth model, manifest/help contracts, agent-consumable interface
- coffee-scraper: 41 live suppliers, normalization pipeline, historical pricing, arrivals/delistings, supplier health, extraction audit system
- blog / API / data moat / agent workflows: public positioning around coffee intelligence, canonical `/v1/catalog` direction, public analytics as proof layer, API-first architecture, existing belief that agents are first-class consumers

## The concept

Launch a product line called the Purveyors Copilot Network.

This is not one chatbot. It is a shared operating layer of specialized coffee agents built on the Purveyors data substrate. The first version would likely include three tightly-scoped copilots:

1. **Buy Copilot**
   Watches target origins, price bands, processing methods, and supplier changes. Produces ranked buy lists, substitution suggestions, and concise daily or weekly action briefs.

2. **Market Copilot**
   Tracks origin-level price movement, arrivals, delistings, supplier volatility, and unusual inventory shifts. Think procurement brief, but interactive and queryable.

3. **Bench Copilot**
   Connects sourcing context to roast and tasting workflows. Helps answer questions like: what lots resemble coffees that sold well last quarter, what new arrivals fit an existing flavor slot, what coffees look underpriced relative to current market median.

The network effect is the point. Each copilot runs on the same underlying platform primitives:

- canonical catalog and analytics data
- CLI and API actions as the execution layer
- shared memory/workspace per customer
- explainable provenance for why a recommendation was made
- public proof surfaces that show what the system sees before a user pays

The wedge is not "AI for coffee" in the abstract. The wedge is "give a roaster an agent that already understands the supply landscape better than a generic model can, because it sits on normalized live data and can act through a real command surface."

The long-term version is a network model:

- internal team copilots for roasters
- external agent/API access for consultants, brokers, and software partners
- a marketplace of reusable workflows and saved agent playbooks
- paid alerting, briefs, and task execution as productized outputs

## Strategic upside

- Revenue: introduces a higher-value subscription tier or separate agent seat/product line, plus usage-based monetization for alerts, briefs, API calls, and workflow runs
- Growth / funnel: public analytics and blog become proof-of-intelligence surfaces that funnel users into a "see what your copilot would do" conversion path
- Defensibility: combines three moats at once, proprietary normalized coffee data, workflow/action infrastructure via CLI/API, and customer-specific agent memory/playbooks
- Product positioning: upgrades Purveyors from coffee marketplace-plus-tools into the operating system for coffee intelligence and execution

## Why this could be a great idea

It fits the actual trajectory of the product instead of fighting it. The app is already moving toward conversational decision support. The CLI already gives machine-readable actions. The scraper already supplies differentiated data. The public analytics and blog already make the intelligence legible. This proposal turns those separate strengths into one coherent story.

It also creates a real multiproduct expansion path instead of a feature pile. The base data platform stays the foundation, but the monetization layers above it become more valuable: API, alerts, premium analytics, briefs, and agent workflows. The external analogy is not a generic chatbot bolt-on; it is the same pattern seen in strong vertical software, where internal operating intelligence becomes a customer-facing product flywheel.

## Why this could be a terrible idea

It risks jumping one layer too early. If the underlying customer workflow is still only partially coherent, adding agents can disguise product gaps instead of solving them. Coffee buyers may also prefer simple alerts and dashboards to "copilot" framing, making the story more ambitious than the actual buying behavior. There is also a trust risk: one bad recommendation in a thin-margin procurement context can damage credibility faster than a weak dashboard ever would.

## Cheapest proving experiment

Build a narrow "Shadow Copilot" for one job only: weekly buy recommendations for a handful of tracked origins and constraints.

Concretely:

- let a user save a sourcing brief such as "washed Ethiopia and Colombia under $8/lb with fresh arrivals prioritized"
- generate a weekly ranked recommendation brief from existing data
- show provenance for every recommendation: supplier, price context, historical comparison, arrival recency, and why it matched
- deliver it in app first, then optionally by email or exported markdown

This tests the core question: do users want recommendations and prioritization, not just browsing?

## What would need to be true

- The current data quality and freshness must be good enough that recommendations feel trustworthy
- Users must have recurring sourcing or operating decisions worth partially delegating
- Recommendation provenance must be explicit and inspectable, not score-shaped black boxes
- CLI/API actions must remain stable enough to serve as the execution contract for agent workflows
- The initial copilot jobs must solve narrow, high-frequency problems before expanding into generalized chat

## Cross-product implications

- App: shifts the main product narrative toward saved briefs, copilot workspaces, explainable recommendations, and action-oriented dashboards
- CLI: becomes the default action substrate for agent workflows, exports, alerts, and machine-triggered tasks
- Scraper: raises the importance of freshness, availability deltas, provenance, and anomaly detection because bad upstream data directly degrades agent trust
- API / agent layer: becomes a first-class commercial surface, not just developer infrastructure, with usage, entitlements, and auditability becoming product features

## Recommendation

Explore it further.

Not as a full platform pivot today, but as the north-star packaging for several assets that are already being built. The first step should be a constrained Shadow Copilot experiment, because that is cheap, strategically coherent, and strong enough to reveal whether Purveyors can move from intelligence-as-data to intelligence-that-acts.
