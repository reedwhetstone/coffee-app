# PR 02: CLI Structured Process Filters

**Date:** 2026-04-28
**Repo:** `purveyors-cli`
**Program:** Processing Transparency Discovery Funnel
**Slice status:** Independently mergeable after or alongside PR 01

## PR goal

Expose canonical `/v1/catalog` structured process filters through `purvey catalog search` so terminal and agent consumers can query the same process transparency contract as the web and API surfaces.

## Why this slice comes now

The product vision treats the CLI as a first-class machine and agent surface. If structured process transparency remains web/API-only, Purveyors repeats the cross-surface drift the platform direction is explicitly trying to avoid.

## In-scope

- Add catalog search options for structured process filters.
- Map options to canonical query params:
  - `processing_base_method`
  - `fermentation_type`
  - `process_additive`
  - `processing_disclosure_level`
  - `processing_confidence_min`
- Preserve returned process metadata in JSON output when present.
- Keep human output readable and data-forward.
- Update help, manifest, or docs surfaces that enumerate catalog search options.
- Add tests for option parsing, request params, and output stability.

## Out-of-scope

- Coffee-app API changes.
- Database or scraper changes.
- New auth flows.
- Full catalog search redesign.
- Supplier evidence exposure.
- Opinionated web-style analysis or transparency scores in CLI output.

## Files to change

Exact paths should be confirmed in a clean `purveyors-cli` worktree before coding. Likely areas:

- Catalog search command implementation and option definitions
- API client or request-param builder for catalog search
- Catalog output serializers or types
- Help/manifest/docs contract fixtures
- Command and manifest/help tests

## Acceptance criteria

- `purvey catalog search` accepts documented structured process options.
- Generated API requests match canonical `/v1/catalog` param names.
- JSON output includes process metadata when returned by the API.
- Human output remains readable and does not infer missing data.
- Help and manifest surfaces list the new options.
- Existing `--process` behavior remains compatible.

## Test plan

- Use a clean CLI worktree from `origin/main` before implementation.
- Run the CLI repo's relevant unit and contract tests.
- Add focused tests for option parsing and canonical request-param generation.
- Update help/manifest snapshots if present.
- Use mocked or dry-run API calls so CI does not depend on live credentials.

## Risks

- Option names could drift from API params. Test canonical request output directly.
- JSON output compatibility may need a small docs note if nested process metadata becomes newly visible.
- The primary CLI checkout may not be on main. Use a fresh worktree for coding.

## Exact follow-on dependency

No later PR is required. PR 02 depends on the existing `/v1/catalog` process contract, not on PR 01 implementation details.
