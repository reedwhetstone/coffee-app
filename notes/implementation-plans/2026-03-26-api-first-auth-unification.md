# Implementation Plan: API-First Auth Unification and Parchment Platform IA

**Date:** 2026-03-26
**Slug:** api-first-auth-unification
**Status:** Planning only, awaiting Reed review
**Repo:** coffee-app
**Follow-up after:** PR #179 merge, before PR #178 docs respin

---

## Executive summary

The right move is **not** to keep polishing docs around a muddled architecture.

The right move is:

1. unify the **business logic and contract layer** behind internal and external APIs
2. support **two auth modes** against that unified layer
3. simplify roles into **app roles + API entitlements/plans**
4. collapse docs into one public `/docs` system
5. then rewrite PR #178 docs against the corrected architecture

The key pushback is this:

**API-first does not mean every current internal endpoint should become public.**

It means the product should have:
- one coherent contract layer
- one consistent auth/authorization model
- one canonical resource surface for public/product APIs
- separate internal-only orchestration surfaces where needed

If we naively expose all current internal routes, we will harden app-specific quirks into public contracts and regret it.

---

## What should unify, and what should not

## Should unify
These are product-domain resources that can reasonably share one canonical API contract:

- catalog
- analytics data products, when ready
- inventory, if intended for external automation
- roast data, if intended for external automation
- user/account developer resources around API usage and keys

These should aim toward a canonical, versioned resource model like:

- `/v1/catalog`
- `/v1/analytics/*`
- `/v1/inventory/*`
- `/v1/roasts/*`

The same handlers/services should serve:
- first-party app access via session auth
- CLI access via bearer token / machine auth
- external integrations via API key or OAuth access token

## Should NOT unify blindly
These are app-internal orchestration or UI-specific routes and should stay internal/private unless deliberately productized:

- `/api/tools/*`
- `/api/workspaces/*`
- app-only UI aggregation routes
- routes shaped around specific Svelte page needs
- admin-only maintenance routes

Those can still use the same core services, but they should **not** be treated as public API contracts.

---

## Current architecture problem

Today the repo mixes three concerns in the same namespace:

1. **public/external API contracts**
   - example: `/api/catalog-api`

2. **first-party app JSON endpoints**
   - example: `/api/catalog`

3. **internal orchestration endpoints**
   - tools, admin, workspaces, AI helpers

The auth model is also split awkwardly:

- Supabase session auth for app routes
- API keys for external catalog API
- role names are overloaded to represent app permissions, billing tiers, API plans, and special feature access

That is why docs keep getting weird. The architecture itself is making them weird.

---

## Recommended target architecture

## Layer 1: Domain services
Create or strengthen reusable services for core resources:

- catalog service
- analytics service
- inventory service
- roast service
- account/developer service

These should contain:
- data fetching
- filtering / normalization
- business rules
- permission-aware field shaping when necessary

These should **not** know whether the caller is:
- the web app
- the CLI
- an external partner

They should receive a normalized `AuthContext` / `PrincipalContext`.

## Layer 2: Auth normalization
Introduce a single request-auth resolver that can accept either:

- **session/cookie auth** for first-party browser app
- **bearer API key** for machine/server-to-server callers
- later: **OAuth access token** for third-party delegated access

Output should be a normalized principal object like:

```ts
interface PrincipalContext {
  actorType: 'user-session' | 'api-key' | 'oauth-client';
  userId?: string;
  accountId?: string;
  keyId?: string;
  scopes: string[];
  entitlements: string[];
  plan: 'free' | 'member' | 'api-pro' | 'custom';
  isAdmin: boolean;
}
```

That context becomes the single input for authorization and data shaping.

## Layer 3: Transport surfaces
Then split transport intentionally:

### Public/product API
Versioned, stable contracts:
- `/v1/catalog`
- `/v1/analytics/...`
- etc.

### First-party app/BFF routes
Can either:
- call the same service layer directly, or
- thinly proxy to the same canonical handlers

### Internal orchestration routes
Remain internal and explicitly non-contractual.

---

## Answer to your core auth question

## Can one API support two auth methods?
**Yes. That is a normal pattern.**

But the correct implementation is:
- **one resource contract**
- **multiple authentication methods**
- **one normalized authorization model**

Not:
- same path but different semantics depending on auth type
- wildly different field sets with no explicit rules
- internal-only behavior leaking into public callers

## The clean model
For a canonical endpoint like `/v1/catalog`:

1. inspect request auth in priority order
   - `Authorization: Bearer ...`
   - else same-origin session cookie / Supabase session
