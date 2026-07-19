# Scalar App Role Cutover Plan

**Status:** Proposed

**Decision owner:** Reed

**Schema owner:** coffee-app

**Affected runtimes:** coffee-app, Parchment API, Supabase/PostgREST

**Target:** Make `public.user_roles.role` the only app-role source of truth, remove `public.user_roles.user_role`, and rename the database enum from `public.user_role` to `public.app_role`.

## Decision

Use one scalar app role per user:

- `viewer`
- `member`
- `admin`

Keep non-role entitlements in their existing explicit columns:

- `api_plan`: `viewer | member | enterprise`
- `ppi_access`: boolean

Retire the `user_role text[]` column. It is a compatibility mirror that still acts as an authorization source in several consumers, which creates two writable truths and permits drift. During the expand/cutover window it remains a write-only rollback aid; no active consumer may use it for authorization.

Rename and narrow the PostgreSQL enum to `public.app_role`. Leaving the scalar column typed as `public.user_role` after dropping the similarly named `user_role` column would preserve most of the current ambiguity. The replacement enum should contain only `viewer`, `member`, and `admin`; the old API pseudo-role values belong in `api_plan`, not the app-role type.

The `public.user_roles` table name remains unchanged. Renaming the table would affect many foreign keys without improving the entitlement model and is outside this cutover.

## Why this is the right source of truth

The current system is internally inconsistent:

- Billing reconciliation treats scalar `role` as authoritative and writes `user_role` as a mirror.
- Coffee-app principal resolution reads `user_role`, `api_plan`, and `ppi_access`, but does not read scalar `role`.
- Parchment API entitlement resolution also reads `user_role`, `api_plan`, and `ppi_access`.
- The chat action execution function accepts either scalar `role` or a matching value in `user_role`.
- Admin discrepancy monitoring explicitly checks whether the array mirrors the scalar.
- A milestone backfill route checks membership directly in the array.

This duplication does not provide meaningful multi-role capability. App authorization is hierarchical and singular, while independent product access already has dedicated fields. Removing the array makes authorization fail consistently instead of allowing a stale mirror to grant or deny access.

## Assumptions

These assumptions must hold before the destructive migration:

1. **App role is singular.** A user cannot simultaneously need two incomparable app roles. `admin` includes member capabilities, and `member` includes viewer capabilities.
2. **The role hierarchy remains `viewer < member < admin`.** Exact-role use cases must be identified explicitly rather than represented as multiple array values.
3. **API access is not an app role.** `api_plan` remains the authority for API tiering and rate-limit behavior.
4. **Parchment Intelligence is not an app role.** `ppi_access` remains the authority for Intelligence access.
5. **Legacy pseudo-roles have been backfilled.** `api_viewer`, `api_member`, `api_enterprise`, and array spellings such as `api-member`, `api_enterprise`, `developer`, `growth`, and `ppi-member` no longer carry unique information that is absent from `api_plan` or `ppi_access`.
6. **The raw Supabase table is not a supported public integration contract.** Supported clients use coffee-app or `https://api.purveyors.io/v1/*`, not direct PostgREST reads of `user_roles.user_role`. Any known direct consumers must migrate before the drop.
7. **Coffee-app and Parchment API resolve identities against the same production entitlement data.** Both deployments must be cut over before the schema removal.
8. **CLI auth is outside the database boundary.** Purveyors CLI consumes Parchment API credentials and response contracts. It has no direct Supabase dependency, so this migration must not reintroduce one.
9. **Supabase auth roles are unrelated.** `auth.role()`, JWT role claims such as `authenticated` or `service_role`, and `auth.users.role` are platform authorization concepts and are not renamed or removed.
10. **Historical migrations remain immutable.** Add a forward migration that produces the new end state. Do not rewrite old migrations merely to erase references; `supabase db reset` must prove the complete migration chain still converges.

If any assumption fails, stop before the destructive phase and revise the data model rather than preserving another implicit fallback.

