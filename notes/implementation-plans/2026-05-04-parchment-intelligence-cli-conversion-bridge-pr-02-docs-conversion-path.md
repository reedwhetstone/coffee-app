# PR 2: Price-Index Docs and Conversion Path

**Date:** 2026-05-04  
**Repo:** `coffee-app`  
**Branch suggestion:** `docs/price-index-cli-conversion-path`  
**Purpose:** Align public docs and conversion copy around the shipped `/v1/price-index` API plus the released CLI command.

## PR goal

Make the machine-access story legible from the website: public analytics proves the value, `/v1/price-index` is the stable API-key contract, and `purvey intelligence price-index` is the agent/terminal path.

## Why this slice comes now

Docs should not advertise unreleased CLI behavior. After PR 1 lands and the CLI command name is stable, coffee-app can safely show API and CLI examples without creating stale product promises.

## In scope

- Update `src/lib/docs/content.ts` to include CLI examples for `/v1/price-index`.
- Update `src/lib/docs/content.test.ts` so docs assertions cover the API plus CLI distinction.
- Adjust `/analytics`, `/api`, or subscription copy only where it points to stable machine access.
- Clarify that `/analytics` is a web product surface while `/v1/price-index` and the CLI command are machine interfaces.
- Preserve cautious wording around entitlements, aggregate data, and unsupported surfaces.

## Out of scope

- Runtime route changes.
- New endpoint behavior.
- CLI implementation changes.
- CSV export, alerts, saved searches, watchlists, or webhooks.
- New blog posts or launch copy unless Reed explicitly asks.
- Billing or Stripe changes.

## Files to change

- `src/lib/docs/content.ts`
- `src/lib/docs/content.test.ts`
- Possibly copy in analytics/API/subscription components if existing text references machine access

## Acceptance criteria

- Docs show one curl example and one `purvey intelligence price-index` example.
- Docs state the required auth and entitlement boundary for `/v1/price-index`.
- Docs do not claim CSV export, alerts, webhooks, raw supplier rows, or Procurement Brief generation exists.
- Docs link public analytics value proof to API/CLI access without hiding the paywall boundary.
- Tests prevent docs from drifting back into unsupported premium surface claims.

## Test plan

```bash
cd /root/.openclaw/workspace/repos/coffee-app
pnpm check --fail-on-warnings
pnpm exec vitest run src/lib/docs/content.test.ts
```

## Risks

- If the CLI package has not been published, docs could mislead users. Gate this PR on release, or mention the exact upcoming CLI version.
- Docs can accidentally make analytics sound like a broad stable REST namespace. Keep the supported contract limited to `/v1/price-index`.

## Exact follow-on dependency

Depends on PR 1 merge and release/version clarity. If PR 1 stalls, this docs PR should not ship CLI examples.
