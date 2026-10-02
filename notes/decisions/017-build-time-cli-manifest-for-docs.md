# ADR-017: Build-Time CLI Manifest Data for Docs

**Status:** Accepted (Reed, 2026-10-01, #parchment)

**Date:** 2026-10-01

## Context

ADR-006 (superseded) and ADR-007 established that coffee-app does not import
`@purveyors/cli`: the CLI is an independent Parchment API client, and shared
behavior lives behind Parchment contracts and `@purveyors/sdk`.

The `/docs/cli/*` pages were hand-written copies of CLI command and flag details.
They drifted from the shipped CLI and had no pages for the `market`,
`price-index`, `procurement`, and `reference-profile` command groups. The CLI
already publishes its contract as data through `@purveyors/cli/manifest`
(`getCliManifest()`), the same contract behind `purvey manifest` and
`purvey context`.

## Decision

Coffee-app may read the published CLI manifest **at build time, as data, for
documentation only**.

- `@purveyors/cli` is a `devDependency` pinned to an exact published version.
- `scripts/generate-cli-reference.mjs` calls `getCliManifest()` during
  `pnpm build` and writes `src/lib/docs/generated/cli-manifest.json` (manifest,
  package version, and Node engine requirement). The snapshot is committed so
  checks and tests run without a build.
- `src/lib/docs/cliReference.ts` turns that JSON into `/docs/cli/*` command
  reference pages. Narrative pages (overview, agent integration, agent setup)
  stay hand-written in `src/lib/docs/content.ts`; command, argument, flag,
  example, exit-code, and ID details come only from the manifest.
- Type-only imports from `@purveyors/cli/manifest` are allowed because they are
  erased at compile time.

Runtime imports remain forbidden. No client or server bundle may import CLI
modules, and app behavior must not depend on CLI code. A unit test fails on any
non-type `@purveyors/cli` import under `src/`, and on browser components that
import the docs content or snapshot.

## Consequences

- CLI reference pages match the pinned CLI release. Bumping the pin and
  rebuilding updates the reference; the snapshot test fails if the committed
  JSON differs from the installed package.
- New manifest command groups get a reference page automatically.
- CLI manifest wording is now customer-facing on purveyors.io. Copy fixes for
  flags or notes belong in `purveyors-cli`. Until they ship, coffee-app rewrites
  or drops maintainer-facing manifest text (backing endpoints, SDK plumbing,
  table names, design references) through an exact-match map, and drops any
  other note that matches those internal markers. Tests fail if a map entry no
  longer exists in the pinned manifest or if a generated page still contains an
  internal marker.
- Where the manifest contradicts a Parchment contract this repo documents,
  coffee-app may override that one field with a test that fails once the CLI is
  corrected. The first case is `catalog similar` access. Since the 2026-10-02
  paid-similarity decision (ADR-005 clarification), coffee-app states the
  member-or-paid-plan rule while CLI 0.36.1 still marks it `member` and adds a
  note that any API plan works.
- ADR-006's superseded note and ADR-007's "does not depend on `@purveyors/cli`"
  status now read as "no runtime dependency"; the build-time docs exception is
  recorded here.
