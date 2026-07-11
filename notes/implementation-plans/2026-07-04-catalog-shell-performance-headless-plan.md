# Catalog Shell Performance and Headless Loading Plan

**Status:** Proposed
**Date:** 2026-07-04
**Owner:** coffee-app, with Parchment API support where cache headers or contract metadata belong upstream

## Goal

Improve first contentful paint, perceived reactivity, and loading clarity on the public catalog without weakening the headless architecture.

The target is not "make coffee-app smarter." The target is a better reference client: coffee-app should render a useful shell immediately, keep already-visible catalog rows stable during interactions, and use Parchment as the only source of catalog semantics, entitlements, projection, strict-vs-lenient handling, and freshness metadata.

## ADR and Strategy Audit

Read and applied:

- `notes/PRODUCT_VISION.md`
- `notes/decisions/002-api-first-external-internal-split.md`
- `notes/decisions/003-public-analytics-three-chart-free-gate.md`
- `notes/decisions/004-processing-transparency-schema-api.md`
- `notes/decisions/005-catalog-access-level-positioning.md`
- `notes/decisions/007-headless-api-extraction-web-as-reference-client.md`
- `parchment-api/docs/adr/PADR-0001-separate-private-api-repo.md`
- `parchment-api/docs/adr/PADR-0003-strict-headless-boundary.md`
- `parchment-api/docs/adr/PADR-0012-hard-cutover-no-legacy-endpoints.md`
- `parchment-api/docs/adr/PADR-0013-canonical-product-entitlement-schema.md`
- `parchment-api/docs/adr/PADR-0014-pricing-and-metering-model.md`
- `parchment-api/docs/adr/PADR-0015-bff-topology-token-custody.md`
- `parchment-api/docs/adr/PADR-0016-write-auth-ownership-model.md`
- `parchment-api/docs/SPEC.md` and the public-demo migration plan sections relevant to catalog credentialing

## Alignment Constraints

These are non-negotiable for the implementation:

1. **Parchment owns product logic.** Catalog filtering, projection, entitlement, row scope, strict-vs-lenient behavior, metering, and freshness semantics belong in Parchment. coffee-app may broker credentials, call the SDK, render controls, shape presentation, and surface notices.
2. **coffee-app stays a shell and reference client.** It should not reintroduce direct Supabase catalog reads, duplicated filter logic, local entitlement decisions, local origin aggregation, or local cache truth.
3. **Browser traffic stays behind the thin BFF.** PADR-0015 rejects browser-direct calls to `api.purveyors.io`. Browser code should call same-origin coffee-app endpoints or SvelteKit load functions, never hold API keys or long-lived bearer tokens.
4. **Direct API callers stay strict.** `/v1/*` API-like routes must preserve machine correctness. A browser UX can be lenient and show stripped-filter notices; a machine API caller must get structured 4xx rather than silent wrongness.
5. **Public proof is not member leverage.** Anonymous and viewer surfaces may prove catalog breadth, freshness, and data richness. Advanced filters, process facets, semantic search, saved searches, exports, wholesale/full-catalog visibility, and deeper charts stay member/API-entitled.
6. **Caching is a projection-level optimization.** The public/demo projection can be shared-cacheable. Authenticated/member/API-key projections are private or must vary by resolved entitlement/account. A cache must never bypass Parchment authorization, projection, or direct API metering.

## Current Implementation Findings

The catalog is now directionally headless, but the rendering model is still "wait for the whole server result, then hydrate":