## Desired end state

```sql
create type public.app_role as enum ('viewer', 'member', 'admin');

create table public.user_roles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  api_plan text not null default 'viewer',
  ppi_access boolean not null default false,
  -- existing identity and audit columns remain unchanged
  constraint user_roles_api_plan_check
    check (api_plan in ('viewer', 'member', 'enterprise'))
);
```

Application contracts should expose one `UserRole`, not `UserRole | UserRole[]`. Public API response fields named `role` remain scalar and retain their existing `viewer | member | admin | null` shape.

## Inventory of downstream effects

### Coffee-app runtime

- `src/lib/server/principal.ts`
  - Select `role, api_plan, ppi_access`.
  - Normalize one scalar role.
  - Delete the `user_role` fallback and pseudo-role derivation paths.
  - Continue failing closed when the entitlement row cannot be read.
- `src/lib/server/billing/entitlements.ts`
  - Remove `userRole` from `ResolvedBillingEntitlements`.
  - Retain a private `buildUserRoleMirror` write path through PR 3, deriving the mirror from scalar role and explicit entitlements; remove array reads and comparisons from authorization and discrepancy decisions.
  - Delete the compatibility writer when PR 3 drops the column.
  - Preserve admin behavior, Stripe role reconciliation, `api_plan`, and `ppi_access` independently.
- `src/lib/server/billing/reconcile-session.ts`
  - Stop selecting and returning `user_role`.
- `src/lib/server/billing/admin-discrepancies.ts`
  - Remove mirror-drift detection and the `user_role` issue type.
  - Keep scalar role, API plan, Intelligence access, and subscription discrepancy checks.
- `src/routes/api/admin/billing-entitlement-discrepancies/+server.ts`
  - Remove `user_role` from the select list and response typing.
- `src/lib/components/StripeRoleMonitor.svelte`
  - Remove current and expected array rendering.
- `src/routes/api/admin/backfill-milestones/+server.ts`
  - Read scalar `role` and authorize both `member` and `admin` according to the hierarchy.
- `src/lib/types/auth.types.ts`
  - Retire array support from `UserRoles`, `checkRole`, and `hasRole` after all call sites are scalar.
  - Confirm no legitimate caller relies on exact membership of a multi-role array.
- `src/hooks.server.ts`, page auth, navigation, catalog gates, portfolio gates, and chat gates
  - Their scalar `locals.role` behavior should remain unchanged, but tests must prove the principal cutover does not change access.

### Database functions and triggers

- Replace `public.handle_new_user()` so inserts specify `role`, `api_plan`, and `ppi_access`, but not `user_role`.
- Replace the chat action execution function introduced by `20260711_chat_action_execution_ledger.sql` so it authorizes only scalar `role` plus the existing `ppi_access` exception.
- Search `pg_proc`, `pg_views`, `pg_matviews`, `pg_policies`, triggers, generated columns, indexes, and check constraints for column or enum dependencies before the drop.
- Reload the PostgREST schema cache after the migration.

### Parchment API

- `packages/api/src/auth/entitlements.ts`
  - Select `role, api_plan, ppi_access`.
  - Remove `toStringArray` and the legacy `user_role` fallback.
  - Normalize the scalar role to the existing `UserEntitlements.roles` contract initially, or simplify that internal contract to a scalar in a separate mechanical step.
- Update auth, API-key, principal, and inventory idempotency fixtures that currently construct `user_role` arrays.
- Revalidate every route whose authorization derives from `principal.primaryAppRole`: catalog, similarity, inventory, roasts, sales, tasting, procurement, market index, and API-key issuance/exchange.
- External OpenAPI and SDK response contracts should not change. A generated SDK diff containing a role shape change is a stop signal.

### Purveyors CLI

No direct code or schema change is expected. Validate that:

- Viewer catalog access is unchanged.
- Member-only inventory, roast, sales, and tasting commands remain member-gated.
- `purvey auth status` and `/v1/me` retain their current scalar role presentation.
- No Supabase package, URL, key, type, or fallback is added to the CLI.

