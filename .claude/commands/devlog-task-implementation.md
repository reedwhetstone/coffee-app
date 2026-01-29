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

- All changes must pass `pnpm check` (TypeScript/Svelte validation)
- All changes must pass `pnpm build` (production build)
- Follow SvelteKit 5 runes syntax exclusively (`$props`, `$state`, `$derived`, `$effect`)
- Follow established design patterns from CLAUDE.md
