# /devlog-task-implementation

Read `notes/DEVLOG.md` and implement the next actionable task. Follow this workflow exactly.

## Task Selection

1. Read `notes/DEVLOG.md` for the current task list
2. Work in **strict priority order** — Priority 1 first, then 2, etc.
3. Within a priority group, pick the **first unchecked `[ ]` task** that can be completed without outside dependencies
4. If all tasks in a priority group are blocked, move to the next group

**Skip tasks that require:**
- Supabase schema changes (new columns, tables, migrations, RLS policies)
- Third-party API key setup or configuration
- Infrastructure changes (deployment, hosting, DNS)
- External service provisioning (Stripe config, OAuth setup)
- Manual data entry or seed data from the user

## Execution

1. **Identify** — State which task you're implementing and why it's the next actionable one
2. **Plan** — Use TodoWrite to break the task into steps
3. **Explore** — Read relevant source files before making changes
4. **Implement** — Follow CLAUDE.md guidelines (SvelteKit 5 runes, TypeScript, TailwindCSS)
5. **Verify** — Run `pnpm check 2>&1 | grep "Error:" | grep "YourModifiedFile"` to confirm no new errors
6. **Update DEVLOG** — Mark the completed task with `[x]` in `notes/DEVLOG.md`
7. **Commit & Push** — Descriptive commit message, push to current branch
8. **Report** — Summarize what was done and identify the next actionable task

## Scope

- **In scope**: Frontend components, API routes, styling, client-side logic, reactive state, UI layout, D3 charts, forms, navigation
- **Out of scope**: Database migrations, new Supabase columns/tables, RLS policies, external API integrations requiring new keys, infrastructure/deployment
