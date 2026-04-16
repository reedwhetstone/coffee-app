# Macro Plan v2: Hard Cutover to Parchment Platform

**Date:** 2026-03-26
**Status:** Approved for implementation
**Decision update:** Because there are no active users yet, this rollout will use a **hard cutover** to the ideal product framework instead of a conservative adapter-first migration.

---

## Approved decisions

- Canonical public/product API namespace: `/v1/*`
- Public product naming should use the shipped product surfaces directly rather than a separate umbrella brand
- Endpoint product: **Parchment API**
- CLI product: **Parchment CLI**
- Dashboard name: **Parchment Console**
- Canonical docs location: **`/docs` only**
- `/api-dashboard/docs` will be removed/redirected
- App roles will be simplified to: `viewer | member | admin`
- API plans / product access will move to explicit entitlements/plans
- First-party app and external consumers will share one canonical product contract layer

---

## Core architecture target

### 1. Contract

One canonical, versioned resource surface under `/v1/*`.

### 2. Auth

One `resolvePrincipal()` flow normalizes:

- session-cookie auth for first-party app
- bearer API key auth for external/machine callers
- future OAuth token auth later

### 3. Authorization

Separate:

- **roles** for app permissions
- **plans/entitlements** for API limits and product access

### 4. Docs

One public docs tree at `/docs` for API + CLI + platform.

### 5. Product surfaces

- **Mallard Studio** = first-party application / showcase customer
- **Parchment API** = developer + data integration product
- **Parchment Intelligence** = premium analytics and market-intelligence product
- **Parchment Console** = authenticated developer dashboard

---

## Rollout strategy

This will be executed as a sequence of focused PRs, each independently verifiable.

### PR A — Principal foundation and `/v1` scaffolding

Build the normalized auth/principal layer and the shared contract foundation.

### PR B — Catalog hard cutover to canonical `/v1/catalog`

Make catalog the pilot canonical resource and cut internal/external surfaces over to the new contract.

### PR C — Role simplification + entitlement migration

Replace hybrid pseudo-roles with app roles plus explicit API/access plans.

### PR D — Parchment Console + docs consolidation

Rename the dashboard surface, remove `/api-dashboard/docs`, and make `/docs` canonical.

### PR E — Docs respin / replacement for PR #178

Rewrite the docs against the now-true architecture and corrected product naming.

---

## Non-negotiable rules

- Do not expose every current `/api/*` route as a public contract.
- Do not use a vague `isPrivileged` flag; use explicit scopes/entitlements.
- Do not keep two authored docs systems alive.
- Do not preserve pseudo-roles longer than necessary once the replacement entitlement model exists.
- Run `verify-pr` after each non-trivial implementation PR.

---

## Expected SQL point

The most likely schema-change PR is **PR C**. If DB changes are required, exact SQL will be generated and handed off before merge so it can be applied in Supabase console.

---

## Success criteria

- First-party app and external consumers share canonical product contracts
- Roles are simplified and no longer encode billing/plan semantics
- Docs reflect the actual architecture instead of compensating for inconsistencies
- Branding hierarchy is coherent across Mallard Studio, Parchment API, Parchment Intelligence, Parchment Console, CLI, and Docs
