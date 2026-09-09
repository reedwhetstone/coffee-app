# Local validation

Use this reference when source changes require static or E2E validation. Documentation-only changes follow the scoped validation in [AGENTS.md](../AGENTS.md).

## Environment contract

Fresh worktrees often need repo-local env setup before static validation succeeds. If required env vars are missing, report that as `VALIDATION_BLOCKED_ENV`, not `VALIDATION_FAIL`.

Validation command classes:

- `pnpm lint`
- `pnpm check --fail-on-warnings`
- `pnpm test`
- `pnpm test:e2e`

For static validation (`pnpm check --fail-on-warnings`), require:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ACCOUNT_DELETION_REAUTH_ISSUER`
- `ACCOUNT_DELETION_REAUTH_AUDIENCE`
- `ACCOUNT_DELETION_REAUTH_PRIVATE_KEYS`
- `ACCOUNT_DELETION_REAUTH_ACTIVE_KID`

For E2E (`pnpm test:e2e`), also require:

- `E2E_TEST_EMAIL`
- `E2E_TEST_USER_ID`
- `PLAYWRIGHT_BASE_URL` (optional, defaults to localhost)

Repo-local helpers:

```bash
pnpm worktree:bootstrap   # copy example env files and print required keys
pnpm env:check            # verify static validation env values
pnpm env:check:e2e        # verify E2E-specific env values
```

Rules:

- Placeholder values may unblock static validation, but they do not prove runtime or E2E behavior.
- Do not auto-copy secrets from outside the repo into a worktree.
- Do not describe this helper as a fix for detached-worktree module-resolution or stale temp-path install bugs. That is a separate reliability issue.

Reporting guidance:

- `VALIDATION_PASS`
- `VALIDATION_FAIL`
- `VALIDATION_BLOCKED_ENV`
- `VALIDATION_BLOCKED_SERVICE`
- `VALIDATION_CI_PENDING`
