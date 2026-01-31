# MCP Server Proposal for Purveyors.io

## Executive Summary

This document explores the business case for building a Model Context Protocol (MCP) server for purveyors.io. MCP is Anthropic's open standard (now under the Linux Foundation) for connecting AI assistants to external data sources and tools. With 97M+ monthly SDK downloads and adoption by Anthropic, OpenAI, Google, and Microsoft, MCP has become the universal standard for AI-to-enterprise connectivity.

**Key Finding**: There are currently **no MCP servers in the specialty coffee industry**. This represents a first-mover opportunity in a $100B+ global specialty coffee market increasingly adopting AI tools.

---

## What is MCP?

The Model Context Protocol enables AI assistants (Claude, GPT, Copilot, etc.) to:

1. **Query external data sources** - Real-time access to databases, APIs, and services
2. **Execute actions** - Perform operations on behalf of users (CRUD, calculations, integrations)
3. **Maintain context** - Persistent understanding of domain-specific data and relationships
4. **Use specialized tools** - Custom functions tailored to specific workflows

**Technical Architecture**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Assistant  │────▶│   MCP Server    │────▶│  Purveyors.io   │
│ (Claude/GPT/etc)│◀────│ (Your Service)  │◀────│   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Competitive Landscape Analysis

### MCP Ecosystem (2026)

| Category            | Notable MCP Servers          | Gap Analysis                 |
| ------------------- | ---------------------------- | ---------------------------- |
| **Databases**       | Supabase, Postgres, Pinecone | Generic, not domain-specific |
| **Enterprise**      | Salesforce, Notion, Slack    | No vertical industry focus   |
| **E-commerce**      | Shopify, Stripe              | No specialty food/beverage   |
| **Food & Beverage** | **NONE**                     | **Wide open opportunity**    |
| **Coffee Industry** | **NONE**                     | **First-mover advantage**    |

### Coffee Software Landscape

| Platform             | AI Integration | MCP Server      | Gap                                  |
| -------------------- | -------------- | --------------- | ------------------------------------ |
| **Cropster**         | Limited        | No              | Enterprise roasting, no AI discovery |
| **Artisan**          | None           | No              | Open-source, desktop-only            |
| **RoastPATH**        | None           | No              | Mill City ecosystem only             |
| **DiFluid CoffeeOS** | Emerging       | No              | Hardware-focused                     |
| **Purveyors.io**     | Full RAG/Chat  | **Opportunity** | AI-native platform                   |

**Key Insight**: Cropster has an API but no MCP server. Their Ruby client (by Blue Bottle Coffee) shows enterprise demand for coffee data integration. Purveyors.io can leapfrog by offering AI-native connectivity.

---

## Ideal Customer Profiles (ICPs)

### ICP 1: AI-Native Individual Roasters

**Profile**: Home roasters and micro-roasters using Claude Desktop, Cursor, or similar AI tools in their daily workflow.

**Use Case**:

```
User in Claude Desktop: "What Ethiopian naturals do I have in inventory
that would pair well with the Guatemalan I roasted last week?
Show me flavor profile overlap."
```

**Value Proposition**:

- Query personal inventory and roast history via natural language
- Get AI-powered roast recommendations based on their data
- Track costs and profits without switching apps

**Pros**:
| Advantage | Detail |
|-----------|--------|
| Low friction adoption | Already using AI tools |
| Word-of-mouth potential | Coffee enthusiasts are vocal community |
| Validates product-market fit | Direct user feedback |
| Builds ecosystem | Creates power users who evangelize |

**Cons**:
| Challenge | Mitigation |
|-----------|------------|
| Low willingness to pay | Freemium model, upgrade to member tier |
| Support burden | Self-service documentation |
| Limited revenue per user | Volume play, conversion funnel |

**Pricing Model**: Free tier (catalog only) → Member tier ($9/mo for personal data access)

---

### ICP 2: Coffee Tech Developers & Startups

**Profile**: Developers building coffee-related applications, recommendation engines, or e-commerce integrations.

**Use Case**:

