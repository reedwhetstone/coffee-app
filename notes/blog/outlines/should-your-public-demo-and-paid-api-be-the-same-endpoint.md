# Outline: Should Your Public Demo and Paid API Be the Same Endpoint?

**Pillar:** api-architecture
**Target:** 1,500-2,000 words (HARD CEILING)
**Status:** outlined
**Source material:** repos/coffee-app/notes/PRODUCT_VISION.md, repos/coffee-app/notes/BLOG_STRATEGY.md, repos/coffee-app/notes/API_notes/API-strategy.md, repos/coffee-app/notes/API_notes/APITIER.md, repos/coffee-app/notes/decisions/002-api-first-external-internal-split.md, repos/coffee-app/notes/decisions/003-public-analytics-three-chart-free-gate.md, repos/coffee-app/notes/anonymous-catalog-access-audit-2026-04-16.md, repos/coffee-app/notes/implementation-plans/2026-04-17-v1-catalog-anonymous-docs-alignment.md, repos/coffee-app/src/lib/server/catalogResource.ts, repos/coffee-app/src/lib/server/apiAuth.ts, repos/coffee-app/src/lib/docs/content.ts, repos/coffee-app/src/routes/api/catalog-api/+server.ts

## Thesis

Most teams assume the free public surface and the paid integration surface should live on different endpoints. That feels cleaner, but it usually creates contract drift faster than it creates safety. The better pattern is one canonical resource with different trust modes layered on top of it: anonymous callers get proof-of-value, signed-in product users get contextual visibility, and API-key callers get metering plus durable machine guarantees. The endpoint is not the product boundary. The governance rules are.

## Voice Constraints

- Short and punchy. 1,500-2,000 words max.
- Gladwell/Freakonomics framing: the surprising claim is that route splitting is often the wrong abstraction. The real split is trust mode, not endpoint.
- No salesmanship, no API-as-the-future fluff. Stay concrete.
- Data and analysis over narrative. Use the real Purveyors contract details, not generic platform talk.
- 1-2 research citations only, each doing real work.
- Purveyors should illustrate the principle, not become the pitch.
- Every section earns its place. If a section does not sharpen the trust-mode argument, cut it.

## Verification Checklist

- [ ] `repos/coffee-app/src/lib/server/catalogResource.ts` still supports three auth kinds in the canonical resource: `anonymous`, `session`, and `api-key`
- [ ] Anonymous `/v1/catalog` still clamps to page 1 and a 15-row teaser contract, with allowlisted filters `country`, `processing`, and `name`
- [ ] API-key catalog requests still emit `X-RateLimit-*` headers and use current plan limits from `src/lib/server/apiAuth.ts`
- [ ] Green / viewer plan still maps to 200 calls per month and 25 rows per call; Origin / member still maps to 10,000 calls per month with no row cap
- [ ] `repos/coffee-app/src/routes/api/catalog-api/+server.ts` still requires API-key auth and still returns `Deprecation`, `Link`, and `Sunset` headers pointing callers to `/v1/catalog`
- [ ] ADR-002 still defines `/v1/catalog` as the canonical shared machine contract across web, CLI, API, and agent consumers
- [ ] `repos/coffee-app/src/lib/docs/content.ts` still positions the CLI as account-linked and the public HTTP API as the production network surface
- [ ] If the post mentions public proof-of-value before the paywall, ADR-003 still frames that as canonical product strategy

## External References

1. **Ofe & de Reuver, "Rethinking openness in data platforms"** (2024 excerpt)
   URL: https://theplatformeffect.com/excerpts/rethinking-openness-in-data-platforms/
   Key line: "openness at the user level concerns the level of discrimination between user groups."
   Why it matters: gives a clean conceptual frame for anonymous, session, and API-key access as governance choices, not accidental inconsistencies.

2. **van der Vlist, Helmond, and Ferrari, "Platform apps and APIs: governance and the limits of software studies"** (2022)
   URL: https://policyreview.info/articles/analysis/platform-apps-and-apis-governance-and-limits-software-studies-perspective
   Key line: APIs should be understood as governance arrangements, not just technical connectors.
   Why it matters: supports the post's core claim that the important boundary is control, access, and enforcement, not just which route exists.

## Structure

### The Wrong Boundary (~320 words)

