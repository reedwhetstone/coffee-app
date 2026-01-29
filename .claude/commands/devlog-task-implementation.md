# /devlog-task-implementation - DEVLOG Task Implementation Command

You are a senior full-stack developer working on the purveyors.io coffee tracking platform. Your task is to systematically implement items from `notes/DEVLOG.md`.

## Directive

**Always tackle tasks by priority order (Priority 1 first, then 2, etc.) and by capability to complete without outside dependencies.**

## Task Selection Rules

1. **Read `notes/DEVLOG.md`** to get the current task list
2. **Work in strict priority order** — start from Priority 1, then Priority 2, etc.
3. **Skip tasks that require outside dependencies**, including:
   - Supabase schema alterations (new columns, tables, migrations)
   - Third-party API key setup or configuration
   - Infrastructure changes (deployment, hosting, DNS)
   - External service provisioning (Stripe config, OAuth setup)
   - Manual data entry or seed data from the user
4. **Select the first unchecked task** in the highest priority group that can be completed entirely with code changes (frontend, API routes, styling, logic fixes)
5. **If all tasks in a priority group are blocked by dependencies, move to the next priority group**

## Execution Workflow

1. **Identify**: Read the DEVLOG, find the highest-priority actionable task
2. **Plan**: Use TodoWrite to break the task into implementation steps
3. **Explore**: Read relevant source files to understand the current implementation
4. **Implement**: Make the code changes following CLAUDE.md guidelines (SvelteKit 5 runes, TypeScript, TailwindCSS patterns)
5. **Verify**: Run `pnpm check` and `pnpm build` to confirm no type errors or build failures
6. **Update DEVLOG**: Mark the completed task with `[x]` in `notes/DEVLOG.md`
7. **Commit & Push**: Commit all changes with a descriptive message and push to the current branch
8. **Report**: Summarize what was done and what the next actionable task would be

## Scope Boundaries

- **In scope**: Frontend components, API routes, styling, client-side logic, reactive state fixes, UI layout, D3 chart modifications, form fixes, navigation changes
- **Out of scope**: Database migrations, new Supabase columns/tables, RLS policy changes, external API integrations requiring new keys, infrastructure/deployment changes

## Quality Gates

- Verify no **new** errors in modified files via `pnpm check 2>&1 | grep "Error:" | grep "YourFile"`
  - Note: ~291 pre-existing errors from outdated Supabase types are expected and unrelated
- `pnpm build` requires env vars and may fail in environments without `.env` — this is pre-existing
- Follow SvelteKit 5 runes syntax exclusively (`$props`, `$state`, `$derived`, `$effect`)
- Follow established design patterns from CLAUDE.md

## Common Pitfalls (Learned from Prior Sessions)

1. **Double modal wrapping**: Some form components (e.g., `RoastProfileForm`) are self-contained modals with their own `fixed inset-0` overlay. Never wrap them in another modal container — render them directly with `{#if visible}<Component />{/if}`.

2. **Cascade delete completeness**: When deleting `green_coffee_inv` records, ALL FK-dependent tables must be cleaned up in order: `sales` → `artisan_import_log` → `roast_temperatures` → `roast_events` → `roast_profiles` → the bean itself. Check `/api/beans/+server.ts` DELETE handler. When new FK-dependent tables are added to the schema, update all cascade handlers.

3. **Navigation**: Always use `goto()` from `$app/navigation` instead of `window.location.href`. The latter causes a full page reload and resets app state. Also, `URLSearchParams.get()` returns decoded values — never double-decode with `decodeURIComponent()`.

4. **Data display completeness**: When displaying entity data (bean profiles, catalog info), show ALL non-null fields rather than hard-coding a subset. Use a pattern like:
   ```typescript
   const availableFields = ['field1', 'field2', ...]; // comprehensive list
   const displayFields = availableFields.filter(f => data[f] != null && data[f] !== '');
   ```

5. **Pre-existing type errors**: The codebase has ~291 pre-existing TypeScript errors from outdated `database.types.ts`. When verifying changes, filter `pnpm check` output to only your modified files.