```
Developer building coffee subscription app: Uses MCP server to power
their AI chatbot with real-time coffee catalog, availability,
and flavor matching without building their own data pipeline.
```

**Value Proposition**:

- Normalized, enriched coffee data (500+ coffees, embeddings, tasting notes)
- Semantic search capabilities out-of-the-box
- No need to build/maintain coffee domain expertise

**Pros**:
| Advantage | Detail |
|-----------|--------|
| High-value B2B revenue | API tiers already defined ($99-$1500+/mo) |
| Sticky integration | Once embedded, hard to switch |
| Network effects | More apps = more visibility |
| Reference customers | Developer success stories |

**Cons**:
| Challenge | Mitigation |
|-----------|------------|
| Longer sales cycle | Self-service onboarding |
| Support complexity | SDK + documentation investment |
| Competition from generic APIs | Domain expertise moat |

**Pricing Model**: API tiers (Explorer $0/200 calls → Roaster+ $99/10k calls → Integrate $1500+/unlimited)

---

### ICP 3: Commercial Roasting Operations (Teams)

**Profile**: Mid-size roasters (5-50 employees) wanting AI-powered insights across their team.

**Use Case**:

```
Production Manager: "Show me all roasts from this week where development
time exceeded 20% and compare to our quality scores.
Flag any batches needing QC review."

Sales Lead: "What's our profit margin on Ethiopian coffees this quarter?
Which customers have the highest reorder rate?"
```

**Value Proposition**:

- Team-wide AI assistant for operations, QC, and sales
- Natural language access to business intelligence
- Integration with existing workflows (Artisan, POS, ERP)

**Pros**:
| Advantage | Detail |
|-----------|--------|
| Higher contract values | $500-2000+/mo potential |
| Enterprise credibility | Case studies for sales |
| Product roadmap input | Direct feature requests |
| Lower churn | Embedded in operations |

**Cons**:
| Challenge | Mitigation |
|-----------|------------|
| Complex auth requirements | Teams/RBAC implementation |
| Custom integration needs | Professional services revenue |
| Longer implementation | White-glove onboarding |
| Security/compliance | SOC2, data isolation |

**Pricing Model**: Enterprise tier (custom pricing based on seats + usage)

---

### ICP 4: Coffee Industry Platforms (B2B2C)

**Profile**: Green coffee importers, roaster equipment manufacturers, coffee education platforms wanting to embed AI capabilities.

**Use Case**:

```
Green Coffee Importer: Embeds Purveyors MCP into their customer portal.
Roaster customers can ask: "What coffees arriving next month would
complement my current inventory and price point?"

Equipment Manufacturer: Integrates with their roaster software to
provide AI-powered roast recommendations based on machine capabilities.
```

**Value Proposition**:

- White-label AI intelligence for their platforms
- Differentiation from competitors
- Reduced development costs

**Pros**:
| Advantage | Detail |
|-----------|--------|
| Highest revenue potential | $5000-50000+/mo deals |
| Market expansion | Reach their customer base |
| Strategic partnerships | Industry positioning |
| Data network effects | More sources = better data |

**Cons**:
| Challenge | Mitigation |
|-----------|------------|
| Very long sales cycles | Start with smaller deals |
| Custom requirements | SOW-based pricing |
| Dependency risk | Multi-customer diversification |
| IP/data concerns | Clear data ownership terms |

**Pricing Model**: Custom enterprise licensing + revenue share

---

### ICP 5: AI Agent Builders & Automation Platforms

**Profile**: Users of automation platforms (Zapier, Make, n8n) or building custom AI agents who need coffee domain expertise.

**Use Case**:

```
Automation: When a new coffee is added to inventory, AI analyzes flavor
profile, suggests optimal roast parameters based on similar coffees,
and drafts product description for the website.

Agent Builder: Creates a "Coffee Buyer Agent" that monitors prices,
availability, and automatically recommends purchases based on
inventory levels and sales velocity.
```

**Value Proposition**:

