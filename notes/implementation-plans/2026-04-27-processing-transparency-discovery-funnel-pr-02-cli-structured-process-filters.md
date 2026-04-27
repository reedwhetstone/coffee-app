# PR 02: CLI Structured Process Filters

**Date:** 2026-04-27
**Repo:** `purveyors-cli`
**Program:** Processing Transparency Discovery Funnel
**Slice status:** Independently mergeable after or alongside PR 01

## PR goal

Expose the canonical `/v1/catalog` structured process filter contract through `purvey catalog search` so terminal and agent consumers can query the same transparency metadata available in the web/API surface without receiving opinionated analysis copy.

## Why this slice comes now

- Product vision treats the CLI as a first-class agent and machine surface, not a sidecar.
- `/v1/catalog` already supports structured process query params after the processing transparency schema/API work.
- Adding CLI parity prevents the process transparency contract from becoming web-only product value.

## In scope

- Add command options for the structured process fields that the API already accepts.
- Map CLI options to canonical API query params:
  - `processing_base_method`
  - `fermentation_type`
  - `process_additive`
  - `processing_disclosure_level`
  - `processing_confidence_min`
- Include returned process metadata in machine-readable output when present.
- Preserve clean raw structured process values in CLI/API-style output. Do not add web-style confidence analysis or transparency ranking language to machine output.
- Update help/manifest/docs surfaces that describe catalog search options.
- Add tests for param mapping and output stability.

## Out of scope

- New coffee-app API fields.
- Database or scraper changes.
- New auth flows.
- Reworking all catalog search ergonomics.
- Supplier evidence exposure.
- Opinionated transparency scores or analysis labels.

## Files to change

Likely files in `/root/.openclaw/workspace/repos/purveyors-cli`:

- Catalog command implementation and option definitions.
- API client/request construction for catalog search.
- Catalog output types or serializers if they currently drop nested process metadata.
- Help/manifest/docs generation fixtures.
- Command tests and manifest/help contract tests.

Exact paths should be confirmed in the CLI repo before coding because the current checkout is on `test/help-surface-contract`, not a clean main branch.

## Acceptance criteria

- `purvey catalog search` can request structured process filters using documented options.
- Generated request params match the public API names exactly.
- JSON output preserves process metadata when the API returns it.
- Human output remains readable but stays data-forward and does not overstate missing metadata or infer intent.
- Help and manifest surfaces list the new options.
- Existing catalog search behavior and legacy `--process` behavior remain compatible.

## Test plan

- Use a clean CLI worktree from `origin/main` before coding.
- Run the repo's relevant unit/contract tests.
- Add focused tests for option parsing and canonical query param generation.
- Add or update help/manifest snapshot tests if present.
- If an authenticated dry run is safe, call a mocked or test API path to confirm params are emitted correctly. Do not require live API credentials for CI.

## Risks

- CLI option naming can drift from the API. Keep canonical params explicit in tests.
- Machine output may need a versioning or compatibility note if process fields are newly visible.
- The current CLI checkout is dirty and not on main. Use a fresh worktree for implementation.

## Exact follow-on dependency

No later PR is required for this CLI slice to be mergeable. It can follow PR 01 for product sequencing, but technically depends only on the existing `/v1/catalog` process contract in coffee-app main.
