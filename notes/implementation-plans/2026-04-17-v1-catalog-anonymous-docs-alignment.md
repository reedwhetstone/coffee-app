# Implementation Plan: /v1/catalog anonymous contract docs alignment

**Date:** 2026-04-17
**Status:** Proposed
**Focus area:** Docs accuracy / API contract correctness / cross-surface consistency
**Related:** `notes/PRODUCT_VISION.md`, `notes/decisions/002-api-first-external-internal-split.md`, `notes/implementation-plans/2026-04-16-real-api-rate-limiting-plan.md`

## Selected improvement

Bring the public `/docs/api/catalog` reference back into alignment with the shipped anonymous versus API-key behavior of `GET /v1/catalog`, then add a regression guard so the docs cannot drift again on the next contract change.

This is the best small next slice because it is:

- user-facing and trust-critical
- directly evidenced by live requests today
- strategically aligned with the API-first product direction
- low-risk compared with deeper auth or quota redesign work

## Problem

The live endpoint behavior and the public docs currently tell two different stories.

### Live API evidence gathered on 2026-04-17

#### 1. Anonymous `GET /v1/catalog` no longer uses the 100-row default contract

Command:

```bash
curl -s https://www.purveyors.io/v1/catalog | python3 -c '
import json,sys
body=json.load(sys.stdin)
print(body["pagination"])
print(body["meta"]["auth"])
'
```

Observed response shape:

- `status: 200`
- `pagination.limit: 15`
- `pagination.totalPages: 1`
- `pagination.hasNext: false`
- `meta.auth.kind: anonymous`

That means the anonymous path is now a first-page teaser contract, not the broader 100-row canonical default described in the docs.

#### 2. Anonymous callers cannot use the full filter surface anymore

Command:

```bash
curl -s 'https://www.purveyors.io/v1/catalog?origin=Ethiopia&stocked=true&limit=5' \
  | python3 -m json.tool
```

Observed response:

```json
{
	"error": "Anonymous catalog contract violation",
	"message": "Anonymous catalog requests only allow filters: country, processing, name",
	"details": {
		"parameter": "origin"
	}
}
```

So the anonymous contract is intentionally narrow.

#### 3. API-key callers still get the broader integration contract

Command:

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)
curl -sSI https://www.purveyors.io/v1/catalog \
  -H "Authorization: Bearer $API_KEY"
```

Observed headers:

- `HTTP/2 200`
- `x-ratelimit-limit: 10000`
- `x-ratelimit-remaining: 9789`
- `x-ratelimit-reset: 1777593600`

And for filtered key-backed requests:

```bash
curl -s 'https://www.purveyors.io/v1/catalog?origin=Ethiopia&stocked=true&limit=5' \
  -H "Authorization: Bearer $API_KEY" | python3 -c '
import json,sys
body=json.load(sys.stdin)
print(body["pagination"])
print(body["meta"]["auth"])
print([row["name"] for row in body["data"][:3]])
'
```

Observed response shape:

- `status: 200`
- `pagination.limit: 5`
- `pagination.total: 120`
- `meta.auth.kind: api-key`
- `meta.auth.apiPlan: member`

#### 4. Legacy alias behavior is also different from anonymous `/v1/catalog`

Command:

```bash
curl -sSI https://www.purveyors.io/api/catalog-api \
  -H "Authorization: Bearer $API_KEY"
