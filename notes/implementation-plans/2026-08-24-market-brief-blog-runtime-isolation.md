# Market Brief blog runtime isolation repair

**Date:** 2026-08-24
**Status:** Implemented and validated; pending review
**Program:** `notes/market-brief/implementation-plan.md`, MB-1 and MB-5A
**Predecessor:** coffee-app PR #541, accepted head `ae22d034`

## Outcome

Restore the deployed blog, format and tag archives, ordinary article reader,
feed, sitemap, and `llms.txt` by removing the Market Brief email renderer and raw
source corpus from the shared blog module's eager initialization path.

The repair keeps MB-5A's deterministic projection and deployed-edition manifest,
but loads that code only when a normalized Market Brief edition actually needs
source validation or reader metadata. With the current zero-edition corpus,
ordinary publication surfaces must not initialize the renderer or its Markdown
and sanitization dependency graph.

## Evidence and scope boundary

Production at coffee-app commit `133f4fc5` returns HTTP 500 for `/blog`, both
format archives, tag archives, ordinary article pages, `/blog/feed.xml`,
`/sitemap.xml`, and `/llms.txt`. The homepage, catalog, analytics, benchmarks,
docs, and API landing page remain healthy. Every failed route imports
`$lib/server/blog`.

The deployed tree contains no `market-brief-*.svx` edition, and all current essay
metadata passes the accepted blog contract. PR #541 changed the shared blog
module to eagerly load raw source for the whole corpus and statically import the
Market Brief email renderer. The renderer then initializes `node:crypto`,
`marked`, `entities`, `sanitize-html`, and its parser graph even when no Market
Brief exists. Authenticated Vercel runtime logs are unavailable, so the exact
exception is not claimed; the proven repair boundary is the unnecessary eager
coupling shared by every failed route.

## Non-goals

- No authored Market Brief edition, publication-state change, or content edit.
- No change to the supported email Markdown subset, sanitization allowlist,
  projection bytes, renderer version, digest, or deployment manifest.
- No dependency downgrade based on an unproven runtime exception.
- No subscriber, consent, Parchment, Resend, provider draft, deployment trigger,
  approval, send, source capture, generation, cadence, or alert work.
- No production deployment, Vercel configuration change, or log-access change.
- No redesign of blog, feed, sitemap, or `llms.txt` behavior.

## Authority and lifetime

- The normalized blog registry remains the canonical owner of post identity,
  format, edition, date, tags, and public visibility.
- The reviewed Market Brief `.svx` remains the sole authored artifact. Its raw
  source lookup and email projection remain projection-only concerns and move
  behind a Market-Brief-only lazy boundary; no second content store is created.
- Ordinary essays and shared discovery surfaces have no reason to initialize an
  email-only renderer. This isolation is permanent even after editions exist.
- An actual Market Brief still fails closed if its raw source is missing or its
  projection contract is invalid. Lazy loading changes initialization timing,
  not validation semantics.

## Transition and failure model

1. The shared registry eagerly loads only normalized blog modules needed by all
   posts.
2. Essays complete normalization without importing raw Market Brief source or
   the email renderer.
3. The registry records normalized Market Brief metadata without importing raw
   source or the email renderer; shared discovery remains independent of the
   projection dependency graph even after editions exist.
4. An ordinary article route returns metadata without loading projection code.
5. An actual Market Brief article lazily loads the projection owner, reads the
   canonical source, validates and derives the unchanged email projection, and
   emits a deployed manifest only under the existing exact production-commit
   gate.
6. Missing source or invalid projection fails closed for the affected Market
   Brief reader. It cannot take the zero-edition or essay-only registry down at
   module initialization.

## Sibling and caller inventory

- `$lib/server/blog` is used by the blog archive, format filters, tag archives,
  article reader, feed, sitemap, and `llms.txt`; all must remain renderer-free for
  an essay-only corpus.
- `$lib/server/marketBriefEmail` remains the sole email projection, raw
  Market Brief source, digest, and deployment-manifest owner.
- `/blog/[slug]` remains the only deployed-manifest reader caller and invokes it
  only for `format: market-brief`.
- The existing Market Brief projection tests remain the authoritative renderer
  proof. No Parchment, scraper, Vercel hook, or provider caller is added.

## Atomic PR boundary

One coffee-app hotfix PR owns:

1. moving raw Market Brief source lookup out of the shared blog registry;
2. replacing static renderer imports with Market-Brief-only lazy imports;
3. preserving fail-closed source/projection validation for real editions;
4. regression coverage proving an essay-only blog loads without initializing the
   projection module; and
5. focused and built-server checks for the shared publication surfaces.

The MB-4D cadence/run-receipt successor stays next. It remains separate because
it belongs to coffee-scraper and adds different state, timing, retry, and host
proof.

## Acceptance and validation

- Importing and enumerating the current essay-only blog corpus does not
  initialize `$lib/server/marketBriefEmail`.
- The blog index, essay filter, tag archive, ordinary article, feed, sitemap, and
  `llms.txt` return success from a production build/preview canary.
