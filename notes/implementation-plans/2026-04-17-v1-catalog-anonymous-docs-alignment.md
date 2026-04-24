# Implementation Plan: /v1/catalog docs truth alignment

**Date:** 2026-04-17
**Status:** Updated after PR #278 re-audit against current `main`
**Focus area:** Docs accuracy / API contract correctness / cross-surface consistency
**Related:** `notes/PRODUCT_VISION.md`, `notes/decisions/002-api-first-external-internal-split.md`

## Audit outcome

PR #278 was drafted from an assumption that anonymous `GET /v1/catalog` had widened to the same public contract as viewer sessions and API-key callers. That is not the current codebase truth on `main`.

After re-checking `src/lib/server/catalogResource.ts` and `src/lib/server/catalogResource.test.ts`, the current contract is:

- anonymous `GET /v1/catalog` is allowed and remains public-only
- anonymous access is intentionally teaser-only: first page only, capped at 15 rows, default `stocked=true`, default `stocked_date desc` sort, and only `country`, `processing`, and `name` filters
- anonymous callers cannot use `ids`, `fields=dropdown`, deep paging, or arbitrary filter combinations
- viewer sessions keep the broader public query surface while remaining public-only by default
- privileged member and admin sessions may widen first-party visibility with `showWholesale` and `wholesaleOnly`
- API-key requests stay public-only, use the broader public query surface, and are the only mode that emits `X-RateLimit-*` headers
- `/api/catalog-api` remains a deprecated API-key-only alias with `Deprecation`, `Link`, and `Sunset` headers

So the right fix is to resolve the merge conflict by taking current code behavior as truth, while still carrying forward the parts of this PR that improve docs clarity.

## Problem to fix

The current merge state still leaves three docs concerns worth fixing in this PR:

1. conflict markers block mergeability
2. the catalog page should explain the teaser-only anonymous contract more explicitly so it cannot be mistaken for the broader API-key or viewer-session surface
3. the main response example should continue to foreground canonical `price_per_lb` naming instead of centering deprecated `cost_lb` terminology

## Minimal credible fix set

1. Resolve the branch conflict by aligning all catalog docs text with current `main` behavior.
2. Update `src/lib/docs/content.ts` so the catalog page says:
   - anonymous access is teaser-only and public-only
   - viewer sessions keep the broader public contract
   - privileged member and admin sessions can widen visibility with wholesale flags
   - only API-key requests emit `X-RateLimit-*` headers
   - the default 100-row listing path applies to non-anonymous callers, while anonymous access stays capped at 15 rows
3. Keep the response example centered on canonical `price_per_lb` naming.
4. Add a small docs regression test so the anonymous teaser contract and API-key/session distinctions do not silently drift again.

## Files in scope

- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`
- this implementation note

## Validation

- `pnpm exec vitest run src/lib/server/catalogResource.test.ts src/lib/docs/content.test.ts`
- `pnpm exec prettier --check src/lib/docs/content.ts src/lib/docs/content.test.ts notes/implementation-plans/2026-04-17-v1-catalog-anonymous-docs-alignment.md`

## Acceptance criteria

- `/docs/api/catalog` describes anonymous `/v1/catalog` as a teaser-only public discovery path
- the docs distinguish anonymous, session, API-key, and deprecated alias behavior accurately
- the docs say only API-key requests emit `X-RateLimit-*` headers
- the docs say viewer sessions keep the broader public contract while member/admin sessions may widen visibility further
- the primary example keeps `price_per_lb` as the canonical price field shown to readers
- merge conflicts are resolved against current `main` truth
