# PR 02: Price-Index CLI Docs and Conversion Copy

**Date:** 2026-05-08  
**Repo:** `coffee-app`  
**Branch suggestion:** `docs/price-index-cli-conversion-copy`  
**Purpose:** After `purvey intelligence price-index` is released, align public docs and conversion copy around the web/API/CLI Parchment Intelligence ladder.

## PR goal

Update coffee-app docs so users understand the relationship between public analytics, paid `/v1/price-index` API access, and the released CLI command.

## Why this slice comes now

Docs should not advertise an unreleased command. This slice follows PR 01 after the CLI package is merged, tagged, and published. It is independently mergeable as a docs-only PR.

## In scope

- Add a `purvey intelligence price-index` example beside the existing `/v1/price-index` curl example.
- Clarify that `/analytics` is the web product surface, while `/v1/price-index` and the CLI are machine interfaces.
- Keep entitlement language precise: API key plus Parchment Intelligence access is required.
- Preserve unsupported-surface caveats: no raw supplier rows, CSV export, alerts, webhooks, or procurement recommendations.
- Update tests that assert docs content.

## Out of scope

- Any code behavior change outside docs/tests.
- New routes, new billing behavior, new API params, or CLI implementation.
- Blog draft publication. Blog source-map updates are optional only if the docs owner wants to mark the price-index launch idea as unblocked.

## Files to change

Likely files:

- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`
- Public API or analytics copy if it currently omits the released CLI path
- Optional planning/blog note files only if needed to keep launch dependencies accurate

## Acceptance criteria

- Docs include both curl and CLI examples for `/v1/price-index`.
- Docs state that the CLI command requires a released `@purveyors/cli` version that contains `purvey intelligence price-index`.
- Docs preserve the boundary between public analytics proof and paid API/CLI leverage.
- Tests prove docs include `/v1/price-index`, `purvey intelligence price-index`, auth/entitlement wording, and unsupported-surface caveats.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm exec vitest run src/lib/docs/content.test.ts
pnpm lint
pnpm check --fail-on-warnings
```

## Risks

- Docs can overclaim the analytics API surface. Keep the stable contract limited to aggregate `/v1/price-index` snapshots.
- Docs can race the CLI release. Do not merge until the CLI package is actually released.
- Conversion copy can blur Parchment Intelligence versus broader API plans. Keep product/access names exact.

## Exact follow-on dependency

None required. After this docs PR, the queued price-index blog idea can be considered separately if Reed wants a public launch post.
