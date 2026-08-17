# Market Brief web publication foundation

**Status:** Selected for implementation

**Decision authority:** The accepted
[Market Brief implementation plan](implementation-plan.md), its MB-1 boundary,
and the accepted Parchment delivery lifecycle through merged PR #226.

**Implementation boundary:** Add Market Brief as a first-class weekly format in
the existing coffee-app blog. A reviewed `.svx` file remains the canonical
artifact, and every web, metadata, feed, and later delivery projection derives
from that artifact. This PR creates no subscriber, provider, scheduler, source
capture, or email-rendering authority.

## Outcome and non-goals

An authored Market Brief edition has one stable edition identity and one
canonical `/blog` URL. Readers can navigate the existing blog archive by format,
while essays continue to work without frontmatter churn. Published editions
remain visible through the current blog detail route, RSS feed, sitemap, and
social/structured metadata.

This slice does not include:

- a separate publication application, content store, `/wire` route, or public API;
- an authored Market Brief edition or generated editorial content;
- subscriber UI, consent, entitlement, archive gating, or no-login unsubscribe UI;
- email-safe rendering, a deployment handoff, Parchment machine authority, or a
  provider draft;
- source capture, generation, scheduling, retries, or missed-edition alerts;
- provider configuration, migration, deployment, delivery, or measurement.

## Canonical format and lifetime

- Every edition is one reviewed file at
  `src/content/blog/market-brief-NNN.svx`.
- Its frontmatter sets `format: "market-brief"` and a positive integer
  `edition: N`.
- Its original `date` is immutable after publication. Corrections may set an
  optional `updated` date, which drives `dateModified` and sitemap `lastmod`
  without changing edition identity or publication date.
- The zero-padded filename and canonical URL are derived from the edition number:
  edition `1` is `market-brief-001.svx` and `/blog/market-brief-001`.
- The edition number survives corrections. A later reviewed commit changes the
  version of that edition; it does not mint another edition identity.
- Legacy posts with no `format` normalize to `essay`. Essays cannot carry an
  edition number or use the reserved `market-brief-` slug prefix. Market Brief
  entries retain the `market-intelligence` pillar. Market Brief is a format,
  not a blog tag.
- Published and draft visibility continues to follow the existing `draft`
  contract. MB-1 introduces no entitlement or trailing-archive gate.

The content registry is the canonical owner of this normalization and
validation. Routes and renderers consume its normalized metadata rather than
re-deriving edition identity.

## Transition and failure model

1. The eager content registry derives the slug from the filename, validates
   canonical tags, and normalizes absent format to `essay`.
2. A Market Brief entry must have a positive integer edition and the exact
   zero-padded slug derived from it. Duplicate edition identities fail the build.
3. An essay carrying `edition`, or a Market Brief entry with an absent, invalid,
   or mismatched edition, fails before routes publish inconsistent metadata.
4. `/blog` accepts only the known `essay` and `market-brief` format filters.
   An explicitly unknown format fails with 404 rather than silently presenting
   a different archive.
5. Detail, feed, and sitemap URLs all use the registry slug. No surface creates a
   second canonical path.
6. Draft filtering remains unchanged in production. A draft never appears in
   feed or sitemap output.

## Sibling and caller inventory

- `src/lib/types/blog.types.ts` owns authored and normalized metadata types,
  format constants, edition formatting, and invariant validation.
- `src/lib/server/blog.ts` owns eager content discovery, format normalization,
  uniqueness, sorting, format queries, and the published-only projection used
  outside content preview.
- `/blog` owns archive navigation and continues to own the one public blog index.
- `/blog/[slug]` owns canonical edition rendering, social metadata, and
  structured article metadata.
- `/blog/feed.xml` projects every published edition into the existing blog feed
  and identifies Market Brief as a format category.
- `/sitemap.xml` continues to project every published canonical blog URL.
- `/llms.txt` continues to project every published edition from the same
  registry without creating a second content source.
- Tag routes remain taxonomy views. They do not become publication-format owners.
- Parchment and coffee-scraper gain no runtime caller or write path in this PR.

## Atomic PR boundary

