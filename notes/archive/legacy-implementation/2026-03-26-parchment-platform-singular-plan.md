# Singular Plan: Parchment Platform, API-First Contract, and Docs Consolidation

**Date:** 2026-03-26
**Status:** Strategic plan, post-review synthesis
**Repo:** coffee-app
**Purpose:** Consolidate prior planning + Reed feedback into one implementation direction before revisiting PR #178 docs work

---

## Final framing

The direction is sound, but it needs tighter guardrails.

**Adopt:**

- API-first contract design
- one canonical versioned resource surface (`/v1/*`)
- one normalized principal/auth resolver
- app roles separated from API plans/entitlements
- one public docs tree at `/docs`
- Parchment as the umbrella developer/platform brand

**Reject:**

- exposing every current `/api/*` route as public just because it exists
- using docs to smooth over unresolved auth/model contradictions
- letting first-party app convenience permanently dictate messy public contract design
- collapsing roles before a replacement entitlement model exists
- running two docs systems (`/docs` and `/api-dashboard/docs`)

---

## Red-team verdict on the current proposal

## What is strong

### 1. "The API is the product; the UI is its first demanding customer"

This is the right pressure test.

If the app is a real consumer of the same contract, the API cannot rot into an afterthought. That is a strong architectural forcing function.

### 2. Canonical `/v1/*` surface

Correct.

Versioned namespaces are table stakes if the web app and external consumers will both rely on the same contracts.

### 3. Principal normalization

Also correct.

A single `resolvePrincipal` layer is the only way to avoid auth drift across handlers.

### 4. Role/plan separation

Correct direction.

Current hybrid pseudo-roles are clearly doing too much.

### 5. Single public docs system

Correct.

`/api-dashboard/docs` should not survive as a competing docs surface.

---

## What needs pushback or revision

### 1. "The web app and external partners are peers"

**Pushback:** they are peers at the **contract layer**, not at every behavior layer.

The web app will always have some privileged ergonomics that outside consumers should not automatically get:

- draft/preview access
- higher trust on same-origin workflows
- internal navigation needs
- account-aware composite views

So the corrected phrasing is:

> The web app and external partners are peers in consuming the canonical product API contract, but not necessarily peers in privilege, latency assumptions, or access to internal-only orchestration surfaces.

That distinction matters a lot.

### 2. `isPrivileged: boolean`

**Pushback:** too fuzzy.

That flag will become a dumping ground for special cases fast. Better:

- explicit scopes
- explicit entitlements
- maybe `actorClass` if needed

Example:

```ts
interface PrincipalContext {
	actorType: 'user-session' | 'api-key' | 'oauth-client' | 'internal-service';
	subjectId?: string;
	accountId?: string;
	keyId?: string;
	scopes: string[];
	entitlements: string[];
	plan: 'free' | 'member' | 'api-pro' | 'custom';
	roles: Array<'viewer' | 'member' | 'admin'>;
}
```

If the UI needs preview access, grant something explicit like:

- `catalog:read:draft`
- `analytics:read:preview`

That is safer than `isPrivileged`.

### 3. Expansion and sparse fieldsets as immediate requirements

**Pushback:** good direction, but do not overbuild them into the pilot unless the catalog migration proves they are necessary.

Correct rule:

- support **simple, obvious field selection** if it falls out cheaply
- add **expansion** only when the first-party app genuinely needs it and the alternative causes measurable pain

Otherwise there is a real risk of building a GraphQL-lite query language by accident.

### 4. "Migrate the web app to consume `/v1/catalog` directly"

**Pushback:** maybe, but not necessarily on day one.

For the pilot, I recommend a thin same-origin adapter/BFF layer is still acceptable if it helps with:

- CSRF handling
- cookie/session normalization
- progressive migration
- response shaping for app-specific non-contract needs

The rule should be:

- the app must rely on the **same domain contract and core handler logic**
- but it does not have to physically call the public route over HTTP on day one if a same-process adapter is cleaner

The worst outcome would be forcing literal HTTP self-calls inside the same app and calling that “purity.”

### 5. "Strip `api-enterprise` and `ppi-member` roles from Supabase" in Phase 3

**Pushback:** only after replacement data model + migration tooling exist.

This cannot be a prose-level cleanup. It needs:

- new entitlement source of truth
- migration script/backfill
- Stripe mapping updates
- auth helper updates
- API usage/rate limit updates
- analytics gating updates
- admin/reporting updates

Do not delete the old roles until all of that exists and is verified.

### 6. "Redirect old `/api/catalog` and `/api/catalog-api` to `/v1/catalog`"