### Supabase types and schema artifacts

- Regenerate `src/lib/types/database.types.ts` after the production-compatible migration.
- Update `supabase/schema.sql` to show `role public.app_role` and no `user_role` column.
- Do not hand-edit generated types as the only source of truth.
- Do not rewrite historical migration files. Add migration-contract tests for the forward migration and update tests that intentionally inspect old migrations only when their asserted end-state assumption has changed.

### Security and RLS

The checked-in baseline contains a `Users can update own role` policy and grants broad access to authenticated users. Production may have diverged, so inspect live policies and column privileges before relying on scalar `role` as the sole authority.

The intended policy is:

- Authenticated users may read their own entitlement row if the app still needs that direct read.
- Authenticated users may not directly update `role`, `api_plan`, or `ppi_access`.
- Entitlement writes come only from trusted service-role paths, billing reconciliation, or narrowly scoped security-definer functions with fixed `search_path` and explicit authorization.

If production currently permits self-service entitlement writes, ship the RLS and privilege correction before or in the first compatible application cutover. Treat this as a security fix, not optional cleanup.

### Observability and operations

- Add structured logs around entitlement read failures during the compatibility window without logging user secrets or API keys.
- Distinguish missing row, invalid role, database failure, and denied access.
- Monitor 401/403 rates on member-only coffee-app and Parchment routes after each deployment.
- Watch billing reconciliation errors and admin discrepancy counts.
- PostgREST schema cache staleness can present as missing-column errors after migration; explicitly reload and canary rather than relying on eventual refresh.

## Production preflight

Run read-only queries against production before implementation. Save aggregate counts, not user-identifying rows, in the PR evidence.

### Data shape

```sql
select role::text, count(*)
from public.user_roles
group by role::text
order by role::text;

select user_role, count(*)
from public.user_roles
group by user_role
order by user_role::text;

select count(*) filter (where api_plan is null) as null_api_plan,
       count(*) filter (where ppi_access is null) as null_ppi_access,
       count(*) filter (where role is null) as null_role
from public.user_roles;
```

The destructive phase requires:

- Zero null scalar roles.
- Zero scalar values outside `viewer`, `member`, and `admin`.
- Zero null `api_plan` or `ppi_access` values.
- Every legacy array-only API or Intelligence entitlement is represented in its explicit column.

### Drift classification

Classify every row where the array does not reduce to the scalar role. Do not blindly overwrite it until the independent entitlements are confirmed.

```sql
select role::text, user_role, api_plan, ppi_access, count(*)
from public.user_roles
where user_role is distinct from array[role::text]
group by role::text, user_role, api_plan, ppi_access
order by count(*) desc;
```

Expected classifications:

- Harmless mirror drift after explicit entitlements are verified.
- A legacy API pseudo-role that must already be represented by `api_plan`.
- A legacy `ppi-member` marker that must already be represented by `ppi_access = true`.
- A real app-role conflict requiring manual adjudication before cutover.

### Database dependency audit

Inventory dependencies using catalog queries and definitions, including:

- Functions whose `pg_get_functiondef` contains `user_role`.
- Views and materialized views whose definitions contain `user_role`.
- Policies, triggers, defaults, constraints, indexes, publications, and grants involving the column or enum.
- Direct PostgREST clients observable through API logs, if available.

The final migration must abort if an unexpected dependency remains.

## Delivery sequence

The sequence is expand, cut over, observe, contract. Each PR must be independently deployable and must pass its own checks if the next PR never ships.

### PR 1: Parchment API scalar consumer

Repository: `parchment-api`

1. Read scalar `role` with `api_plan` and `ppi_access`.
2. Remove array and pseudo-role fallbacks.
3. Keep public principal and response shapes unchanged.
4. Update focused entitlement and route tests.
5. Deploy while both database columns still exist.
6. Canary viewer, member, admin, Intelligence, API-plan, and scoped API-key flows.

