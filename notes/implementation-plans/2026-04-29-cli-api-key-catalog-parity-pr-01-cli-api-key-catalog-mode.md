# PR 1 Plan: CLI API-Key Catalog Mode

**Date:** 2026-04-29
**Repo:** `repos/purveyors-cli`
**PR goal:** Allow read-only catalog commands to use the canonical `/v1/catalog` API-key contract in headless environments.

## Why this slice is first

The product behavior has to exist before coffee-app docs advertise it. This PR is independently shippable because it makes the CLI more useful even if no docs follow-up lands immediately.

## Mergeable-slice gate

This PR can pass verify and be mergeable on its own. A user with `PARCHMENT_API_KEY` or `PURVEYORS_API_KEY` can run catalog read commands without stored OAuth credentials. Existing session-backed catalog commands still work.

## In scope

- Add an API-key catalog client that calls `GET /v1/catalog`.
- Support `PARCHMENT_API_KEY` and `PURVEYORS_API_KEY`, with `PARCHMENT_API_KEY` documented as preferred.
- Map current `catalog search` flags to `/v1/catalog` query params where contract equivalents exist.
- Preserve current output modes: default JSON, `--json`, `--pretty`, and `--csv`.
- Preserve existing parse validation and error-envelope behavior.
- Keep session auth behavior working.
- Add tests for no-session API-key catalog search and stats.

## Out of scope

- Inventory, roast, sales, tasting, or any write command API-key mode.
- API-key creation or Parchment Console changes.
- Changing `/v1/catalog` response shape.
- Coffee-app public docs changes.
- Global CLI publish automation.
- Reworking OAuth login.

## Specific files likely to change

- `src/commands/catalog.ts`
- `src/lib/catalog.ts`
- New or existing HTTP helper under `src/lib/`, for example `src/lib/parchment-api.ts`
- `src/lib/auth-guard.ts` only if a small helper is needed to detect optional auth state without throwing
- `tests/*catalog*` or CLI output contract tests
- `README.md`
- `src/lib/manifest.ts`
- `src/commands/context.ts`, if the context text duplicates auth guidance
- `package.json`, with a patch or minor version bump per CLI release policy

## Acceptance criteria

- With no credentials file and `PARCHMENT_API_KEY` set, `purvey catalog search --origin Ethiopia --stocked --limit 5 --json` exits 0 and returns JSON rows.
- With no credentials file and `PURVEYORS_API_KEY` set, the same command exits 0 for backward compatibility.
- With neither session credentials nor API key, catalog commands keep returning the existing `AUTH_ERROR` guidance.
- With valid session credentials, existing direct session catalog behavior still works unless an explicit API-key mode is chosen.
- `catalog stats` works in API-key mode and states or tests that stats reflect public API-visible catalog data.
- `catalog get <id>` works in API-key mode by using an `ids=<id>` or equivalent `/v1/catalog` request.
- `catalog similar` is either clearly kept session-only or given an explicit product decision before API-key support is added. Do not silently fake parity.
- Member-only commands still reject API-key-only auth.
- Tests cover success, missing key/session failure, bad key HTTP 401 mapping, output modes, and unsupported API-key command boundaries.

## Verification commands

```bash
cd /root/.openclaw/workspace/repos/purveyors-cli
pnpm check
pnpm test

# no stored credentials path, API-key catalog read
TMP_HOME=$(mktemp -d)
PARCHMENT_API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-) \
HOME="$TMP_HOME" pnpm exec tsx src/index.ts catalog search --origin Ethiopia --stocked --limit 5 --json

PARCHMENT_API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-) \
HOME="$TMP_HOME" pnpm exec tsx src/index.ts catalog stats --json

# unsupported member command remains auth-bound
PARCHMENT_API_KEY=$(grep '^PURVEYORS_API_KEY=' ~/.env | cut -d= -f2-) \
HOME="$TMP_HOME" pnpm exec tsx src/index.ts inventory list --json
```

## Risks

- Mapping direct-Supabase filters to `/v1/catalog` may expose small semantic differences. Treat the canonical API as source of truth for API-key mode.
- API-key `catalog stats` may need pagination and can be slower than direct Supabase. Prefer `fields=dropdown&limit=1000` until a dedicated aggregate endpoint exists.
- `catalog similar` may not have a public API equivalent. Keep it session-only unless a separate endpoint is planned.