**Pushback:** likely **adapter first, redirect later**.

Reason:

- existing internal callers may depend on current response shapes
- external users may depend on current auth and rate-limit semantics
- direct redirect could break assumptions before consumers are migrated

Safer sequence:

1. build `/v1/catalog`
2. make old routes delegate to the new handler/service
3. migrate callers
4. deprecate
5. then redirect or remove

---

## Recommended singular architecture

## Layer 1: Domain modules

These are the source of truth.

Examples:

- `catalogService`
- `analyticsService`
- `inventoryService`
- `roastService`
- `developerPlatformService`

Responsibilities:

- validation
- filtering
- data shaping
- business rules
- entitlement-sensitive field access

Non-responsibilities:

- cookie parsing
- bearer parsing
- route-specific formatting quirks

## Layer 2: Principal resolution + authorization

One resolver accepts:

- first-party session cookie
- API key bearer token
- future OAuth access token
- future internal service identity

Output: normalized `PrincipalContext`

Authorization should be built on:

- roles: app permissions
- scopes: action-level grants
- entitlements: commercial/product access
- plan: rate/limit tier

## Layer 3: Canonical resource handlers

Canonical public/product routes live under `/v1/*`.

Examples:

- `/v1/catalog`
- `/v1/analytics/*`
- `/v1/inventory/*`
- `/v1/roasts/*`

These handlers:

- use the principal resolver
- call domain modules
- return contract-stable responses

## Layer 4: Adapters

Adapters can exist for:

- legacy routes
- first-party app/BFF routes
- CLI helper compatibility
- internal orchestration

But they should delegate to the canonical handlers/services.

---

## Naming system recommendation

## Umbrella

**Parchment Platform**

This is the best top-level name from the current options.

Why:

- broad enough to include API, CLI, docs, and console
- still concrete and enterprise-legible
- does not trap the whole brand inside “API” language

## Sub-products

- **Parchment API** = HTTP endpoint product
- **Parchment CLI** = command-line/agent interface
- **Parchment Console** = authenticated developer dashboard
- **Parchment Docs** = public documentation site

## Relationship to Maillard Studio

- **Maillard Studio** = first-party application / showcase customer / operations UI
- **Parchment Platform** = developer, data, integration, automation layer

That split is clean and strategically strong.

### Pushback

Do not call the entire umbrella “Parchment API” if CLI and broader platform tooling sit under it. That will feel wrong forever.

---

## Docs IA decision

### Canonical docs

- `/docs`
- `/docs/api/*`
- `/docs/cli/*`
- `/docs/platform/*` if needed later

### Remove as standalone destination

- `/api-dashboard/docs`

### Replacement behavior

- redirect `/api-dashboard/docs` to a relevant `/docs` destination
- keep contextual links from Console into `/docs`
- allow account-aware help panels inside Console, but not a second authored docs tree

This should be treated as a hard architectural rule, not a preference.

---

## Auth model decision

## Supported auth modes

### First-party app

- session cookie / Supabase SSR
- same-origin browser use

### External integrations / agents / server-to-server

- API key bearer auth now

### Future third-party delegated access

- OAuth 2.1 Authorization Code + PKCE later

## Security note

If `/v1/*` accepts cookie-authenticated state-changing requests, CSRF protection is required.

For read-only GETs, risk is lower, but for mutation routes you should require:

- same-site cookies
- CSRF token or strict origin checks
- no unsafe fallback behavior when bearer auth is absent

### Pushback

Do not put long-lived API keys in the browser. Ever.

### Pushback

Do not force third parties onto Supabase browser session semantics. That is not a real external auth strategy.

---

## Role and entitlement redesign

## Keep app roles minimal

- `viewer`
- `member`
- `admin`

## Add explicit entitlements/plans

Suggested starting set:

- `api_free`
- `api_pro`
- `api_custom`
- `analytics_access`
- future feature entitlements as needed

## Why this is better

It lets the system express:

- app permission
- commercial packaging
- API limits
- feature access

without inventing hybrid roles like `ppi-member`.

## Migration rule

Do not remove old pseudo-roles until every dependency has moved:

- Stripe/webhook logic
- Supabase user role reads
- API rate limiting
- analytics gating
- dashboard labels
- admin tools
- docs

---

## What should be piloted first

## Pilot resource: Catalog

This is still the right first pilot.

Reasons:

- already exists in both internal and external forms
- lower blast radius than analytics + billing + account mutations
- immediately exposes auth, rate-limit, and contract issues
- directly relevant to CLI, web app, and external consumers

## Canonical target

- `/v1/catalog`