```

Observed headers:

- `deprecation: true`
- `link: </v1/catalog>; rel="successor-version"`
- `sunset: Thu, 31 Dec 2026 23:59:59 GMT`
- `x-ratelimit-limit: 10000`

Without a key, the same route returns `401 Authentication required`.

### Current docs drift

`src/lib/docs/content.ts` still describes the catalog route as if one generic query and pagination contract applies across all auth modes:

- intro copy says omitting `page` and `limit` defaults to up to `100` rows
- the query parameter table presents `origin`, `stocked`, `ids`, `fields=dropdown`, pagination, and sorting as if they are broadly available on the public route
- the docs do not clearly say that anonymous callers are restricted to first-page teaser behavior and only three allowed filters
- the example payload still shows deprecated `cost_lb` alongside `price_per_lb`

This creates a bad agent and developer experience: the public docs encourage requests that now fail for anonymous callers.

## Root cause analysis

The underlying product behavior changed faster than the docs model.

Specifically:

- `src/lib/server/catalogResource.ts` now enforces an anonymous-specific contract via `enforceAnonymousCatalogContract()`
- the anonymous path is capped to `ANONYMOUS_API_PAGE_LIMIT = 15`
- anonymous callers are restricted to the filter allowlist `country`, `processing`, and `name`
- docs in `src/lib/docs/content.ts` are still hand-authored around the older broader contract and do not consume a shared source of truth from the server resource
- there is no docs-level regression test that would fail when server-side anonymous behavior changes but prose/examples do not

So the issue is not that the API contract is undefined. The issue is that the contract is now mode-specific, while the docs still describe it as a single undifferentiated surface.

## Why this matters

This is strategically important because Purveyors is explicitly positioning the API as a public proof-of-value surface for developers and agents.

When a zero-context caller reads `/docs/api/catalog`, tries the documented route anonymously, and immediately hits contract violations, the result is not just docs polish debt. It weakens trust in the platform.

This is exactly the kind of drift that makes an API feel half-real.

## Proposed fix

### 1. Split the catalog docs into explicit access modes

Rewrite the catalog docs so `/docs/api/catalog` clearly distinguishes:

- anonymous discovery contract
- API-key integration contract
- first-party session behavior
- deprecated `/api/catalog-api` alias behavior

The docs should stop implying that every query parameter works for every auth mode.

### 2. Document the real anonymous contract

Add an explicit anonymous-access section that states:

- anonymous requests are for public discovery, not full integration use
- anonymous callers are limited to page 1
- anonymous responses clamp to a 15-row teaser page
- anonymous callers only allow `country`, `processing`, and `name`
- anonymous callers cannot use `origin`, `stocked`, `ids`, `fields=dropdown`, arbitrary sorting, or later pages
- anonymous callers do not receive `X-RateLimit-*` headers

### 3. Preserve the broader API-key contract in the same page

Keep the API-key path documented as the canonical production integration contract:

- broader query surface
- default 100-row contract when `page` and `limit` are omitted
- plan-based headers and row caps
- legacy alias deprecation behavior

This keeps ADR-002 intact while honestly describing the anonymous teaser boundary.

### 4. Fix stale examples and terminology

Update the example response and nearby prose so they reflect current canonical naming and current behavior:

- remove `cost_lb` from the primary example payload
- keep `price_per_lb` and `price_tiers` as the main documented pricing fields
- avoid language that suggests anonymous and API-key callers share the same practical query envelope

### 5. Add a regression guard

Prevent this from drifting again by creating a small docs contract test.

Preferred approach:

- export the anonymous contract constants from `catalogResource.ts`, or move them to a tiny shared constants module
- consume those values from `content.ts` where practical
- add a docs test asserting the catalog docs reference the same anonymous page limit and allowlist as the server contract

That follows the repo principle of never repeating truth.

## Proposed files to change

- `src/lib/server/catalogResource.ts`
  - export or centralize anonymous contract constants used by both server logic and docs
- `src/lib/docs/content.ts`
  - rewrite the catalog reference copy and tables around auth-mode-specific behavior
  - fix the example response payload
- `src/lib/docs/content.test.ts` or `src/lib/docs/catalog-docs-contract.test.ts`
  - add regression coverage so docs cannot silently drift from the shipped anonymous contract

Optional only if needed for presentation clarity:

- `src/lib/components/docs/DocsShell.svelte`
  - only if a small layout tweak helps present auth-mode callouts or warning boxes cleanly

## Acceptance criteria

- `/docs/api/catalog` explicitly distinguishes anonymous, session, API-key, and legacy-alias behavior
- the docs no longer claim that anonymous `GET /v1/catalog` defaults to 100 rows
- the docs explicitly state that anonymous callers are limited to page 1, 15 rows max, and the filter allowlist `country`, `processing`, `name`
- the docs explicitly state that API-key requests receive `X-RateLimit-*` headers and remain the intended production integration path
- the docs explicitly state that `/api/catalog-api` is API-key-only and deprecated, with successor link and sunset behavior
- the main JSON example uses canonical `price_per_lb` naming rather than documenting `cost_lb` as a primary field
- a test or shared-constant guard exists so a future change to anonymous limits or allowlist cannot land without touching docs

## Test plan

### Local static validation

- `pnpm check`
- `pnpm vitest run src/lib/server/catalogResource.test.ts src/lib/docs/content.test.ts`

### Live contract smoke checks

```bash
API_KEY=$(grep PURVEYORS_API_KEY ~/.env | cut -d= -f2)

