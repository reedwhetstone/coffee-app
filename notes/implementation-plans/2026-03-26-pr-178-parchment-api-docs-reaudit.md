# Implementation Plan: PR 178 Re-audit After Routing Changes

> **Superseded context note (2026-04-13):** This document is useful as March transition history, but parts of its routing and naming model are no longer current. Treat `/docs` as canonical, treat `/api-dashboard/docs` as historical route context, and use current naming: Mallard Studio, Parchment API, Parchment Intelligence, Parchment Console, and Green / Origin / Enterprise.

**Date:** 2026-03-26
**Slug:** pr-178-parchment-api-docs-reaudit
**Status:** Planning only, awaiting Reed review
**Repo:** coffee-app
**Related PRs:** coffee-app #178, coffee-app #179, purveyors-cli #58

---

## First correction

PR **179 is already merged**, so this work should **not** be described as "revising PR 179".

The actual implementation target is one of:

1. **Respin PR 178 on a fresh branch off current `main`**; preferred
2. Rebase PR 178 and manually resolve conflicts; acceptable but probably slower

Because PR 178 is currently **conflicting** and overlaps files changed by PR 179 (`+layout.svelte`, `UnifiedHeader.svelte`, `Navbar.svelte`, `/api` surfaces), the cleanest path is:

- start from current `main`
- selectively port the good documentation/content work from PR 178
- preserve the merged routing and shell behavior from PR 179
- open a replacement docs PR if the old branch becomes too messy

---

## Goal

Re-audit the documentation and API information architecture so it matches the now-merged routing strategy:

- `/api` = **public Parchment API marketing page**
- `/api-dashboard` = **authenticated Parchment API workspace/gateway**
- `/api-dashboard/docs` = **authenticated detailed docs entry / gateway**
- `/docs` = **public documentation IA**, but without duplicating or contradicting the authenticated docs story

At the same time, align coffee-app docs with the already-merged CLI docs refresh in **purveyors-cli PR #58**.

---

## Executive take: what is right, what needs pushback

### 1. "Parchment API" is the correct product name

**Agree.**

The prior PR body over-corrected by replacing Parchment API branding too broadly. The better framing is:

- **Parchment API** = the external endpoint product line
- **Maillard Studio** = the logged-in web application / operational workspace
- **Purveyors CLI** = the terminal / agentic interface

### Pushback

Do **not** flatten those into one undifferentiated "API" label everywhere. That creates a new problem:

- external product brand gets blurred with
- internal dashboard routes and
- internal app JSON endpoints

So the fix is **not** "rename everything back to Parchment API". The fix is:

- use **Parchment API** for the marketed endpoint product
- keep **API Dashboard** or **Parchment API Dashboard** for the authenticated dashboard surface
- keep internal app routes documented as internal, not branded product surfaces

---

### 2. Two distinct catalog routes comment: what it really means

This is a real concern, and it is more than wording.

There are two catalog-serving surfaces today with very different semantics:

- **`/api/catalog-api`**

  - external-facing
  - API-key authenticated
  - rate-limited
  - intended as a stable contract for integrations
  - should evolve cautiously, with explicit compatibility expectations

- **`/api/catalog`**
  - internal app endpoint
  - session-auth / app-context tuned
  - optimized for the web app's filters, pagination, dropdown mode, and UI needs
  - not a stable public contract

These are easy to confuse because both say "catalog" and both live under `/api/*`.

### Pushback

Docs clarification is necessary, but **docs alone are not the full fix**.

Long term, the internal route namespace is still too confusing for a product that is leaning harder into Parchment API. A later follow-up should consider renaming internal JSON endpoints to something like:

- `/api/internal/catalog`
- or `/internal-api/catalog`
- or another explicit app-only namespace

That route rename is probably **out of scope for the PR 178 docs respin**, but the plan should call it out as intentional tech debt rather than pretending the naming is ideal.

---

### 3. CLI/web shared business logic via imports

**Directionally good.**

This is a real strength. The CLI is not just another client; it is part of the product architecture and already acts as a reusable engine for agent and app workflows.

### Pushback

Direct cross-imports are useful, but they are also a coupling signal.

If the web app imports CLI modules directly, the real architectural conclusion is:

- shared business logic belongs in reusable domain modules
- CLI, web, and AI surfaces should be adapters on top of that core

So the docs should frame this as:

- **current pattern:** shared logic is reused through CLI imports
- **desired direction:** extract reusable domain/core modules so shared logic does not have to live in CLI-shaped code forever

Do **not** oversell the current state as "finished architecture". It is a good stepping stone, not the end state.

---

### 4. Analytics positioning across API, web app, and CLI

This is the most important strategic section.

Your instinct is right: analytics is not some sidecar. It is core product value and should eventually exist coherently across:

- web app
- CLI
- Parchment API

### The valid pushback from the audit

The audit was correctly describing the **current shipped state**, not the final strategy.

Today:

- analytics is a major product surface in the web app
- analytics is not yet a fully externalized API-key product family
- docs should not claim that it already exists externally if it does not

### Better framing for the revised docs

Use wording closer to this:

> Analytics is a core Purveyors product surface. Today it is delivered primarily through the web app, with CLI and external API expansion planned. Public Parchment API endpoint families for analytics are part of the product direction, but not yet fully shipped as stable external contracts.

That preserves honesty **and** preserves strategy.

---

### 5. Role simplification idea

The instinct to simplify is good. The current role model is messy.

Current code still contains:

- `viewer`
- `member`
- `ppi-member`
- `api-member`
- `api-enterprise`
- `admin`
- plus legacy snake_case mappings in some places

### Pushback

Do **not** solve this by quietly editing docs first and deleting role names in prose.

That would create a truth gap between:

- auth logic
- billing logic
- API rate-limit logic
- analytics gating
- dashboard labels
- docs

The real problem is that roles are doing too many jobs at once:

- subscription tier
- entitlement bundle
- API plan
- internal permission model

### Recommended stance

For the PR 178 docs respin:

- document the **current shipped truth** accurately
- remove obviously stale framing
- avoid presenting speculative simplifications as already implemented

For a later product/infra refactor:

- move toward **base roles + entitlements/add-ons**, for example:
  - base role: `viewer | member | admin`
  - API plan entitlement: `free | pro | custom`
  - analytics entitlement as part of member or as an explicit feature entitlement

### Specific feedback on your suggested collapse

- **`ppi-member` → member**: probably right strategically if analytics is core to member value
- **`api-viewer` → viewer**: probably right, and the code already trends this way conceptually
- **`api-enterprise` delete**: maybe right eventually, but not until billing, rate-limit overrides, and customer-specific handling are replaced with a real contract model

So: **agree with direction, disagree with doing it implicitly inside this docs/routing revision.**

---

### 6. Deprecated routes guidance

**Agree**, with one improvement.

If docs say some routes are deprecated for new chat/agent tooling, the docs must also tell readers what to use instead.

So every deprecated-route mention should include:

- what it is
- why it is legacy
- what replaces it
- whether it is still safe for backwards compatibility

A deprecation note without a migration target is half documentation.

---

## Recommended product / docs IA after the re-audit

### Public surfaces

- `/` = public homepage
- `/api` = public Parchment API marketing page
- `/docs` = public docs hub
- `/docs/api/*` = public conceptual + reference docs for external API consumers
- `/docs/cli/*` = public CLI docs and agent-integration docs

### Authenticated surfaces

- `/dashboard` = logged-in app home
- `/api-dashboard` = authenticated Parchment API dashboard / gateway
- `/api-dashboard/docs` = authenticated docs entry point, account-aware gateway, or wrapper into shared docs content

### Internal surfaces that should not be marketed as product entry points

- `/api/catalog`
- `/api/tools/*`
- `/api/workspaces/*`
- other app-only JSON handlers

### Important rule

There should be **one canonical docs content source**, not two drifting docs sets.

That means either:

1. `/docs/*` is canonical and `/api-dashboard/docs` is a contextual gateway into it, or
2. both routes render shared content from the same source modules

But do **not** hand-maintain separate detailed docs trees with different wording.

---

## Scope for the PR 178 respin

### In scope

- Re-audit PR 178 against current main after PR 179 merge
- Restore correct Parchment API naming where the prior refresh over-corrected it away
- Align `/api`, `/api-dashboard`, `/api-dashboard/docs`, and `/docs` messaging with the new routing model
- Explicitly document external-vs-internal catalog surfaces
- Update analytics wording to distinguish current shipped state vs product direction
- Align coffee-app CLI documentation language with purveyors-cli PR #58
- Add explicit deprecation/migration notes where legacy routes are still documented
- Resolve merge conflicts caused by PR 179 and other recent changes

### Out of scope

- Actual role deletion / billing migration
- Internal route namespace rename (`/api/catalog` → `/api/internal/catalog`)
- Shipping new analytics API-key endpoint families
- Reworking core auth architecture
- Rewriting CLI behavior itself

---

## File strategy

### High-conflict files from PR 178

These need careful manual review against current `main` because PR 179 already changed nearby behavior:

- `src/routes/+layout.svelte`
- `src/lib/components/layout/UnifiedHeader.svelte`
- `src/lib/components/layout/Navbar.svelte`
- `src/routes/api/+page.svelte`
- `src/routes/api/+page.server.ts`

### Lower-risk docs/content files to port selectively

- `src/lib/docs/content.ts`
- `src/routes/docs/+page.svelte`
- `src/routes/docs/[section]/+page.server.ts`
- `src/routes/docs/[section]/[slug]/+page.server.ts`
- `src/routes/docs/[section]/[slug]/+page.svelte`
- `src/routes/api-dashboard/docs/+page.svelte`
- `src/routes/api/docs/+page.*` if still needed for redirect/back-compat
- `src/routes/llms.txt/+server.ts`
- `README.md`
- `AGENTS.md`
- `src/lib/components/docs/DocsShell.svelte`
- `src/lib/components/marketing/Features.svelte` only if its copy actually changed for docs/IA reasons

### Guidance

Do **not** blindly replay PR 178's versions of layout/header/nav files. Port only the copy, links, and IA changes that still make sense after PR 179.

