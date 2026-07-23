# PR 01: Coffee-app Supabase boundary ledger and CI guard

## PR goal

Create a machine-enforced baseline that classifies every direct Supabase runtime
caller as retained web-local behavior or scheduled shared-data debt.

## Why this slice comes now

Without a baseline, direct callers can be added while cutovers are in flight and
"complete" remains subjective. This PR changes no runtime behavior and is
independently mergeable.

## In scope

- A checked-in boundary manifest with file, table/RPC/import, owner, disposition,
  and planned removal PR
- A deterministic repository check that fails on new unclassified access
- CI/package-script integration
- Documentation of allowed auth, workspace/memory, and billing categories
- Separate classification of Supabase Auth session operations from PostgREST,
  RPC, admin-client credential validation, and product-authorization access
- Tests for detection, allowlist matching, stale entries, and renamed files

## Out of scope

- Runtime cutovers
- Moving schema ownership
- Blocking existing classified debt before its planned PR

## Files to change

- `scripts/` boundary scanner
- `package.json`
- CI workflow or existing validation entry point
- `notes/ARCHITECTURE.md`
- a machine-readable boundary manifest under `notes/` or `config/`

## Acceptance criteria

- Every active direct Supabase runtime caller is classified.
- The retained auth allowlist covers only OAuth/session lifecycle and JWT
  forwarding; it does not permit local product-principal, role, or entitlement
  resolution.
- New unclassified tables, RPCs, admin-client creation, or Supabase data helpers
  fail locally and in CI.
- Deleted callers require deleting their manifest entries.
- Tests and normal coffee-app validation pass.

## Test plan

- Fixture tests for permitted, forbidden, stale, and false-positive cases
- Run the scanner against the repository
- `pnpm check`, focused tests, lint/format, and build

## Risks

- Regex-only scanning can miss aliases or flag `Array.from`. Use AST/import-aware
  detection where practical and explicit fixtures.

## Follow-on dependency

Every later consumer PR must shrink this manifest. No later PR depends on a
runtime behavior change here.
