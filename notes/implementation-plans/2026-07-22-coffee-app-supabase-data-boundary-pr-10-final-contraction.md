# PR 10: Coffee-app final shared-data boundary contraction

## PR goal

Remove residual shared-data compatibility code and lock coffee-app to the
explicit auth/workspace/billing Supabase boundary.

## Why this slice comes now

All capability cutovers have landed. This slice converts the temporary baseline
guard into the durable architecture rule.

## In scope

- Delete dead shared database types, admin-client callers, local API-key/rate
  limit helpers, and compatibility routes
- Remove shared table/RPC entries from the boundary manifest
- Tighten CI to allow only named auth, workspace/memory, and billing categories
- Update architecture, route, and deployment docs
- Cross-surface production canary matrix

## Out of scope

- Removing Supabase Auth
- Moving workspaces/user memory or Stripe/billing
- Dropping database objects without separate Parchment usage evidence

## Files to change

- dead `src/lib/data/` and `src/lib/server/` modules
- `src/lib/supabase-admin.ts` callers and database types
- legacy BFF/compatibility routes
- boundary scanner/manifest, docs, and tests

## Acceptance criteria

- Repository scan finds no active shared-data table/RPC access.
- The allowlist contains only explicitly retained web-local categories.
- `createAdminClient()` is absent outside those named categories.
- Public, viewer, Intelligence, member, admin, CLI, and SDK canaries pass.
- `notes/ARCHITECTURE.md` states the exact final boundary without claiming zero
  Supabase use.

## Test plan

- Full boundary scan and stale-manifest test
- coffee-app full check, test suite, lint/format, and build
- Parchment API/SDK smoke tests
- production canaries and error-rate observation

## Risks

- Premature deletion of compatibility routes. Require caller evidence and
  deprecation completion before removal.

## Follow-on dependency

None. Any later workspace/memory or billing extraction is a separately approved
program.