Open with the default instinct: split the public demo from the real API. One endpoint for anonymous browsing, another for paid integrations, maybe a third for the product itself. It feels safer because each audience gets its own lane.

Then cut straight to the problem. The moment the same catalog feeds the website, the CLI, chat tooling, and external developers, separate endpoints stop being clean segmentation and start becoming duplicated truth. Product teams think they are creating safety. What they often create is drift: different defaults, different auth assumptions, different docs, different field names.

Use Purveyors product vision and ADR-002 to ground the claim: the strategy is explicitly one shared machine contract across web, CLI, API, and agents. That makes route forks a design smell, not a neutral implementation detail.

Section goal: establish the counterintuitive premise that "public vs paid" is the wrong first split. The first split should be "what kind of trust and guarantee does this caller need?"

### One Resource, Three Trust Modes (~430 words)

Lay out the concrete Purveyors pattern.

Key points to cover:

- The canonical resource is `GET /v1/catalog`
- Anonymous callers are allowed, but only as a teaser: page 1, max 15 rows, only `country`, `processing`, and `name`
- First-party sessions hit the same canonical resource, but can unlock richer in-app visibility depending on role
- API-key callers also hit the same canonical resource, stay public-only, but get plan enforcement and `X-RateLimit-*` headers
- Green/viewer is 200 calls per month and 25 rows per call; Origin/member is 10,000 calls per month and uncapped at the row level
- The legacy `/api/catalog-api` route survives only as a compatibility shim, with deprecation and sunset headers

The key insight for this section: these are not three products. They are three trust modes on one product surface.

Phrase to push: the same resource can answer three different questions:

- anonymous: "is this useful at all?"
- session: "how does this fit into my workflow?"
- API key: "can I build a reliable integration on top of this?"

This is the heart of the post and should feel concrete, not theoretical.

### Drift Is the Real Risk (~380 words)

Now flip the intuition. Most teams split endpoints because they think the real danger is exposure. But the more common danger is drift.

Use the internal evidence stack:

- the April 16 anonymous access audit found a mismatch between the logged-out UI and the actual backend contract
- the April 17 docs-alignment plan showed the opposite version of the same problem: the backend contract had tightened, but the docs still described the older broader anonymous behavior
- the legacy alias exists precisely because compatibility is real, but it has to be explicit and constrained or it becomes a second source of truth

This section should argue that separate routes do not magically create clean product boundaries. They create more places for boundaries to go stale.

Concrete examples to include:

- frontend gate says 15 items, backend once allowed 100+
- docs described one auth/query envelope, live endpoint enforced another
- a legacy alias can preserve callers safely only if it remains a thin delegating adapter, not a parallel product

Counterintuitive punchline: many API leaks are not caused by too much openness. They are caused by teams forgetting which surface is actually canonical.

### APIs Are Governance, Not Just Transport (~320 words)

Bring in the research here, briefly and purposefully.

Use Ofe & de Reuver to frame openness as discrimination between user groups, which maps almost perfectly onto anonymous, session, and API-key access. Then use van der Vlist et al. to make the stronger point: APIs are governance mechanisms. They decide who can ask, how much they can ask for, what shape they get back, and what guarantees come with the answer.

That framing lets the post say something sharper than "design better docs."

The real design question becomes:

- what should be common across all callers?
- what should vary by trust mode?
- which limits belong in UI, which belong in code, and which belong in docs?

Tie this back to product strategy. Public surfaces should prove value before the paywall, but proof-of-value is not the same thing as production-grade access. That is why anonymous teaser behavior and API-key integration behavior can both be honest while still being different.

### How to Ship a Dual-Audience API Without Lying (~300 words)

End with a practical operating pattern.

Suggested playbook:

1. **Pick one canonical resource.** If you need old routes, make them explicit compatibility shims with deprecation headers.
2. **Name the trust modes in the docs.** Anonymous discovery, first-party session, API-key integration. Do not blur them into one generic contract description.
3. **Keep limits server-side.** A UI gate is not a contract.
4. **Share constants between code and docs.** If the anonymous page cap is 15, that number should come from one source of truth.
5. **Test from zero context.** A caller who only sees `/docs` and the endpoint should be able to tell what is teaser behavior and what is production behavior.

Final line should land hard: if your public demo and your paid API talk to different truths, you do not have access tiers. You have two products pretending to be one.