- `src/routes/catalog/+page.server.ts` synchronously waits for catalog rows, optional deep-link enrichment, origin price stats, tracked lot ids, brief match summaries, schema graph generation, and metadata before returning.
- `src/routes/catalog/+page.svelte` shows `CatalogPageSkeleton` whenever `$filterStore.isLoading`, which replaces the whole page during client filter fetches instead of keeping stale rows visible.
- `src/lib/stores/filterStore.ts` manually mutates `history.replaceState` and fetches `/v1/catalog`, bypassing SvelteKit navigation state and using the API-like path rather than an explicit first-party UI data path.
- Supporting browser-called endpoints use mixed credential behavior. SSR catalog loads correctly choose `public-demo` or `session`, but client-triggered fetches still need a single first-party web/BFF contract so anonymous public catalog interactions do not fall into strict/API behavior.
- `src/routes/+layout.svelte` has no route-level pending indicator, so slow navigations and slow server loads feel inert.

## Architecture Decision for This Plan

Use a two-lane read model:

1. **Website lane:** browser and SSR page loads call a first-party same-origin BFF path that uses `resolveCatalogCredentialMode()` and `Prefer: handling=lenient`. Anonymous website reads use the server-only public-demo key. Logged-in website reads forward the session. The response includes effective state/notices so the UI never claims stripped filters are active.
2. **Machine lane:** API-like routes preserve strict behavior. They forward the caller credential and do not inject website leniency or public-demo fallback. These routes should not become the catalog page's client-side fetch path.

This matches PADR-0013 and PADR-0015: same canonical API, two consumer ergonomics, one enforcement point.

## Caching Decision

Caching is useful, but only inside the entitlement boundary.

Allowed:

- Shared cache for public-demo/public catalog projection, facets, proof coverage, and origin-price stats.
- Short TTL plus stale-while-revalidate for anonymous public pages and public-demo BFF reads.
- Server-side response cache in Parchment keyed by normalized query, route, projection version, public/demo principal, and data freshness watermark.
- Browser memory cache for recent catalog UI queries, keyed by normalized URL state and invalidated on role/session changes.
- Freshness labels in UI when the API marks data stale or cache-served.

Not allowed:

- Shared caching of member/session/API-key catalog responses unless the cache key varies by account/resolved entitlement and is private to that account.
- CDN caching that causes direct API-key traffic to skip Parchment request observability or metering.
- coffee-app-owned cache entries that widen data beyond the current API response.
- Cache-based workarounds for missing Parchment capabilities or slow queries that should be fixed upstream.

Recommended defaults:

- Public-demo catalog/facets/origin stats: `Cache-Control: public, s-maxage=30, stale-while-revalidate=300`.
- Authenticated website BFF reads: `Cache-Control: private, max-age=0, must-revalidate` unless a later account-varying private cache is explicitly designed.
- Direct API-key reads: no shared cache by default; optimize in Parchment query/cache internals while still executing the API request path.
- Public SSR `/catalog` page without session: short shared cache only if no cookies or auth state are present, with a conservative `Vary` policy and a verification test proving member/session output is never cached into anonymous output.

## Implementation Program

### PR 1: First-party catalog UI data contract

Repo: `coffee-app`

Purpose: fix the client-fetch lane before optimizing UI behavior.

Deliverables:

- Pick one first-party browser data path for catalog UI refreshes. Preferred: make `/api/catalog` the website/BFF data path because it is already described as the legacy in-app catalog endpoint. If external compatibility makes that risky, add a clearly named UI path such as `/api/catalog/ui`.
- That endpoint must call `createParchmentServerClient(event, { mode: resolveCatalogCredentialMode(event.locals), preferHandling: 'lenient' })`.
- Keep `/v1/catalog` and `/api/catalog-api` strict/API-like. Browser filter interactions should stop using `/v1/catalog`.
- Update `filterStore.fetchServerData()` to call the website BFF path.
- Update `/api/catalog/filters` to use the same credential-mode decision and lenient website handling for browser dropdown metadata.
- Preserve explicit 401 behavior for invalid `Authorization` headers where the endpoint accepts them, so a bad credential cannot silently downgrade to public-demo.
- Relay Parchment `meta.notices` or equivalent stripped-filter metadata to the page store.

Acceptance:

- Logged-out `/catalog` filter changes work through public-demo credentialing and do not 401.
- Logged-in viewer/member behavior matches Parchment's resolved entitlement.
- Direct `/v1/catalog` API behavior remains strict and machine-safe.
- Tests cover anonymous website fetch, member session fetch, invalid auth header, and direct API strictness.

### PR 2: Stale-while-revalidate catalog interactions

Repo: `coffee-app`

Purpose: make the page feel reactive without changing backend semantics.

Deliverables:

- Replace full-page skeleton replacement during filter/sort/page changes with stale-while-revalidate behavior.
- Keep current rows visible while a new query is pending.
- Add a slim progress affordance near the result count and a subtle grid dim/overlay for pending updates.
- Disable only controls that would create conflicting requests; do not freeze the whole page.
- Add request cancellation and request-id protection so slow responses cannot overwrite newer filter state.
- Surface stripped-filter notices from Parchment as inline catalog messages and clear the local active-filter state when the API strips a lenient website filter.
- Keep true initial-empty state skeletons for first mount only, not every subsequent fetch.

Acceptance:

- Applying a filter keeps existing cards visible until the response arrives.
- A slower earlier response cannot overwrite a later interaction.
- Unentitled direct URL filters do not appear active after Parchment strips them.
- Component/store tests cover pending, stale, success, error, and stripped-notice states.

### PR 3: Split critical SSR from non-critical enrichment

Repo: `coffee-app`

Purpose: improve first paint while preserving SEO and shareability.

Deliverables:

- Keep the first catalog page rows, public SEO metadata, and authorized URL state synchronous in `+page.server.ts`.
- Move origin price stats to a streamed promise or client-side section loader. The grid should render without waiting for it; cards can hydrate price context as it arrives.
- Move tracked-lot ids and brief match summaries behind authenticated-only deferred loads. Public catalog render should never wait on user-specific watchlist/procurement enrichment.
- Keep deep-link coffee enrichment bounded. If the linked coffee is off-page, render the main page first and hydrate the deep-linked card/detail state after the first rows instead of blocking the entire response.
- Keep schema generation cheap or precomputed. If schema graph creation becomes measurable, limit it to visible rows and/or cache it with the public page projection.

Acceptance:

- Public catalog server load has one critical Parchment list call on the main path.
- Origin stats, tracked ids, and brief matches can fail or delay without blanking the catalog.
- Member-only enrichments remain private and are not included in public cacheable output.
- Page server tests verify degraded enrichment behavior.

### PR 4: App-shell navigation progress

Repo: `coffee-app`

Purpose: make route changes feel alive across the app, not just catalog.

Deliverables:

- Add a thin top loading bar or header-level pending indicator driven by SvelteKit navigation state in `src/routes/+layout.svelte` or a small layout component.
- Keep it quiet and utilitarian: no card, no marketing copy, no decorative animation.
- Make it accessible with `aria-live` only when useful and avoid layout shift.
- Add focused tests for visibility across navigation state if the current test stack can model it.

Acceptance:

- Navigating to a server-heavy route shows immediate progress.
- The indicator does not appear for tiny same-page state updates unless a route navigation is actually pending.
- No overlap with the unified header or mobile shell.

### PR 5: Parchment public projection cache headers and freshness metadata

Repo: `parchment-api`

Purpose: make public pages fast at the API boundary without weakening API authority.

Deliverables:

- Add cache headers for public-demo/public projection responses on catalog list, facets, proof coverage, and origin-price stats.
- Add `Vary`/cache-key tests proving authenticated/member/API-key responses cannot share public cache entries.
- Add response metadata such as `meta.freshness.generatedAt`, `meta.freshness.cacheStatus`, or a similar contract if the API does not already expose it.
- Keep API-key metering and observability in the request path. Do not put direct API-key catalog responses behind shared CDN caching as part of this slice.
- Add a data freshness watermark into cache keys if catalog updates are frequent enough that TTL alone creates stale UX.

Acceptance:

- Public-demo responses are cacheable with short TTL/SWR.
- Session/member/API-key responses are private or no-store unless an account-varying private cache is explicitly implemented.
- Tests assert headers for public-demo, viewer/session, member/session, and API-key principals.

### PR 6: Measurement and regression guardrails

Repo: `coffee-app`, with live timing checks against deployed preview after PRs above

Purpose: keep performance wins measurable.

Deliverables:

- Add a lightweight performance note or test script documenting live checks for:
  - TTFB for `/catalog`
  - first contentful paint
  - visible pending state on filter change
  - anonymous filter interaction success
  - member-only advanced filter behavior
- Add Playwright coverage where practical for:
  - logged-out catalog renders header, filters, and first rows without waiting for origin stats
  - filter change keeps stale rows visible and shows pending state
  - public process/advanced filter attempts show notice/upsell rather than active false state
- Keep Vercel Speed Insights for field data, but do not rely on it as the only verification signal.

Acceptance:

- The plan has a repeatable before/after measurement path.
- Public and member access-level behavior is verified in browser flows, not just unit tests.

## Sequencing Rationale

PR 1 comes first because user-visible loading polish should not be built on the wrong fetch lane. If browser code continues to hit strict API-like routes, public catalog interactivity will keep failing or drifting from SSR behavior.

PR 2 comes before deeper SSR splitting because it fixes the most obvious perceived-reactivity defect with the least architectural risk: do not blank the page for every query.

PR 3 then reduces actual first-paint blocking once the client interaction model is honest.

PR 4 generalizes the loading affordance to the app shell.

PR 5 belongs in Parchment because cache authority and freshness metadata are API contract concerns, not web-shell guesswork.

PR 6 turns the work into a measurable performance program instead of subjective polish.

## Risks and Mitigations

- **Risk: BFF becomes business logic again.** Mitigation: BFF routes may broker credentials, relay Parchment responses, translate transport failures, and reshape presentation envelopes only. Any new catalog semantics go to Parchment first.
- **Risk: public cache leaks member data.** Mitigation: shared cache only for public-demo/public projection; tests assert `Cache-Control` and `Vary` across principal classes.
- **Risk: API-key metering is bypassed.** Mitigation: no shared CDN cache for direct API-key responses in this program. API internals can cache query results after the request is observed.
- **Risk: stale UI lies about applied filters.** Mitigation: consume Parchment notices and effective state; local store must reconcile to the server-applied state.
- **Risk: loading polish hides real API latency.** Mitigation: PR 6 records TTFB/FCP and separates perceived UX from backend timing.
- **Risk: anonymous UX gets too powerful.** Mitigation: PRs must honor ADR-005. Public proof remains broad but shallow; advanced leverage remains member/API-entitled.

## Out of Scope

- Moving browser calls directly to `api.purveyors.io`.
- Reintroducing direct Supabase catalog reads in coffee-app.
- New paid entitlements or checkout changes.
- New advanced public filters.
- Semantic search, saved searches, exports, or member-only charts.
- Large visual redesign of catalog cards, navigation, or marketing pages.
- Any destructive cutover of remaining legacy routes without the separate whole-surface parity gate Reed owns.

## Validation Commands

Coffee-app PRs:

```bash
pnpm check --fail-on-warnings
pnpm lint
pnpm test -- --run src/routes/catalog src/lib/stores/filterStore.test.ts src/lib/catalog/urlState.test.ts
pnpm build
```

Parchment API PRs:

```bash
pnpm check
pnpm lint
pnpm test -- --run packages/api/test/catalog
pnpm build
```

Live smoke checks after preview deploy:

```bash
curl -I 'https://<preview>/catalog'
curl -i 'https://<preview>/api/catalog?limit=15&country=Colombia'
curl -i 'https://<preview>/v1/catalog?limit=15&processing_base_method=Washed'
```

Expected distinction: the website BFF path is lenient/public-demo aware for browser UX; the API-like path is strict and machine-safe.
