# Outline: Can an Agent Use Your API Without Help?

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-app/notes/PRODUCT_VISION.md, repos/coffee-app/notes/BLOG_STRATEGY.md, brain/references/b2cc-agents-as-customers.md, repos/coffee-app/notes/decisions/002-api-first-external-internal-split.md, repos/coffee-app/notes/anonymous-catalog-access-audit-2026-04-16.md, repos/coffee-app/notes/pr-audits/2026-04-16-pr-271-docs-public-discovery-canonicalization.md, repos/coffee-app/src/lib/docs/content.ts, repos/coffee-app/src/routes/docs/+page.svelte, repos/coffee-app/src/routes/llms.txt/+server.ts, repos/coffee-app/src/routes/sitemap.xml/+server.ts, repos/coffee-app/src/lib/server/catalogResource.ts, repos/coffee-app/src/routes/api/catalog-api/+server.ts, repos/coffee-app/scripts/audit-public-discoverability.ts

## Thesis

Most teams hear the B2CC argument and think about growth: agents are new customers, so optimize the docs. The harsher and more useful interpretation is QA. A zero-context agent forced to discover, authenticate, and use your API from public materials alone will expose split-brain routes, vague auth models, UI-only limits, and documentation drift faster than most human test plans. If an agent cannot integrate your API without help, the API is not ready.

## Voice Constraints
- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: take the familiar promise of B2CC and flip it. The real payoff is not just acquisition. It is brutal usability testing.
- No salesmanship, no "future of AI" fluff. Stay concrete.
- Data and analysis over narrative. Use the Purveyors catalog/docs examples, not generic hand-waving.
- Keep Purveyors in the piece as an illustration of the principle, not the pitch.
- Every section earns its place. If a section does not add a new failure mode or operational takeaway, cut it.

## Verification Checklist
- [ ] ADR-002 still defines `GET /v1/catalog` as the canonical external contract and `GET /api/catalog-api` as the deprecated delegating alias
- [ ] `src/routes/api/catalog-api/+server.ts` still requires API-key auth and still returns deprecation headers pointing to `/v1/catalog`
- [ ] `src/lib/server/catalogResource.ts` still defaults the canonical listing path to 100 rows when both `page` and `limit` are omitted
- [ ] The anonymous catalog audit is still accurate: the logged-out catalog UI shows 15 items while direct anonymous `/v1/catalog` calls expose the larger backend contract
- [ ] `src/lib/docs/content.ts` still documents three auth contexts: anonymous, first-party session, and API key
- [ ] `llms.txt` still links `/docs` and `/docs/api/catalog` as public discovery surfaces
- [ ] `sitemap.xml` still includes `/docs` and `/docs/api/catalog` and excludes `/api-dashboard`
- [ ] `scripts/audit-public-discoverability.ts` still fails when `/docs` or `/docs/api/catalog` disappear from sitemap or `llms.txt`
- [ ] If the draft mentions Microsoft/AWS/Google machine-readable docs as precedent, verify the current official status on publish day

## External References
1. **Caleb John, "B2CC: Claude Code Is Your Customer"** (Jan 21, 2026) — Sets up the framing this post will invert. Key quote: "API docs ARE the product now." Also provides the direct seed for the line: "Test with agents first." https://calebjohn.xyz/blog/b2cc/

2. **Michael Meng et al., "Application Programming Interface Documentation: What Do Software Developers Want?"** (2023, Journal of Technical Writing and Communication) — Useful grounding for why documentation quality still matters even before the agent twist. In the study, overall API documentation satisfaction was 2.9/5 and structure/organization scored 2.5/5. Key quote: docs should "support these two learning strategies." https://journals.sagepub.com/doi/10.1177/00472816231182389

## Structure

### The Better Use for B2CC (~300 words)
Open with the popular reading of B2CC: agents are customers, docs are the product, switching costs collapse. Then pivot fast. The most valuable part of that framing is not go-to-market. It is that agents are mercilessly literal integrators.

Humans compensate for bad APIs. They infer intent. They ask a teammate. They click around the UI. They keep a mental model of legacy routes. Agents do not. They take the public surface at face value. That makes them a better detector of contract incoherence than most internal QA.

Set up the core claim: an agent test is not "AI magic." It is the cleanest possible outsider test.

### What the Agent Actually Catches (~450 words)
Use Purveyors as the concrete example set.

Key points to cover:
- The canonical contract says `/v1/catalog`; the legacy alias `/api/catalog-api` still exists, but with different auth rules and deprecation headers.
- The logged-out catalog experience suggests one limit (15 visible items), while the real anonymous backend contract exposed a much larger default (`/v1/catalog` defaulting to 100 rows when `page` and `limit` are omitted).
- The docs/discovery work on April 16 existed because public discovery was not coherent enough. `/docs` and `/docs/api/catalog` had to become explicit, machine-readable canonical entry points.

The pattern: the agent exposes every place where the system relies on tribal knowledge rather than explicit contract. A human on the team knows which path is canonical. An external caller, human or agent, does not.

### Docs Are Runtime, Not Support Material (~350 words)
This section argues that docs, `llms.txt`, sitemap entries, and discovery audits are part of the API surface now.

Use internal source material:
- `src/routes/docs/+page.svelte` positions docs as the unified public entry point
- `src/routes/llms.txt/+server.ts` advertises `/docs` and `/docs/api/catalog` to machine readers
- `scripts/audit-public-discoverability.ts` treats discoverability drift as a failing condition, not a copy bug

Bring in the Meng paper here. The important bridge: developers already struggle when docs are poorly structured. Agents compress that pain into a faster failure loop. Bad information architecture becomes a failed integration attempt almost immediately.

Optional supporting example if space allows: one short paragraph on why major platform vendors are now shipping machine-readable documentation surfaces. Keep it to one example, not a cloud-vendor parade.

### How to Run an Agent-First API Test (~400 words)
Turn the thesis into an operational playbook.

Suggested test shape:
1. Give the agent only the public materials: docs, `llms.txt`, sitemap, and the API itself
2. Do not give it Slack context, internal file paths, or verbal hints
3. Ask it to complete a real task: find the canonical endpoint, determine auth options, make a valid request, explain rate limits, and identify any ambiguity
4. Ask it where it got confused and what assumptions it had to make

Then define the pass/fail rubric:
- **Pass:** the agent finds the right route, authenticates correctly, explains limits accurately, and never depends on hidden context
- **Soft fail:** the agent succeeds but only by guessing across conflicting surfaces
- **Hard fail:** the agent chooses the wrong route, misstates auth/limits, or gets stuck because the public docs are incomplete

The key insight is that contract tests tell you whether the system behaves as coded. Agent-first tests tell you whether the system is understandable from the outside.

### The Real Payoff Is Cleaner Architecture (~300 words)
Close with the bigger point. "Test with agents first" is not about pandering to AI. It is a forcing function for architectural honesty.

If a route is canonical, say so everywhere. If a public endpoint is really public, stop pretending the UI gate protects it. If discovery matters, audit it like code. If docs drift from behavior, treat that as a product bug.

That is the counterintuitive punchline: the agent is useful because it knows less than your team does. It cannot paper over your inconsistencies. Humans benefit from the cleanup too, but the agent makes the hidden mess visible first.

End on the clearest line in the piece: if an agent cannot use your API without asking you a question, your API is not finished.
