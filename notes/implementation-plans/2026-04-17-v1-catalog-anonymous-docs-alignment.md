# Implementation Plan: /v1/catalog docs truth alignment

**Date:** 2026-04-17
**Status:** Updated after PR #278 truth audit
**Focus area:** Docs accuracy / API contract correctness / cross-surface consistency
**Related:** `notes/PRODUCT_VISION.md`, `notes/decisions/002-api-first-external-internal-split.md`

## Audit outcome

PR #278 was originally written around a short-lived anonymous teaser contract. That is no longer the current codebase truth on `main`.

After re-checking the merged server behavior in `src/lib/server/catalogResource.ts` and `src/lib/server/catalogResource.test.ts`, the canonical contract is:

- anonymous `GET /v1/catalog` is allowed and remains public-only
- anonymous callers keep the same public query surface as viewer sessions and API-key callers
- if `page` is supplied without `limit`, pagination falls back to 15 rows
- if both `page` and `limit` are omitted, the canonical listing defaults to 100 rows
- `ids`, `fields=dropdown`, broader filters, and non-default sorting are still supported for anonymous public reads
- only API-key requests emit `X-RateLimit-*` headers
- privileged member or admin sessions may widen first-party visibility with `showWholesale` and `wholesaleOnly`
- `/api/catalog-api` remains a deprecated API-key-only alias with `Deprecation`, `Link`, and `Sunset` headers

So the right fix is not to document a teaser-only anonymous contract. The right fix is to align the docs with the broader public contract that `main` now enforces.

## Problem to fix

The catalog docs still had two accuracy issues worth carrying forward in this PR:

1. They blurred the access-mode differences across anonymous, session, API-key, and legacy alias callers.
2. The main example payload still foregrounded deprecated `cost_lb` naming instead of the canonical `price_per_lb` field.

## Minimal credible fix set

1. Resolve the branch conflict by taking the current `main` server behavior as truth.
2. Update `src/lib/docs/content.ts` so the catalog page says:
   - anonymous access is supported and public-only
   - anonymous, viewer-session, and API-key callers share the same public query surface
   - the 15-row fallback applies when `page` is supplied without `limit`
   - the 100-row default applies when both `page` and `limit` are omitted
   - only API-key requests emit `X-RateLimit-*` headers
   - privileged member and admin sessions can widen visibility with wholesale flags
3. Keep the example response on canonical `price_per_lb` naming.
4. Add a small docs regression test so the broad public contract language and pricing example do not silently drift again.

## Files in scope

- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`
- this implementation note

## Validation

- `pnpm exec vitest run src/lib/server/catalogResource.test.ts src/lib/docs/content.test.ts`
- `pnpm exec prettier --check src/lib/docs/content.ts src/lib/docs/content.test.ts notes/implementation-plans/2026-04-17-v1-catalog-anonymous-docs-alignment.md`

## Acceptance criteria

- `/docs/api/catalog` no longer describes anonymous `/v1/catalog` as a 15-row teaser-only surface
- the docs clearly distinguish anonymous, session, API-key, and legacy alias behavior
- the docs say anonymous callers are public-only but retain the same public query surface
- the docs say only API-key requests emit `X-RateLimit-*` headers
- the primary example uses `price_per_lb` and does not present `cost_lb` as the lead field
- merge conflicts are resolved against current `main` truth
