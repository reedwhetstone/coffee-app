# PR C Execution Plan: Role Simplification and Entitlement Migration

**Goal:** Replace hybrid pseudo-roles with minimal app roles plus explicit API/access plans.

## Scope

- Reduce app roles to `viewer | member | admin`
- Design and implement explicit plan/entitlement source of truth
- Update rate-limit logic and product gating to use plans/entitlements
- Remove or migrate uses of `api-member`, `api-enterprise`, and `ppi-member`
- Generate Supabase SQL if schema changes are required

## Likely schema work

Potential new artifacts:

- `account_entitlements` table or equivalent
- optional plan enum/text field strategy
- migration/backfill for current role-derived access

## Candidate files

- `src/lib/types/auth.types.ts`
- `src/lib/server/auth.ts`
- `src/lib/server/apiAuth.ts`
- analytics gating files
- dashboard/usage files depending on `userTier`
- Stripe/webhook role update flows
- admin discrepancy tools

## Deliverable requirement

- Exact SQL for Supabase console if tables/columns/indexes must change

## Acceptance criteria

- App permissions work with simplified roles
- API limits/plans no longer rely on pseudo-role names
- old pseudo-roles are removed or fully migrated
- `pnpm check` passes
- `verify-pr` runs before merge recommendation
