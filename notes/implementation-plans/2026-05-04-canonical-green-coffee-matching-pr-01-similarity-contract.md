# PR 01: Similarity Contract Hardening

**Program:** Canonical Green Coffee Matching and Identity Resolution
**Status:** Proposed

## PR goal

Make the existing similarity infrastructure safe to build product surfaces on by returning canonical pricing, per-dimension explanation fields, and stable typed response shapes.

## Why this slice comes now

The shipped RPCs are useful but stale. They return `cost_lb` as the primary price field and expose only aggregate similarity. Any member comparison UI or API built on that would immediately bake in the wrong price contract and weak trust story.

## In-scope

- Add a migration that updates or versions `find_similar_beans` and `find_similar_beans_aggregated`.
- Include `price_per_lb` and `price_tiers` in similarity results.
- Keep `cost_lb` only as compatibility fallback.
- Add per-dimension scores for origin, processing, tasting, and optionally commercial/provenance chunks where available.
- Add beta/confidence labels in the normalized service shape so UI copy can avoid overclaiming.
- Add match category derivation at the service layer if DB-only categorization would be too rigid.
- Update `src/lib/types/database.types.ts`.
- Add server helper types for canonical similarity result objects.

## Out-of-scope

- Web UI.
- Public or member API endpoint.
- Identity tables.
- Auto-linking.
- CLI behavior changes.
- Caching.

## Files to change

- `supabase/migrations/*_canonical_similarity_contract.sql`
- `src/lib/types/database.types.ts`
- `src/lib/server/catalogSimilarity.ts` or equivalent new service helper
- `src/lib/server/catalogSimilarity.test.ts`
- Existing tests or fixtures that assume the old result shape

## Acceptance criteria

- Similarity output includes `price_per_lb` and `price_tiers` for every matched row where catalog data has them.
- `cost_lb` remains present only where backwards compatibility requires it.
- Result shape includes enough scoring detail to render "why matched" without another query.
- Result shape supports 1 lb baseline comparison now and price-tier side-by-side comparison later.
- TypeScript database types reflect the migration.
- No user-facing route exposes the feature yet.

## Test plan

- Unit test match result normalization.
- Unit test price fallback order: `price_tiers` and `price_per_lb` before `cost_lb`.
- SQL smoke query against a known embedded catalog row when environment permits.
- `pnpm check` and targeted vitest for new helper tests.

## Risks

- Changing existing RPC return columns can break CLI consumers. Prefer additive columns or a v2 RPC if Postgres function signature compatibility gets awkward.
- Per-dimension scores may be null for rows missing chunks. Preserve nulls rather than fake certainty.

## Exact follow-on dependency

PR 02 consumes this contract to expose `/v1/catalog/:id/similar` behind member/API entitlement.