# Anonymous teaser contract
curl -s https://www.purveyors.io/v1/catalog | python3 -c '
import json,sys
body=json.load(sys.stdin)
assert body["meta"]["auth"]["kind"] == "anonymous"
assert body["pagination"]["limit"] == 15
assert body["pagination"]["totalPages"] == 1
assert body["pagination"]["hasNext"] is False
print("PASS anonymous default teaser contract")
'

# Anonymous forbidden filter
curl -s 'https://www.purveyors.io/v1/catalog?origin=Ethiopia&limit=5' | python3 -c '
import json,sys
body=json.load(sys.stdin)
assert body["error"] == "Anonymous catalog contract violation"
assert body["details"]["parameter"] == "origin"
print("PASS anonymous allowlist enforced")
'

# API-key headers
curl -sSI https://www.purveyors.io/v1/catalog \
  -H "Authorization: Bearer $API_KEY" | rg 'x-ratelimit-limit|x-ratelimit-remaining|x-ratelimit-reset'

# Legacy alias deprecation headers
curl -sSI https://www.purveyors.io/api/catalog-api \
  -H "Authorization: Bearer $API_KEY" | rg 'deprecation|sunset|successor-version'
```

## Risk assessment

### Risk level

Low.

This is primarily docs and test work. It does not change auth, row-limit enforcement, or data access behavior.

### Main risks

- A docs-only edit without a shared source of truth could drift again on the next anonymous contract tweak.
- Over-correcting the page could accidentally make the API-key path sound narrower than it is.
- The docs may still conflate first-party session behavior with external API usage if the auth-mode sections are not written cleanly.

### Mitigations

- reuse shared constants for anonymous limits instead of duplicating them in prose wherever possible
- keep the page organized by auth mode, not by one blended route description
- verify each auth-mode example against live curls before merge

## Out of scope

- implementing anonymous abuse throttling or real burst limiting
- changing API-key quota accounting architecture
- redesigning plan limits or billing copy
- changing CLI auth flows
- broad docs IA or public discoverability work outside the catalog contract page
- changing the shipped anonymous contract itself

## Strategy Alignment Audit

- **Canonical direction:** Strongly aligned with `notes/PRODUCT_VISION.md`. Purveyors is explicitly building a stable v1 API for developers and agents. Trustworthy docs are part of the product, not marketing garnish.
- **API-first contribution:** This improves the shared platform contract used by web, CLI, docs, and agent consumers. It reduces contract ambiguity instead of adding a one-off surface fix.
- **Public value legibility:** Public docs are a proof-of-value surface. Honest anonymous versus API-key guidance makes the platform feel more real, more usable, and more trustworthy.
- **Cross-surface consistency:** Clarifies the distinction between anonymous HTTP discovery, API-key integrations, and account-linked CLI usage. That makes the web/docs/CLI story easier for humans and agents to navigate.
- **Scope discipline:** Intentionally excludes deeper rate limiting, auth redesign, and CLI login work. This slice only fixes the contract-description layer and adds a regression guard.

## Recommended next action

Implement this as a small docs-and-tests PR before doing another round of API product promotion. Right now the public contract is stronger than the docs, which is backwards from what first-time developers and agents experience.