2. resolve principal
3. compute scopes + entitlements + rate plan
4. call shared catalog service
5. enforce field/row/rate limits based on entitlements
6. return same resource schema

That means the app can call `/v1/catalog` with session auth, while external callers use API keys or OAuth tokens.

## Should external API allow OAuth access?
**Eventually yes, but not as the first step.**

There are two distinct use cases:

### A. Server-to-server / machine access
Best auth: **API keys** or client credentials style tokens

Use for:
- backend jobs
- partner integrations
- data pipelines
- agentic infra running on behalf of an account owner

### B. Third-party app acting on behalf of a user
Best auth: **OAuth 2.1 Authorization Code + PKCE**

Use for:
- external apps where a user clicks “Connect Purveyors”
- delegated access without sharing API keys

### C. First-party browser app
Best auth: **session cookies / first-party session**

Use for:
- Maillard Studio UI
- same-origin page + API calls

## Pushback
Do **not** try to make the browser app use raw long-lived API keys. That is a security regression.

Do **not** try to force external consumers into Supabase browser-session semantics. That is the wrong auth model for third parties.

The clean design is:
- same canonical API contract
- different auth credentials depending on caller type

---

## Common mistakes to avoid

### 1. One endpoint, different meaning by auth type
Bad pattern:
- session user gets one schema
- API key user gets another schema
- app callers can use undocumented filters that public users cannot

Result: impossible docs, impossible SDKs, fragile clients.

### 2. Using product roles as auth scopes
Roles like `api-member`, `ppi-member`, `member` are doing too much.

Roles should answer:
- what kind of app access does this human have?

Scopes/entitlements/plans should answer:
- what APIs and limits does this principal have?

### 3. Exposing internal-only endpoints because “API-first” sounds nice
That hardens UI accidents into public contracts.

### 4. No versioned public namespace
Public APIs should live under a stable namespace like `/v1/*`.

### 5. Mixing rate-limit logic with role logic everywhere
That creates drift and makes pricing changes painful.

### 6. Letting browser cookie auth hit unsafe cross-origin flows without CSRF thought
If same endpoints accept cookies for first-party app and bearer auth for external callers, you need explicit CSRF and origin rules for state-changing requests.

### 7. No principal normalization layer
If every handler does its own auth branching, the system rots immediately.

### 8. Treating docs as the source of truth instead of code contracts
Docs should describe the contract, not invent it.

---

## Recommended auth and entitlement redesign

## App roles
Keep app roles minimal:
- `viewer`
- `member`
- `admin`

## Entitlements / plans
Model these separately:
- `api_free`
- `api_pro`
- `api_custom`
- `analytics_access`
- future add-ons as needed

## Why this is better
This separates:
- app permission level
- subscription/package inclusion
- API usage plan
- feature gating

That means you can express things like:
- viewer + api_free
- member + api_pro
- member + analytics_access
- admin + api_custom

without inventing new pseudo-roles for every bundle.

## Pushback on your collapse idea
The direction is right, but I would not literally collapse everything into just a few labels without introducing entitlements.

If you simply delete `api-enterprise` and `ppi-member` without replacement semantics, you will lose:
- billing mapping
- limit mapping
- customer-specific overrides
- migration clarity

So the correct move is:
- simplify roles
- add entitlements
- migrate rules onto entitlements
- then remove old hybrid role names

---

## Recommended product naming

I do think **"Parchment API" is too narrow** if Parchment becomes the broader developer/data/AI platform layer.

My recommendation:

## Umbrella brand
**Parchment Platform**

This gives you room for:
- Parchment API
- Parchment CLI
- Parchment Docs
- Parchment Console
- future SDKs / agents / connectors

## Sub-products
- **Parchment API** = HTTP endpoint product
- **Parchment CLI** = command-line interface
- **Parchment Console** = authenticated developer dashboard, replacing “API Dashboard”
- **Parchment Docs** = public docs experience

## Why I like this
It preserves the valuable “API” label for the endpoint product, but stops forcing the entire Parchment brand to sound like only REST.

If you call the whole umbrella “Parchment API,” the CLI and broader dev/data platform will always feel like awkward appendages.

If you call the umbrella “Parchment Platform,” the structure becomes clean.

## Pushback
I would **not** rename the endpoint product away from API if it is still actually an API product. That creates unnecessary ambiguity.

So my suggestion is:
- broaden the umbrella brand, not erase the endpoint name

---

## Docs IA recommendation

Agree with your instinct:
- remove `/api-dashboard/docs` as a standalone docs destination
- keep one public `/docs` system for all docs