- Domain-specific tools for coffee workflows
- Pre-built prompts and resources for coffee operations
- Integration with existing automation stacks

**Pros**:
| Advantage | Detail |
|-----------|--------|
| Growing market | AI agent tooling exploding |
| Multiplier effect | One integration, many users |
| Low-touch revenue | Self-service platform |
| Innovation showcase | Cutting-edge use cases |

**Cons**:
| Challenge | Mitigation |
|-----------|------------|
| Nascent market | Early positioning advantage |
| Platform dependency | Multi-platform support |
| Pricing complexity | Usage-based model |

**Pricing Model**: Usage-based (per-tool-call or monthly active agent)

---

## Authentication & Data Exposure Architecture

### Option A: Public Catalog Only (No Auth Required)

**Scope**: Coffee catalog, general coffee information, semantic search

**Architecture**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Any AI Tool   │────▶│   MCP Server    │────▶│ coffee_catalog  │
│                 │     │   (Public)      │     │ (public data)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**MCP Tools Exposed**:

- `search_coffees` - Semantic and filtered search
- `get_coffee_details` - Full coffee information
- `get_regions` - Browse by origin
- `get_processing_methods` - Filter by process
- `recommend_coffees` - AI-powered recommendations

**Pros**: Zero friction, viral potential, builds awareness
**Cons**: No monetization, limited utility, data scraping risk

**Use Case**: Developer exploration, free tier users, marketing

---

### Option B: Individual User Auth (OAuth/API Key)

**Scope**: Personal inventory, roast profiles, sales data

