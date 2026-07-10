# Analytics streaming + route skeleton performance notes

Companion to the branch `claude/analytics-nav-loading-perf-rtenud`, which supersedes
PR #449 (analytics streaming) and PR #450 (client route skeletons) per review.

## What changed, in performance terms

### Cold `/analytics` first response (server)

Before, the route `load` awaited — in one blocking chain before the first byte —
the `market_daily_summary` read, then a 21-promise `Promise.all` (one full-catalog
count, two stocked exact counts, two full-catalog coverage paginations, eight
movement count queries, three 5k-row catalog evidence reads, four movement-row
reads), plus the market-insights fetch and the snapshot pagination.

After, the first byte blocks on exactly **one indexed read**
(`market_daily_summary`, `maybeSingle`). Everything else streams as three
independent promises:

- `analyticsCoverage` — exact counts, coverage pagination, movement counts
- `analyticsCharts` — snapshot pagination, catalog evidence, market insights
- `analyticsMember` — entitlement-gated datasets; resolves immediately with
  empties (no queries issued) for visitors who never render them

Anonymous visitors additionally skip the processing-mix and origin-range
catalog reads (three 5k-row queries) because those panels never mount for them.

This is guarded by the unit test
`builds the SSR preview from the market summary alone and streams the rest`,
which hangs every coverage query and asserts the route load still resolves.

### Persistent root chunk (client)

Measured with `pnpm build` (adapter-vercel, production) on this container,
comparing `origin/main` (7028dcb) against this branch. "Layout chunk" is the
chunk imported by `_app/immutable/nodes/0.*.js` (the root layout, loaded on
every page).

| Metric                  | main (before) | branch (after) | delta            |
| ----------------------- | ------------- | -------------- | ---------------- |
| Root layout chunk, raw  | 71,370 B      | 74,492 B       | +3,122 B (+4.4%) |
| Root layout chunk, gzip | 19,734 B      | 20,730 B       | +996 B (+5.0%)   |
| Total client JS, raw    | 1,933,399 B   | 1,949,985 B    | +16,586 B        |

The +3.1 KB raw / +1.0 KB gzip on the persistent chunk is the skeleton registry,
the `RouteSkeleton` host, and the delay-threshold logic. All nine destination
skeleton components are code-split behind dynamic imports (verified: the layout
chunk references them only via `import(...)`) and are prefetched when a
cross-route navigation starts. For reference, the superseded eager approach in
PR #450 added ~8.6 KB raw / ~2.2 KB gzip to the same chunk.

### Warm client navigation

- The thin `NavigationProgress` bar remains the immediate (0 ms) feedback.
- The current page stays mounted for the first `ROUTE_SKELETON_DELAY_MS`
  (125 ms) of a pending cross-route navigation, so fast and prefetched
  navigations never flash content → skeleton → content and never discard local
  component state.
- Only navigations still pending after the threshold swap in the
  destination-shaped skeleton.

## Runtime measurements still required before merge

Cold-load TTFB/FCP/LCP/CLS and warm-navigation latency depend on live Supabase
data and production networking, which this validation container cannot reach:
**VALIDATION_BLOCKED_SERVICE** for those metrics. Capture them on the Vercel
preview deploy for this branch versus production/main:

1. **Cold `/analytics`** — Lighthouse (mobile, Slow 4G, 4x CPU) against both
   deploys, logged-out and as a Parchment Intelligence user; record TTFB, FCP,
   LCP, CLS (median of 5 runs). Expect TTFB/FCP to drop roughly by the previous
   blocking-query time; CLS should not regress because streamed sections
   reserve geometry with the shared skeleton contract.
2. **Warm client navigation** — from `/catalog` to `/analytics` (and back) with
   the DevTools performance panel: time from click to destination content
   commit, plus a check that sub-125 ms navigations show only the progress bar
   (no skeleton flash) and >125 ms navigations show the destination skeleton.
3. Confirm no skeleton-to-skeleton layout shift on `/analytics`: the route
   skeleton and the page's streaming skeleton share `AnalyticsPageSkeleton`.