### Proposed structure
- `/docs`
  - overview
  - quickstart
  - auth
  - concepts
- `/docs/api/*`
- `/docs/cli/*`
- `/docs/platform/*` if needed later

### Authenticated console behavior
`/api-dashboard` should become **`/console` or `/parchment` console** eventually, or at least `Parchment Console` in copy.

Inside that surface, link out to `/docs`, but do not host a separate docs tree.

At most, the console can have:
- contextual help links
- account-aware getting-started panels
- deep links into `/docs`

But one content source only.

---

## Recommended implementation phases

## Phase 1: Principal and auth unification
**Goal:** one request-auth resolver, two auth methods, one principal object

### Deliverables
- `resolvePrincipal(event/request)` utility
- support for:
  - first-party session auth
  - API key bearer auth
- normalized `PrincipalContext`
- central authorization helpers based on scopes/entitlements

### Acceptance criteria
- one shared resolver used by pilot handlers
- no handler-specific auth branching duplicated in multiple places

---

## Phase 2: Pilot one canonical resource endpoint
**Goal:** prove the pattern on catalog first

### Deliverables
- create canonical versioned route, likely `/v1/catalog`
- make response contract stable and documented
- allow access via:
  - session auth for app
  - API key auth for external callers
- keep legacy routes as thin adapters during migration:
  - `/api/catalog`
  - `/api/catalog-api`

### Acceptance criteria
- app can read from canonical contract
- external API callers can read from same contract
- legacy routes delegate instead of duplicating logic

### Pushback
Do catalog first. Do **not** try to unify every endpoint in one shot.

---

## Phase 3: Entitlement model and role simplification
**Goal:** stop encoding plans as pseudo-roles

### Deliverables
- app roles reduced to viewer/member/admin
- API/access tiers represented as entitlements or plan records
- migration mapping for old roles:
  - `ppi-member`
  - `api-member`
  - `api-enterprise`
- Stripe/webhook/update flows moved onto new model

### Acceptance criteria
- rate limits and feature gates no longer depend on hybrid pseudo-roles alone
- app permission checks still work cleanly

---

## Phase 4: Console and docs consolidation
**Goal:** one docs source, one clearer developer experience

### Deliverables
- remove standalone `/api-dashboard/docs` route or redirect it to `/docs`
- public `/docs` becomes canonical docs IA for API + CLI + platform
- console/dashboard links point into `/docs`
- PR #178 docs refresh reauthored against the corrected architecture

### Acceptance criteria
- no duplicated docs trees
- console and docs naming align with Parchment umbrella strategy

---

## Phase 5: Naming cleanup
**Goal:** align product naming with architecture

### Deliverables
- decide umbrella name: **Parchment Platform** recommended
- rename “API Dashboard” copy to **Parchment Console** if approved
- keep “Parchment API” for endpoint product
- ensure nav/copy/docs reflect hierarchy clearly

---

## Suggested first PR sequence

### PR A
**Auth foundation / principal unification**
- add shared principal resolver
- no broad behavior changes yet

### PR B
**Catalog API unification pilot**
- introduce canonical `/v1/catalog`
- adapt internal/external routes to delegate

### PR C
**Role simplification to app roles + entitlements**
- migrate gating and billing logic

### PR D
**Docs + console consolidation**
- remove `/api-dashboard/docs`
- rewrite PR #178 on top of corrected architecture

### PR E
**Naming cleanup**
- Parchment Platform / Console / API hierarchy

This sequencing keeps risk contained and gives docs something true to describe.

---

## Open questions Reed should decide before implementation

1. Is the canonical public namespace definitely `/v1/*`?
   - I recommend yes.

2. Should first-party app reads call the canonical contract directly, or a same-origin thin wrapper?
   - I lean direct, if the auth resolver is clean.

3. Is analytics intended to become a real public endpoint family soon, or only after catalog unification proves out?
   - I recommend after catalog proves out.

4. Do you want the umbrella name to be **Parchment Platform** specifically, or do you want alternatives explored?

5. Is the developer dashboard naming better as:
   - `API Dashboard`
   - `Parchment Console`
   - `Developer Console`

My preference is **Parchment Console**.

---

## Bottom line

Yes, you can have **one API contract layer with two auth methods**.
That is the right direction.

But the winning design is:
- unified contract and service layer
- normalized principal model
- app roles separated from API plans/entitlements
- public docs in one place
- internal orchestration routes kept internal

The losing design is:
- exposing every current `/api/*` route
- overloading roles forever
- making docs explain contradictions instead of fixing them
