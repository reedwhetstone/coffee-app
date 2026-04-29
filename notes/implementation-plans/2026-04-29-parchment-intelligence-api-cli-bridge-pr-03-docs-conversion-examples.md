# PR 3: Docs, Examples, and Conversion Coherence

**Date:** 2026-04-29  
**Repo:** coffee-app  
**Branch suggestion:** `docs/parchment-intelligence-api-examples`  
**Purpose:** Make the Parchment Intelligence API and CLI path legible across public docs and conversion surfaces.

## PR goal

After the endpoint and CLI exist, update public docs and product copy so `/analytics`, `/docs`, `/api`, `/subscription`, and CLI examples tell one coherent story about Parchment Intelligence.

## Why this slice comes now

The public analytics surface already proves value, but docs currently state that analytics is not a stable public REST API family. Once `/v1/price-index` and the CLI command exist, that copy needs to become more precise instead of stale.

## In scope

- Add or update a dedicated docs section for `/v1/price-index`.
- Add curl examples.
- Add CLI examples using the final PR 2 command name.
- Cross-link `/analytics`, `/docs/api/analytics`, `/api`, and `/subscription`.
- Clarify what is public web value versus Parchment Intelligence premium API value.
- Optionally create a blog outline for a future launch post under `notes/blog/outlines/`.

## Out of scope

- New endpoint behavior.
- New CLI behavior.
- Billing implementation changes.
- New paid pricing.
- SEO rewrite of the entire site.

## Files to change

- `src/lib/docs/content.ts`
- Public API landing copy if it references analytics or Parchment Intelligence
- Subscription page copy if needed for consistency
- Analytics CTA copy if it points to API or CLI access
- Optional `notes/blog/outlines/YYYY-MM-DD-*.md`

## Acceptance criteria

- Docs accurately describe `/v1/price-index` auth, entitlement, query params, response shape, and examples.
- Docs do not promise CSV, alerts, webhooks, or supplier-level raw rows unless those features have shipped.
- Public analytics docs distinguish web UI access from API-key access.
- CLI examples match the actual command and options from PR 2.
- Conversion copy uses consistent Parchment Intelligence language.

## Test plan

- `pnpm check`.
- Focused docs/page tests if present.
- Manual link review across affected routes.
- Verify examples point to existing endpoint and command names.

## Risks

- Docs can overpromise product behavior. Keep claims tied to shipped contracts only.
- If PR 2 renames the CLI namespace, examples must be updated before merge.
- Avoid expanding this into a full site conversion redesign.

## Exact follow-on dependency

Depends on PR 1. Preferably depends on PR 2 so CLI examples are real, but API-only docs can ship earlier if needed.
