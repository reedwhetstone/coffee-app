# Implementation Plan: Legacy Catalog Alias API-Key Boundary

**Date:** 2026-04-10
**Slug:** legacy-catalog-alias-api-key-boundary
**Status:** Ready for implementation
**Repo:** coffee-app
**Parent plan:** `2026-04-10-catalog-auth-context-and-contract-boundaries.md`
**Related:** ADR-002, ADR-004

## Why this slice

The parent plan is too broad for one daily builder run. This slice extracts the next smallest shippable step after the transport fix work: make `GET /api/catalog-api` enforce its legacy compatibility role instead of inheriting the anonymous-friendly `GET /v1/catalog` auth story.

## Scope

- Require API-key auth on `GET /api/catalog-api`
- Return explicit `401`/`403` JSON errors instead of anonymous fallback behavior
- Preserve `Deprecation`, `Link`, and `Sunset` headers on both success and auth failure paths
- Update docs copy anywhere that still describes `/api/catalog-api` as anonymous or session-capable
- Add route-level tests for the narrowed boundary

## Out of scope

- Transport middleware cleanup in `src/hooks.server.ts`
- Broader `/v1/catalog` contract tests
- Public docs overhaul beyond the specific `/api/catalog-api` auth statements

## Acceptance criteria

- Anonymous requests to `/api/catalog-api` return `401`
- Session-only requests to `/api/catalog-api` return `401`
- API keys without the needed access return `403`
- Successful API-key requests still delegate to the canonical catalog handler
- Every `/api/catalog-api` response still includes `Deprecation`, `Link`, and `Sunset`
- Docs no longer describe `/api/catalog-api` as an anonymous or session route
