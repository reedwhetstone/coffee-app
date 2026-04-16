#!/usr/bin/env bash
set -euo pipefail

if git rev-parse --show-toplevel >/dev/null 2>&1; then
  REPO_ROOT="$(git rev-parse --show-toplevel)"
else
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

cd "$REPO_ROOT"

CHECK_VARS=(
  PUBLIC_SUPABASE_URL
  PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
)

E2E_VARS=(
  E2E_TEST_EMAIL
  E2E_TEST_USER_ID
)

OPTIONAL_E2E_VARS=(
  PLAYWRIGHT_BASE_URL
)

print_file_status() {
  local file="$1"
  if [[ -f "$file" ]]; then
    printf '  [present] %s\n' "$file"
  else
    printf '  [missing] %s\n' "$file"
  fi
}

printf 'Repo root: %s\n' "$REPO_ROOT"
printf '\nEnv file status:\n'
print_file_status .env
print_file_status .env.local
print_file_status .env.test
print_file_status .env.test.example

if [[ ! -f .env.test && -f .env.test.example ]]; then
  printf '\nNo .env.test found. Copy .env.test.example to .env.test? [y/N] '
  read -r reply
  case "$reply" in
    y|Y|yes|YES)
      cp .env.test.example .env.test
      printf 'Created .env.test from .env.test.example\n'
      ;;
    *)
      printf 'Skipped copying .env.test.example\n'
      ;;
  esac
fi

printf '\nLocal validation env contract\n'
printf '  pnpm check --fail-on-warnings requires:\n'
for key in "${CHECK_VARS[@]}"; do
  printf '    - %s\n' "$key"
done

printf '\n  pnpm test:e2e additionally requires:\n'
for key in "${E2E_VARS[@]}"; do
  printf '    - %s\n' "$key"
done
for key in "${OPTIONAL_E2E_VARS[@]}"; do
  printf '    - %s (optional, defaults to localhost)\n' "$key"
done

printf '\nReporting guidance\n'
printf '  Use one of: VALIDATION_PASS, VALIDATION_FAIL, VALIDATION_BLOCKED_ENV, VALIDATION_BLOCKED_SERVICE, VALIDATION_CI_PENDING\n'

printf '\nNotes\n'
printf '  - Placeholder values may unblock static validation, but they do not guarantee runtime or E2E correctness.\n'
printf '  - This helper does not copy secrets from outside the repo. Fill values manually in repo-local env files.\n'
printf '  - This does not solve detached-worktree module-resolution or stale temp-path install issues.\n'

printf '\nSuggested next steps\n'
printf '  1. Fill repo-local env files (.env, .env.local, and optionally .env.test).\n'
printf '  2. Run node scripts/check-env-contract.mjs check before pnpm check --fail-on-warnings.\n'
printf '  3. Run node scripts/check-env-contract.mjs e2e before pnpm test:e2e.\n'
