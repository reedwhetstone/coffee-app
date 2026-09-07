# Market Brief production identity

**Status:** Implemented for review; production proof remains after merge.
**Selected:** September 5, 2026, as the first slice of the approved email launch
assessment in [PR #580](https://github.com/reedwhetstone/coffee-app/pull/580).

## Outcome and evidence

Bind email provenance to the exact Vercel build, not mutable or missing
request-time environment fields. A production build must prove that its packaged
reader can produce the same deterministic projection identity Parchment expects.
Ordinary previewable PRs remain the review surface. Human merge controls release;
this slice neither requests nor sends a provider draft.

At assessment, deployed edition 002 returned 200 without any of the five
`purveyors:market-brief-*` tags. Its serialized manifest was undefined. The same
current-main Vercel artifact produced a valid projection when invoked in isolation
with the expected runtime variables. This establishes a missing live prerequisite
and runtime dependency, not the precise private production failure. Vercel logs
and configuration remain inaccessible in the available session. Do not claim a
confirmed provider outage or confirmed live renderer exception.

## Authority, implementation, and proof

Vercel's build target and full Git commit are the provenance owner for the
lifetime of the artifact. Vite captures only these two non-secret fields; it does
not serialize the process environment. Production without a valid commit fails
at build configuration. Non-production builds retain no production commit.
Request-time environment cannot promote a preview or relabel production.

The page consumes this server-only build identity. Existing deterministic
projection, SHA-256, canonical origin, renderer version, and Parchment's five-tag
verification contract remain unchanged. A request-time projection failure still
preserves the reader and omits email evidence; it never fabricates a manifest.

`pnpm build` now invokes `verify:market-brief-artifact`. The verifier copies the
actual adapter-produced function to an isolated temporary directory and removes
it afterward. It invokes every Market Brief page with no inherited credentials
and deliberately contradictory runtime identity, then compares production
metadata with the actual packaged renderer. Non-production builds must expose no
manifest. The check catches missing traced dependencies and production projection
failures that reader availability or mocked route tests would hide.

This check is read-only and makes no network or provider call. Existing tests
also prove essays and preview readers do not initialize the email renderer.

## Release and remaining gates

1. Review and merge this ordinary PR. Preview remains a normal web preview; it
   never advertises production email identity.
2. Vercel production build must pass the artifact check using its own full commit.
   If automatic system-variable exposure is disabled, fix the exact Vercel
   configuration; do not supply a guessed commit or reuse another build's value.
3. Re-read the live edition and verify all five tags against the merged production
   commit and packaged projection. Failed deployment or missing tags remains a
   blocker for draft admission. Read production logs if live evidence still fails.
4. Only after this boundary is deployed and proved, add the durable production-
   success SDK handoff, refresh Parchment/Resend cutover evidence, and implement
   Parchment-owned send readiness. Any actual email send remains separately
   human-approved for the initial rollout.

Rollback is a normal code revert and deployment; no database/provider state is
created. Build verification does not claim current Resend readiness, audience
convergence, inbox delivery, or successful deployment.

## Inherited invariants

- `MB-CANONICAL-EDITION` / `MB-EDITION-VERSION`: the reviewed artifact alone owns
  projection identity. Proven locally by canonical-source tests, contradictory-
  runtime route tests, and isolated production artifact verification; live proof
  remains gated on deployment.
- `MB-PREVIEW-ISOLATION`: preview and essay readers must not require email runtime
  initialization. Existing route/isolation tests retained; non-production artifact
  check rejects identity even if runtime claims production.
- `MB-DELIVERY`: production precedes provider draft and human approval precedes
  send. No SDK/provider call added. Handoff and audience readiness remain owned
  successors under the [implementation plan](implementation-plan.md).
- `MB-AUTHORITY` / `MB-CONSENT` / `MB-PRIVACY`: Parchment retains consent,
  unsubscribe, suppression, deletion, and provider authority. This slice touches
  none of those contracts, includes no credentials, and does not activate them.

## Validation receipts

- Production and preview `pnpm build` passed with explicit non-secret local
  Vercel target/commit fixtures. These are artifact checks, not deployed canaries.
- The production artifact check still passed with a temporary `draft: true`
  edition in the source tree and verified only the one published edition. The
  fixture was removed after the check.
- Removing the packaged email-renderer module made verification fail as expected;
  the artifact was restored afterward.
- `pnpm check --fail-on-warnings`, full unit tests, changed-file ESLint and
  Prettier, and `git diff --check` passed. Full `pnpm lint` stops on the existing
  17 unrelated Markdown formatting failures; none are modified here.
- Local checks used Node 24.19.0 with inert static-build environment placeholders.
  The repository targets Node 22; CI and the Vercel preview remain its remote
  runtime checks. No protected service or inbox canary is claimed.
- Focused independent review found and closed two verifier gaps: runtime override
  must precede module initialization, and enumeration must use published packaged
  metadata rather than source filenames. Both corrections are included above.