- Market Brief metadata, edition uniqueness, draft filtering, feed/sitemap/LLM
  discovery, and ordinary essay behavior keep their MB-1 semantics.
- A Market Brief fixture still validates the same raw source, produces the same
  projection and manifest, rejects missing or unsafe source, and omits deployment
  metadata without an exact production commit.
- Focused tests, full unit tests, `pnpm check --fail-on-warnings`, build,
  changed-file Prettier and ESLint, and `git diff --check` pass. Any repository
  baseline failure is reported separately.
- The PR does not claim production recovery before a later merged deployment and
  read-only HTTP canary return 200.

## Inherited knowledge

- `MB-AUTHORITY` | coffee-app owns canonical content/rendering and Parchment owns
  provider lifecycle | runtime isolation changes no caller or authority | proven
  | PRs #538-#541 and PADR-0028
- `MB-CANONICAL-EDITION` | one reviewed `.svx` feeds web, feed, and email | raw
  source and projection remain tied to the normalized edition; no second store |
  proven | PRs #539 and #541
- `MB-EDITION-VERSION` | edition plus exact production commit defines a version;
  digest is projection integrity only | manifest construction is unchanged and
  remains behind the exact production gate | proven | PADR-0028 and PR #541
- `MB-DELIVERY` | merge is not deployment, deployment is not draft, and draft is
  not send | no outbound caller or provider transition enters the repair | proven
  | PR #502 and PADR-0028
- `MB-MACHINE-AUTHORITY`, `MB-CONSENT`, `MB-UNSUBSCRIBE-LIFETIME`, and
  `MB-PRIVACY` | projection cannot gain delivery authority or recipient state |
  renderer inputs/outputs and provider-neutral placeholder remain unchanged |
  proven | PRs #221-#228 and #541
- `MB-BLOG-ISOLATION` | optional Market Brief projection must not take ordinary
  blog and discovery routes down when no edition exists | lazy module/source
  boundary plus production-build route canary | proven | 2026-08-24 production
  incident
- `MB-NAMING` | Market Brief is public and `market_read` remains internal |
  unchanged renderer and reader copy | proven | PRs #538-#541
- `MB-SOURCE-IDENTITY` | source-packet identity remains distinct from content
  hashes | no scraper artifacts or identities change in this coffee-app repair |
  proven | PRs #449-#451
- `MB-CADENCE` | coffee-scraper owns weekly cadence and missed-run visibility |
  no scheduler or receipt code enters this repair; MB-4D remains the named
  successor | deferred | accepted implementation plan
- `MB-DOC-AUTHORITY` | the accepted product plan remains the governing cross-repo
  authority | this incident plan narrows only the coffee-app repair boundary |
  proven | PR #538 and accepted implementation plan

## Risks and deliberate deferrals

- Without authenticated Vercel logs, this repair proves and removes the eager
  coupling but does not claim the precise package exception. A real-edition
  production canary remains required before MB-5A activation.
- Dynamic isolation prevents an optional projection stack from breaking essays;
  it does not authorize silently skipping validation for an actual Market Brief.
- Production recovery requires merge and deployment outside this PR handoff. The
  workflow stops after review submission unless Reed separately authorizes more.

## Implementation evidence

- The shared blog registry only normalizes and enumerates post metadata. It does
  not import the projection owner or raw Market Brief source, so discovery
  remains renderer-free even when an edition exists.
- The Market Brief reader remains the projection boundary: it lazily imports the
  owner, restricts raw-source discovery to `market-brief-*.svx`, and lets the
  existing projection validation fail closed for a missing or unsafe edition.
- A registry fixture containing a Market Brief proves shared enumeration does
  not initialize the projection renderer; reader and projection tests retain
  fail-closed source validation for the affected edition.
- The article reader uses the same lazy boundary. Type-only manifest metadata is
  erased from the built server, so ordinary essay requests do not initialize the
  projection module.
- A regression test replaces the projection module with a factory that throws
  and proves the current essay-only corpus can still be enumerated without
  invoking that factory.
- `pnpm test` passed: 162 files passed, 1 skipped; 1,204 tests passed, 11 skipped.
- `pnpm check --fail-on-warnings` and `pnpm build` passed with the repository's
  required static environment contract supplied as validation-only placeholders.
- A built preview returned HTTP 200 for `/blog`, `/blog?format=essay`,
  `/blog/tag/data`, `/blog/what-is-purveyors`, `/blog/feed.xml`, `/sitemap.xml`,
  and `/llms.txt`. The discoverability audit scored the blog index, sample
  article, and sample tag page at 100; it retained the unrelated `/docs`
  baseline of 15 missing metadata checks.
- Changed-file Prettier and ESLint checks and `git diff --check` passed. The
  repository-wide `pnpm lint` remains blocked by the existing Prettier baseline
  in 17 unchanged note files.
- The focused isolation, registry, renderer, reader, and feed tests plus the
  production build also passed on Node 22.23.2. The full local suite and type
  check ran on host Node 24.19.0; pull-request checks remain the authoritative
  full Node 22 proof.