This PR must land first because Parchment API deploys independently and would fail immediately if it selected a removed column.

### PR 2: Coffee-app scalar consumers and writers

Repository: `coffee-app`

1. Cut principal resolution to scalar `role`.
2. Remove all runtime reads of `user_role` from authorization. Keep the billing reconciliation write as a private compatibility mirror until PR 3 drops the column.
3. Simplify billing reconciliation and admin discrepancy surfaces.
4. Replace signup and chat authorization database functions using a forward migration or function-only migration that remains compatible with both table shapes.
5. Harden live RLS and column privileges if the preflight confirms authenticated self-update access.
6. Update application and migration-contract tests.
7. Deploy while `user_role` still exists.
8. Canary login, navigation, billing upgrade/downgrade, admin access, member actions, Intelligence access, and chat action execution.

At the end of PR 2, repository-wide runtime search should find no non-historical `user_role` authorization reads in coffee-app or Parchment API. The only permitted runtime access is the documented, write-only billing compatibility mirror, which is removed by PR 3.

During the PR 2-to-PR 3 observation window, billing reconciliation must continue updating `user_role` from scalar role and explicit entitlement state. This keeps an application rollback to the current array-reading version safe for upgrades and downgrades while the old column still exists. The mirror must never grant or deny access in the scalar-consuming deployments.

### Observation gate

Hold the destructive migration until both deployments are live and the following pass:

- No production missing-column or invalid-role errors.
- No unexplained increase in 401 or 403 responses.
- Viewer, member, and admin session canaries pass.
- Parchment API key issuance and `/v1/me` pass.
- CLI catalog and member-resource canaries pass through the public API.
- Billing reconciliation produces correct scalar role, API plan, and Intelligence access.
- Chat action authorization accepts valid member/admin users and rejects viewers.
- Database dependency audit shows no unexpected `user_role` consumers.

Use at least one normal deploy observation window. A full billing webhook cycle or explicit non-destructive reconciliation canary is preferable to time alone.

### PR 3: Coordinated contract release

Repositories: `coffee-app`, then `parchment-api`

The contract release has two ordered changes because application and database
deployments cannot be atomic across repositories:

1. Merge and deploy the coffee-app cleanup that stops writing the legacy mirror
   and removes the final pseudo-role compatibility helpers.
2. With the reviewed Parchment plan manifest already available, immediately
   apply the Parchment-owned schema migration through the guarded workflow.

Do not introduce another observation window between these steps. Once the
coffee-app cleanup is deployed, ordinary rollback to an array-reading build is
no longer supported even though the column may exist briefly. If the schema
apply aborts, keep the scalar deployment live, diagnose the failed precondition,
and produce a new reviewed plan. Restore the legacy schema before any rollback
to array-reading code.

Repository: `parchment-api`

Add one transactional forward migration that:

1. Asserts all scalar roles are non-null and limited to `viewer`, `member`, and `admin`.
2. Asserts `api_plan` and `ppi_access` are populated.
3. Asserts or explicitly replaces every known function dependency.
4. Creates `public.app_role` with only the three valid app roles.
5. Drops the `role` default temporarily.
6. Converts `user_roles.role` to `public.app_role` without implicit legacy mapping.
7. Restores the `viewer` default and `NOT NULL` constraint.
8. Drops `user_roles.user_role`.
9. Drops the obsolete `public.user_role` enum after proving it has no dependents.
10. Reloads PostgREST schema metadata.

Do not silently map legacy enum values in this destructive migration. Any `api_*` scalar value indicates the preflight or earlier backfill failed, and the transaction should abort.

After the production apply succeeds, regenerate coffee-app database types in a
mechanical follow-up so the checked-in snapshot reflects `public.app_role` and
the removed mirror. Prove the Parchment migration chain converges on a
disposable database before submission whenever the local service is available;
otherwise require that execution signal from CI before apply.