**Architecture**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│   MCP Server    │────▶│  User's Data    │
│  (User's token) │     │ (OAuth 2.0)     │     │  (isolated)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         └──── Supabase Auth ────┘
```

**MCP Tools Exposed** (in addition to public):

- `get_my_inventory` - Personal green coffee stock
- `get_my_roasts` - Roasting history and profiles
- `get_my_sales` - Sales and profit data
- `add_to_inventory` - Create inventory entries
- `log_roast` - Record new roasts
- `analyze_profitability` - Financial insights

**Auth Flow**:

1. User initiates MCP connection in AI tool
2. Redirected to Purveyors.io OAuth consent screen
3. User approves scopes (inventory, roasts, sales)
4. MCP server receives access token
5. All queries scoped to user's data

**Pros**: Direct value prop, clear upgrade path, data safety
**Cons**: Setup friction, requires user accounts

**Use Case**: Member tier users, power users, serious roasters

---

### Option C: Team/Organization Auth (Multi-Tenant)

**Scope**: Shared team data, role-based access, audit logging

**Architecture**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Team Member's  │────▶│   MCP Server    │────▶│  Org's Data     │
│  AI Assistant   │     │ (SSO/SAML)      │     │  (RBAC)         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         └──── Enterprise IdP ───┘
              (Okta, Azure AD)
```

**Additional MCP Tools**:

- `get_team_inventory` - Shared inventory view
- `get_team_roasts` - All team roasting activity
- `get_team_performance` - Aggregated metrics
- `assign_task` - Workflow automation
- `generate_report` - Team analytics

**RBAC Scopes**:
| Role | Inventory | Roasts | Sales | Admin |
|------|-----------|--------|-------|-------|
| Viewer | Read | Read | - | - |
| Roaster | Read/Write | Read/Write | - | - |
| Manager | Read/Write | Read/Write | Read | - |
| Admin | Full | Full | Full | Full |

**Enterprise Features**:

- SSO integration (SAML, OIDC)
- Audit logging for compliance
- Data isolation between organizations
- Custom tool permissions per role
- Usage analytics and billing

**Pros**: Enterprise revenue, sticky contracts, competitive moat
**Cons**: Complex implementation, sales cycle, support burden

**Use Case**: Commercial roasters, multi-location operations

---

### Option D: Headless/Embedded (B2B2C)

**Scope**: White-label MCP for partners to embed

**Architecture**:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Partner's App  │────▶│   MCP Gateway   │────▶│  Purveyors +    │
│  (their users)  │     │ (Partner Auth)  │     │  Partner Data   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         └── Partner API Key ────┘
              + User Context
```

**Deployment Options**:

1. **Hosted**: Partner uses Purveyors MCP endpoint with their API key
2. **Proxy**: Partner runs MCP proxy, we provide backend
3. **Licensed**: Partner self-hosts with our SDK

**Data Isolation**:

- Partner's customers only see partner-approved data
- Can blend Purveyors catalog with partner's proprietary coffees
- Usage attributed to partner account

**Pros**: Highest revenue, market expansion, strategic value
**Cons**: Custom development, contract complexity, support SLAs

**Use Case**: Importers, equipment manufacturers, coffee platforms

---

### Recommended Auth Strategy

**Phase 1** (MVP): Options A + B

- Public catalog access (viral growth)
- Individual OAuth for members (conversion)

**Phase 2** (Growth): Add Option C

- Team features for commercial accounts
- Enterprise SSO integrations

**Phase 3** (Scale): Add Option D

- Partner/embedded offerings
- White-label capabilities

---

## Business Case Analysis

### Revenue Projections

| Segment                  | Year 1      | Year 2       | Year 3       |
| ------------------------ | ----------- | ------------ | ------------ |
| Individual (ICP 1)       | $5,000      | $25,000      | $75,000      |
| Developers (ICP 2)       | $15,000     | $60,000      | $150,000     |
| Commercial Teams (ICP 3) | $10,000     | $80,000      | $250,000     |
| B2B Platforms (ICP 4)    | $0          | $50,000      | $200,000     |
| Agent Builders (ICP 5)   | $2,000      | $20,000      | $100,000     |
| **Total**                | **$32,000** | **$235,000** | **$775,000** |

_Assumptions: Conservative adoption rates based on existing user base and market research_

### Cost Analysis

| Category                 | One-time           | Monthly          |
| ------------------------ | ------------------ | ---------------- |
| MCP Server Development   | $15,000-25,000     | -                |
| Auth Infrastructure      | $5,000-10,000      | $200-500         |
| Documentation & DevRel   | $3,000-5,000       | $500-1000        |
| Hosting & Infrastructure | -                  | $100-500         |
| Support & Maintenance    | -                  | $500-2000        |
| **Total**                | **$23,000-40,000** | **$1,300-4,000** |

### ROI Timeline

- **Break-even**: Month 8-14 (depending on enterprise deals)
- **Payback period**: 12-18 months
- **3-year ROI**: 500-1500%

---

## Cool Factor Analysis

### Why This Matters Beyond Revenue

1. **First-Mover in Vertical AI**
   - No coffee MCP servers exist
   - Defines the standard for food/beverage AI integration
   - Press/conference speaking opportunities

2. **AI-Native Brand Positioning**
   - Purveyors becomes "the AI-powered coffee platform"
   - Attracts tech-forward customers
   - Differentiates from Cropster/Artisan

3. **Ecosystem Creation**
   - Third-party developers build on your platform
   - Network effects compound value
   - Potential acquisition interest

4. **Technical Innovation Showcase**
   - RAG + MCP combination is cutting-edge
   - Demonstrates full-stack AI capability
   - Attracts engineering talent

### Viral Potential

```
Coffee enthusiast discovers they can ask Claude:
"What's the best coffee under $7/lb with notes similar to
my favorite Yirgacheffe but from a different region?"

→ Shares on Reddit/Twitter
→ Coffee community amplification
→ Developer interest
→ More MCP tools built
→ Ecosystem growth
```

---

## Resume/Portfolio Case

### For Founders/Builders

**Narrative**: "Built the first MCP server for the specialty coffee industry, establishing Purveyors.io as the AI-native platform in a $100B market"

**Demonstrable Skills**:

- AI/ML integration (RAG, embeddings, LLM orchestration)
- Protocol implementation (MCP specification compliance)
- B2B SaaS (multi-tenant auth, enterprise features)
- Developer relations (SDK, documentation, community)
- Market creation (first-mover strategy, vertical SaaS)

### For Engineering Team

**Technical Portfolio Items**:

- MCP server implementation (TypeScript/Node.js)
- OAuth 2.0 / OIDC integration
- Multi-tenant data isolation
- Real-time AI tool execution
- Enterprise SSO (SAML, Okta, Azure AD)

### Industry Recognition Potential

- **Conference Talks**: "Building Vertical AI: MCP in Specialty Coffee"
- **Case Study**: Anthropic/OpenAI partner showcases
- **Press Coverage**: "How AI is Transforming Coffee Roasting"
- **Open Source**: Reference implementation for food/beverage MCP

---

## Implementation Summary

### MVP Scope (Phase 1)

**Timeline**: 4-6 weeks

**Components**:

1. MCP server core (TypeScript, official SDK)
2. Public tools (catalog search, coffee details, recommendations)
3. OAuth integration (Supabase Auth)
4. Private tools (inventory, roasts, basic analytics)
5. Documentation site
6. Claude Desktop testing

**MCP Tools (MVP)**:

| Tool                 | Scope  | Description                  |
| -------------------- | ------ | ---------------------------- |
| `search_coffees`     | Public | Semantic + filtered search   |
| `get_coffee`         | Public | Full coffee details          |
| `recommend_similar`  | Public | AI-powered recommendations   |
| `get_my_inventory`   | Auth   | User's green coffee stock    |
| `get_my_roasts`      | Auth   | User's roast history         |
| `analyze_roast`      | Auth   | AI analysis of roast profile |
| `get_profit_summary` | Auth   | Financial overview           |

### Growth Scope (Phase 2)

**Timeline**: 6-8 weeks additional

**Components**:

1. Team/organization support
2. RBAC implementation
3. Audit logging
4. Enterprise SSO
5. Advanced analytics tools
6. Webhook/notification tools

### Scale Scope (Phase 3)

**Timeline**: 8-12 weeks additional

**Components**:

1. Partner/embedded SDK
2. White-label configuration
3. Usage-based billing integration
4. Custom tool builder
5. MCP marketplace listing

---

## Recommendation

### Go Decision: **YES - Proceed with MVP**

**Rationale**:

1. **Zero competition** in coffee/food vertical
2. **Existing AI infrastructure** (RAG, embeddings) reduces development cost
3. **Clear monetization** aligned with existing API tiers
4. **Strategic positioning** as AI-native platform
5. **Manageable risk** - MVP scope is well-defined

### Suggested Approach

1. **Start with ICP 1+2** (individuals + developers)
   - Fastest path to market validation
   - Lower support burden
   - Clear upgrade funnel

2. **Build public + individual auth** (Options A+B)
   - Maximum reach with public tools
   - Revenue potential with auth'd features

3. **Document extensively**
   - Developer experience is key differentiator
   - Self-service reduces support cost

4. **Iterate based on usage**
   - Let demand guide enterprise features
   - Don't over-build before validation

### Next Steps

1. [ ] Finalize tool list and scope
2. [ ] Design auth flow UX
3. [ ] Set up MCP development environment
4. [ ] Build MVP (4-6 weeks)
5. [ ] Beta test with power users
6. [ ] Launch publicly
7. [ ] Gather feedback, iterate

---

## Sources

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [2026: Enterprise-Ready MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption)
- [OAuth for MCP - Enterprise Patterns](https://blog.gitguardian.com/oauth-for-mcp-emerging-enterprise-patterns-for-agent-authorization/)
- [MCP Authorization Specification](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [SSO-backed MCP Authentication Guide](https://www.scalekit.com/blog/sso-backed-mcp-authentication-for-enterprise-engineering-teams)
- [Cropster API Documentation](https://developers.cropster.com/api-docs)
- [AI & Specialty Coffee](https://intelligence.coffee/2025/11/ai-and-specialty-coffee/)
- [Top MCP Servers 2026](https://cybersecuritynews.com/best-model-context-protocol-mcp-servers/)

---

_Document generated: January 2026_
_Author: Claude Code Analysis_
_Status: Proposal for Review_