## Pilot rules

- build stable schema first
- keep filters minimal and obvious
- support pagination cleanly
- map entitlements to row limits and field access
- do not add expansion until the app proves it is necessary

## Legacy migration strategy

- `/api/catalog` becomes adapter to canonical contract/service
- `/api/catalog-api` becomes adapter to canonical contract/service
- no instant redirect until callers migrate safely

---

## What not to do in the pilot

- do not unify analytics in the same PR as catalog
- do not delete pseudo-roles in the same PR as auth resolver
- do not rebrand docs, dashboard, auth model, and resource contracts all at once
- do not build a giant query language because the app _might_ want it
- do not let preview/draft behavior piggyback on vague privilege flags

---

## Singular phased plan

## Phase 0: Design decisions and schema map

**Goal:** lock the contract and auth model before coding

Deliverables:

- final `PrincipalContext` shape
- app-role vs entitlement matrix
- `/v1/catalog` contract sketch
- migration inventory of existing role usage and route usage
- naming decision for Console/Platform

Open decision gates:

- confirm `/v1/*` as canonical namespace
- confirm `Parchment Platform` umbrella
- confirm `Parchment Console` naming

---

## Phase 1: Principal foundation

**Goal:** build a real auth normalization layer

Deliverables:

- `resolvePrincipal()` middleware/helper
- support for session + API key
- explicit authorization helpers based on scopes/entitlements
- CSRF/origin policy for cookie-authenticated mutation routes

Acceptance criteria:

- pilot handlers can consume normalized principal without custom auth branching

---

## Phase 2: Catalog contract pilot

**Goal:** prove API-first contract on one real product resource

Deliverables:

- canonical `/v1/catalog`
- shared catalog domain service
- legacy adapters for `/api/catalog` and `/api/catalog-api`
- pagination/filters/limit policy documented in code

Acceptance criteria:

- first-party app can consume canonical contract or thin adapter over it
- external callers can consume same contract via API key
- no semantic divergence between internal and external catalog data model

---

## Phase 3: Entitlement migration

**Goal:** remove hybrid role debt safely

Deliverables:

- entitlements source of truth (table or Stripe-backed mapping)
- migration/backfill plan
- rate-limit logic reading plans/entitlements
- analytics gating updated to new model
- old role names deprecated but not hard-deleted until verified

Acceptance criteria:

- app permissions still work
- API plans no longer rely on hybrid pseudo-roles

---

## Phase 4: Console and docs consolidation

**Goal:** one docs tree, cleaner developer product surface

Deliverables:

- `API Dashboard` rebranded to `Parchment Console` if approved
- `/api-dashboard/docs` redirected to `/docs`
- `/docs` becomes canonical docs for API + CLI + Platform
- PR #178 respun only after the architecture is true

Acceptance criteria:

- zero duplicated docs systems
- naming consistent across nav, pages, and docs

---

## Phase 5: Further surface expansion

**Goal:** extend the pattern without losing discipline

Candidates after catalog proves out:

- analytics endpoints
- inventory endpoints
- roast endpoints
- SDK generation / OpenAPI support

Rule:

- expand only after canonical contract, auth, and entitlement model are stable

---

## Concrete requests for additional direction

These need explicit decisions before implementation starts:

1. **Namespace**

- Confirm canonical public namespace is `/v1/*`

2. **Naming**

- Approve or reject:
  - umbrella: `Parchment Platform`
  - dashboard: `Parchment Console`

3. **Pilot migration style**

- Should the first-party app call `/v1/catalog` directly over HTTP, or use a same-origin adapter that shares the same handler/service logic?
- My recommendation: same-process adapter is acceptable for the first migration if it reduces risk.

4. **Entitlements storage**

- Preferred source of truth:
  - dedicated DB entitlement table
  - Stripe metadata mapped into DB
  - hybrid model
- My recommendation: DB entitlement table, fed by billing/webhook events

5. **Preview content policy**

- Do you actually want preview/draft exposure in the API pilot, or should that be deferred until after catalog unification?
- My recommendation: defer unless there is a concrete current use case.

---

## Final recommendation

Adopt the architecture, but with these corrections:

- peers at the contract layer, not identical privilege everywhere
- no `isPrivileged` shortcut flag; use explicit scopes/entitlements
- adapters first, redirects later
- catalog first, not everything at once
- role simplification only with real entitlement migration
- one public docs tree, no second docs universe
- `Parchment Platform` umbrella, `Parchment API` endpoint product, `Parchment Console` dashboard

This keeps the vision ambitious **without** turning it into an elegant-sounding rewrite that breaks product reality.