---

## Implementation phases

## Phase 0: Audit and branch setup

1. Start a **fresh branch from current `main`**.
2. Diff PR 178 against current `main`.
3. Identify overlap with PR 179 and any newer merged work.
4. Decide whether to:
   - close PR 178 and replace it, or
   - force-update its branch if conflict scope is small

**Recommendation:** open a replacement PR if the diff starts fighting routing/layout files too hard.

---

## Phase 1: Naming and IA correction

1. Restore **Parchment API** naming where it refers to the external endpoint product.
2. Keep **API Dashboard** as the authenticated product-workspace label, or rename to **Parchment API Dashboard** if that feels clearer.
3. Update `/api` copy so it clearly markets the Parchment API product line.
4. Update `/api-dashboard` and `/api-dashboard/docs` so they read as authenticated operational/detail surfaces, not duplicate marketing pages.
5. Confirm header/nav labels still make sense after 179's routing updates.

**Acceptance check:** a user can tell the difference between:

- marketing page
- logged-in dashboard
- public docs
- internal app API routes

---

## Phase 2: Catalog semantics clarification

1. Add an explicit docs section for **External Catalog API vs Internal Catalog App Route**.
2. Document:
   - auth model
   - intended audience
   - stability expectations
   - rate limits / caching
   - whether each route is safe for third-party integrations
3. Ensure contributor docs do not imply that `/api/catalog` is the public integration contract.
4. Add a follow-up note in the plan/PR description that the internal naming remains a future cleanup candidate.

---

## Phase 3: Analytics positioning rewrite

1. Rewrite analytics docs language so it reflects:
   - shipped today in web app
   - intended across product surfaces
   - external API roadmap not fully shipped yet
2. Remove wording that implies analytics is either:
   - already a mature external API family, or
   - permanently only a web page
3. If docs mention gating/tiers, ensure they describe **current** gating truthfully.
4. Avoid using docs to silently implement the role simplification proposal.

---

## Phase 4: CLI alignment with PR 58

Cross-check coffee-app docs against purveyors-cli PR #58 and align on these points:

1. Catalog access/auth wording is consistent
2. No stale `--json` expectations appear in coffee-app docs if the CLI does not support them in those places
3. `catalog similar` output caveat is documented consistently if referenced
4. CLI/agent integration docs reflect the same current command surface and positioning
5. Shared CLI/web business-logic pattern is described consistently in both repos

**Important:** do not just say "CLI docs aligned." Verify wording against the actual merged CLI PR.

---

## Phase 5: Deprecated routes and migration guidance

1. For each deprecated route documented in PR 178:
   - mark it as legacy
   - describe who still uses it
   - point to the preferred replacement
2. Update `llms.txt` and any agent-facing docs to prefer the current blessed surfaces.
3. Keep back-compat notes where needed, but do not market deprecated routes as recommended integration paths.

---

## Acceptance criteria

- [ ] Parchment API naming is restored where it refers to the external API product line
- [ ] `/api`, `/api-dashboard`, `/api-dashboard/docs`, and `/docs` tell a coherent, non-duplicative story
- [ ] Docs clearly distinguish external API contracts from internal app-only JSON endpoints
- [ ] Analytics docs reflect current shipped reality without undermining long-term API strategy
- [ ] Coffee-app docs align with merged purveyors-cli PR #58 wording where overlapping topics exist
- [ ] Deprecated routes include explicit migration guidance
- [ ] No PR 179 routing/shell behavior is accidentally regressed while porting PR 178 docs work
- [ ] Resulting branch merges cleanly on top of current `main`

---

## Validation plan

### Content / architecture validation

- Read the final public pages in sequence:
  - `/api`
  - `/docs`
  - `/docs/api/*`
  - `/docs/cli/*`
  - `/api-dashboard`
  - `/api-dashboard/docs`
- Confirm there is no contradiction in naming, audience, or route purpose

### Technical validation

- `pnpm check --fail-on-warnings`
- `pnpm lint`
- route smoke for touched public pages if practical
- spot-check authenticated `/api-dashboard` and `/api-dashboard/docs`

### PR review checklist

- confirm no reintroduction of pre-179 sidebar/header behavior
- confirm nav labels still match current routing
- confirm docs do not claim features that are still roadmap only

---

## Recommended sequencing after this PR

### Ship now in the docs respin

- naming correction
- IA correction
- catalog route distinction
- analytics wording correction
- CLI docs alignment
- deprecated-route guidance

### Defer to follow-up technical PR(s)

- entitlement/role simplification
- internal API namespace cleanup
- analytics external endpoint rollout
- contract/versioning cleanup for public API families

---

## Bottom line

The high-level direction is good, but the plan should avoid two traps:

1. **using docs to paper over unresolved architecture**
2. **letting current implementation quirks harden into product strategy accidentally**

The right move is a careful PR 178 respin that:

- preserves the routing wins from PR 179
- restores the correct Parchment API product framing
- clearly separates public API contracts from internal app endpoints
- aligns with CLI docs PR #58
- defers role-model simplification until it is implemented as a real entitlement decision, not a prose edit