### PR 4: Optional mechanical type simplification

Repositories: `coffee-app`, then `parchment-api` if useful

Only after the schema cutover is stable:

- Remove `UserRole[]` support from shared authorization helpers.
- Change internal `roles` collections to a scalar where no public contract requires a list.
- Delete legacy pseudo-role normalization utilities and tests.
- Remove stale comments and archived compatibility language from active docs.

Keep this separate from the database drop unless the diff is demonstrably tiny. It is not required to make the schema safe.

## Validation matrix

### Static and unit validation

Coffee-app:

- `pnpm lint`
- `pnpm check --fail-on-warnings`
- `pnpm test`
- Focused principal, auth, billing entitlement, reconciliation, admin discrepancy, signup migration, and chat action migration tests.
- `supabase db reset` or the repository's equivalent clean migration replay.

Parchment API:

- Formatting, lint, typecheck, build, API tests, SDK tests, and generated-contract diff.
- Focused entitlement, API-key principal, API-key endpoint, and member-resource authorization tests.

### Role and entitlement cases

Test these combinations independently:

- Viewer with viewer API plan and no Intelligence.
- Viewer with member or enterprise API plan.
- Viewer with Intelligence access.
- Member with viewer API plan and no Intelligence.
- Member with Intelligence access.
- Admin with enterprise API plan and Intelligence access.
- Missing entitlement row.
- Invalid scalar role returned by a stubbed database client.
- Database read failure.

The matrix proves that app role, API plan, and Intelligence access remain independent.

### Production canaries

- Browser login and authenticated layout role.
- Viewer catalog access.
- Member inventory read and one non-destructive member flow.
- Admin page access.
- Parchment `/v1/me` for an existing scoped key.
- Catalog and one member CLI read with the stored broker-issued credential.
- Intelligence-only access path.
- Billing entitlement reconciliation dry run or safe existing-session replay.
- Chat action authorization with a read-only or otherwise reversible action.

## Rollback strategy

### Before PR 3

Rollback is ordinary application rollback. Both columns still exist, so the old consumers remain deployable. If scalar reads expose bad data, repair the scalar field and explicit entitlements before continuing.

### After PR 3

Do not roll application code back to an array-reading version unless the schema is restored first.

Prepare a reviewed forward recovery migration before dropping the column. It should:

1. Recreate the old enum only if an emergency application rollback requires it.
2. Convert scalar `app_role` back to the old enum.
3. Recreate `user_role text[] not null default '{viewer}'`.
4. Backfill it as `array[role::text]`.
5. Restore only the minimum old function definitions required for rollback.

This recovery restores app-role behavior, not obsolete pseudo-role arrays. API and Intelligence entitlements remain authoritative in their explicit columns.

## Stop conditions

Stop and rescope if any of these occur:

- A legitimate user needs incomparable simultaneous app roles.
- A supported direct Supabase client depends on `user_role`.
- Production contains legacy pseudo-role data not faithfully represented by `api_plan` or `ppi_access`.
- Parchment API or coffee-app cannot deploy scalar reads before the schema drop.
- An unexpected database function, view, policy, or external consumer depends on the array.
- Public OpenAPI or SDK role shape changes.
- The clean migration replay fails.
- RLS permits untrusted entitlement mutation and cannot be corrected in the compatible phase.

## Completion criteria

The cutover is complete only when:

- Production `user_roles` has scalar `role public.app_role` with three enum values.
- Production has no `user_role` column and no obsolete `public.user_role` enum.
- Coffee-app and Parchment API contain no active `user_role` column reads, writes, or fallbacks.
- Billing, admin, signup, and chat database paths use scalar role plus explicit entitlements.
- Authenticated users cannot directly mutate entitlement columns.
- Generated database types and schema snapshots match production.
- Coffee-app, Parchment API, CLI, billing, and chat production canaries pass.
- External API and CLI contracts are unchanged.
- The recovery migration is documented and reviewed.