One PR owns:

1. the backward-compatible blog frontmatter and normalized registry contract;
2. stable edition-to-slug validation and duplicate rejection;
3. URL-backed archive filtering inside `/blog`;
4. edition-aware detail presentation and metadata;
5. RSS, sitemap, and `llms.txt` regression proof; and
6. the durable authoring contract and current-head inherited invariant ledger.

Splitting the metadata contract from its readers would permit an accepted
edition to publish with inconsistent archive, feed, or canonical URL behavior.
Subscriber and delivery work stays separate because it has a different owner,
deployment boundary, rollback, and proof obligation.

## Acceptance and validation

- All current posts load unchanged and normalize to `essay`.
- A valid Market Brief fixture normalizes to `market-brief`, edition `1`, slug
  `market-brief-001`, and canonical path `/blog/market-brief-001`.
- Missing, fractional, zero, negative, duplicate, or slug-mismatched editions
  fail deterministically.
- Essays carrying an edition fail deterministically.
- `/blog?format=market-brief` returns only editions, `?format=essay` returns only
  essays, and unknown explicit filters return 404.
- The Market Brief archive option is URL-backed and does not create a second
  route or publication application.
- Detail metadata identifies the format while retaining the canonical blog URL.
- Corrections preserve the canonical URL and original `datePublished` while
  using `updated` for `dateModified` and sitemap `lastmod`.
- The existing RSS feed includes a Market Brief item once, with the canonical
  link/guid and a Market Brief category.
- The sitemap and `llms.txt` include the canonical edition URL and exclude
  drafts.
- Tag routes, legacy aliases, existing blog counts, and draft behavior remain
  unchanged.
- `pnpm test`, `pnpm lint`, `pnpm check --fail-on-warnings`, `pnpm build`,
  preview-backed `pnpm audit:discoverability`, and `git diff --check` pass from a
  clean current-main worktree. Environment-bound checks report the exact missing
  contract instead of being treated as failures.

## Rollout and rollback

The PR is deployable before any edition exists. It changes no subscriber or
provider behavior. A first edition arrives through the normal content PR,
preview, review, merge, and production deployment path. Rollback reverts the
format code while leaving existing essay content valid.

## Inherited knowledge ledger

- `MB-AUTHORITY` | coffee-app owns the edition and reader surface; Parchment keeps
  shared consent/provider authority | no delivery state or provider caller enters
  MB-1 | active/proven in scope | accepted product plan and PADR-0028
- `MB-CANONICAL-EDITION` | one reviewed `.svx` artifact feeds every channel |
  normalized edition identity and one canonical URL with feed/sitemap projection |
  active until current-head tests pass | PR #502 and accepted product plan
- `MB-NAMING` | Market Brief is public; `market_read` remains internal | public
  format copy uses Market Brief and introduces no `market_read` reader label |
  active | accepted product plan
- `MB-CONSENT` | identity, consent, entitlement, suppression, and unsubscribe stay
  distinct | MB-1 adds none of them and keeps the archive public | deferred to
  accepted Parchment and MB-5 owners | PRs #221-#226
- `MB-DELIVERY` | deployment precedes draft; human approval precedes send | MB-1
  creates neither handoff nor draft/send path | deferred to Parchment draft and
  coffee-app MB-5 successors | PADR-0028
- `MB-SOURCE-IDENTITY` | source identity is not a content hash | no capture or
  source packet enters MB-1 | deferred to coffee-scraper MB-4 | accepted plan
- `MB-CADENCE` | capture/generation have explicit cutoffs, retries, and visibility |
  no scheduler enters MB-1 | deferred to coffee-scraper MB-4 | accepted plan
- `MB-DOC-AUTHORITY` | historical Market Wire records cannot drive implementation |
  this selected plan and the accepted product plan are the only current MB-1
  authorities | proven | PR #538

## Named successor boundary

After MB-1 is accepted, coffee-app MB-5 must define the deterministic email-safe
projection and production-deployment handoff. Only then can Parchment accept one
immutable edition version, verify the deployed identity, and safely create or
recover a Resend draft without inventing coffee-app-owned fields.
