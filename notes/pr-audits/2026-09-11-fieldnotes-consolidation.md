# Fieldnotes app branch consolidation — 2026-09-11

## Integration owner and preserved history

The canonical app integration branch is `openclaw/fieldnotes-source-demo`, reviewed in [coffee-app #591](https://github.com/reedwhetstone/coffee-app/pull/591). The research/generation implementation stays in its separate repository on [coffee-scraper #514](https://github.com/reedwhetstone/coffee-scraper/pull/514), branch `openclaw/fieldnotes-editorial`. One branch cannot span both repositories.

The app consolidation starts at #591 head `ddbd08908cca15aaa47c503a069e3218ea14e088`. It preserves the two #607 changes with traceable cherry-picks:

- `5da76361` → `ef6f8f90`: identify estimated newsletter tasting profiles.
- `e4e4896a` → `0ec75176`: share newsletter supplier names across exports.

The five reader/test files match [#607](https://github.com/reedwhetstone/coffee-app/pull/607) head `e4e4896ad69b0ed5470972ae9fede20179092123` byte-for-byte. The persona matches the former #591 head byte-for-byte. The original #607 remote branch is retained; closing the redundant PR after verifying the canonical push does not delete its history.

## Production and editorial boundaries

Unlike the former persona-only #591, this consolidated PR includes runtime reader changes. After eventual merge/deployment, existing newsletter cards with generated tasting profiles show an AI-estimate label, and supplier names are normalized across web/email/Markdown. This is a presentation correction, not a change to blog prose.

No `src/content/blog` or `static` files change. No edition, article, demo prose, artwork, publication state, subscription behavior, or delivery settings are introduced. This consolidation does not merge either integration PR or approve any demo. The editorial merge hold remains.

## Validation

- `VALIDATION_PASS`: `pnpm test src/lib/components/blog/MarketBriefArticle.svelte.test.ts src/lib/server/marketBriefEmail.test.ts src/lib/server/fieldnotes.integration.test.ts` — 33 tests across three files.
- `VALIDATION_PASS`: scoped ESLint and Prettier for all six inherited changed files.
- `VALIDATION_FAIL` (pre-existing): `pnpm lint` stops at formatting issues in 17 unrelated Markdown files already present on the original #591 base. No unrelated formatting changes were included.
- `VALIDATION_PASS`: `pnpm check --fail-on-warnings` — 0 errors, 0 warnings after adding the missing inert `OPENROUTER_API_KEY` static placeholder; the initial missing-variable check was environment-blocked.
- Static validation uses inert repo-local environment placeholders only. These checks do not verify authenticated runtime behavior or email delivery. No fresh visual redesign or screenshot claim is made; inherited reader changes are exact copies of the previously previewed #607 files.
- Diff inspection: exactly persona, five reader/test files, and this integration receipt against the main merge base; no unrelated changes imported.

## Next gate

Review newsletter output and the two canonical integration PRs. The app PR is no longer documentation-only; its visible presentation effects must be part of the eventual merge decision. Newsletter publication and sending remain separate, unperformed actions.
