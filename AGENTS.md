# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/` (routes in `src/routes`, shared code in `src/lib`, types in `src/types`).
- Assets: `static/` (served at site root). Styles in `src/app.css` with Tailwind.
- Config: `svelte.config.js`, `vite.config.ts`, `tailwind.config.ts`, `eslint.config.js`, `tsconfig.json`.
- Backend/services: Supabase config in `supabase/`.
- Tests: colocated under `src/**/*.{test,spec}.{ts,js}`. E2E placeholder in `e2e/`.

## Build, Test, and Development Commands

- `pnpm dev`: Start SvelteKit + Vite dev server.
- `pnpm build`: Sync Kit and build for production.
- `pnpm preview`: Preview the production build locally.
- `pnpm check`: Type-check with `svelte-check` using `tsconfig.json`.
- `pnpm lint`: Run Prettier check then ESLint (Svelte + TS rules).
- `pnpm format`: Auto-format with Prettier.
- `pnpm test` / `pnpm test:unit`: Run Vitest (non-watch / watch modes).
- `pnpm build:analyze`: Build then open bundle analyzer for `dist/`.
- `pnpm vercel-dev`: Run Vercel emulator locally.

Prereqs: Node `22.x` (see `package.json` engines) and PNPM. Example: `corepack enable && corepack prepare pnpm@latest --activate`.

## Coding Style & Naming Conventions

- Language: TypeScript (strict) + Svelte 5. Use `.svelte` and `.svx` for mdsvex.
- Formatting: Prettier (see `.prettierrc`, `.prettierignore`); run `pnpm format`.
- Linting: ESLint flat config with `eslint-plugin-svelte` and TypeScript. Run `pnpm lint`.
- Components: Prefer `PascalCase.svelte` in `src/lib/components`. Utilities in `src/lib/utils`.
- Routes: SvelteKit filesystem routing under `src/routes` (grouped routes allowed). Keep names lowercase with hyphens.

## Testing Guidelines

- Framework: Vitest (configured in `vite.config.ts`).
- Colocation: Place tests next to code as `*.spec.ts` or `*.test.ts`.
- Running: `pnpm test` for CI, `pnpm test:unit` for local iteration.
- Snapshots/DOM: Use Svelte component tests where appropriate; keep unit scope small and deterministic.

## Commit & Pull Request Guidelines

- Commits: Use clear, imperative subject lines (e.g., “add roast chart chunking”). Keep to one logical change per commit.
- PRs: Include problem statement, summary of changes, screenshots for UI, and any performance or DX notes. Link related issues.
- Checks: Ensure `pnpm lint`, `pnpm check`, and `pnpm test` pass. Update docs when changing behavior.

## Security & Configuration Tips

- Secrets: Store in `.env` (never commit). Supabase keys live in environment vars.
- Deploy: Vercel adapter configured; verify env vars in Vercel project settings.

## AGENT GUIDELINES

- Build / lint / test (single test):
  - Install: `corepack enable && corepack prepare pnpm@latest --activate` then `pnpm i`
  - Dev server: `pnpm dev`
  - Run all tests: `pnpm test`
  - Run a single test file: `pnpm test -- src/path/to/file.spec.ts` or `pnpm test -- --testNamePattern "part of test name"`
  - Lint & format: `pnpm lint` and `pnpm format`

- Code style highlights:
  - Use TypeScript (strict). Prefer explicit types for exports; narrow 'any'.
  - Svelte components: `PascalCase.svelte`. Route files: lowercase hyphenated.
  - Imports: use absolute from `src/` where possible; keep extension-less (`.ts`/`.svelte`).
  - Formatting: Prettier config enforced; run `pnpm format` before commits.
  - Naming: functions/vars `camelCase`, types/interfaces `PascalCase`, constants `SCREAMING_SNAKE`.
  - Error handling: return structured errors from services (avoid throwing raw strings); log with `src/lib/utils/alog-parser.ts` patterns.
  - Tests: colocate with implementation; keep tests deterministic and fast; mock external services (Supabase, Stripe).

- Cursor / Copilot rules:
  - Cursor rules: follow repository `.cursorrules` (present at repo root). Honor navigation and edit restrictions.
  - Copilot: respect `.github/copilot-instructions.md` if present; do not commit AI-generated secrets.

- Automation notes for agents:
  - Always run `pnpm lint` and `pnpm test:unit` after changes; run `pnpm check` for type safety.
  - Don't modify git config; create focused commits with clear imperatives.
