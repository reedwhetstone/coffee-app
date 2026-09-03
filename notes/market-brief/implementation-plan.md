# Purveyors Market Brief implementation plan

**Date:** 2026-08-15
**Updated:** 2026-09-03
**Status:** Public publication MVP operating; production email-draft handoff
remains open
**MB-1 status:** Implemented in coffee-app PR #539
**MB-3 status:** Parchment lifecycle deployed and activated through PR #245
**MB-4 status:** Weekly source and review-PR workflow enabled through
coffee-scraper PRs #478-#489
**MB-5 status:** Email projection and subscription journey shipped in
coffee-app PRs #541 and #561; production-success draft trigger and delivered-path
unsubscribe/suppression verification remain open
**MB-6 status:** Web launch active through edition 002 in coffee-app PR #564;
no-login unsubscribe and provider-suppression verification, provider draft, send,
and delivery measurement remain open
**Owner:** Purveyors product ecosystem
**Canonical backlog:** `notes/DEVLOG.md`

## Goal and selected direction

Build Market Brief as a reliable weekly, source-led green-coffee publication that
makes Purveyors useful before a reader already knows to visit the product.

Market Brief is a format inside the existing `/blog` publishing system, not a
second publication application. Each edition is human-reviewed before merge. The
merged `.svx` edition is the canonical published artifact for the MVP, and web,
feed, and email outputs derive from that artifact.

The selected ownership model is:

- coffee-app owns the reader experience, canonical authored edition, blog
  integration, and human review surface;
- Parchment owns shared consent, delivery-provider state, delivery lifecycle,
  authorization, and generated SDK contracts;
- coffee-scraper owns external source capture, source packets, editorial
  generation, validation, cadence, and failure visibility; and
- the canonical Parchment market-publication program owns any numeric market
  fact presented as current platform truth.

The public name is **Market Brief**. The deployed Parchment publication key
`market_read` and `/v1/email-subscriptions/market-read` route remain internal
compatibility contracts. The existing `/analytics#market-read` snapshot keeps its
current name.

## Non-goals

The MVP does not include:

- a separate `/wire` application or `wire_editions` content store;
- a public Market Brief API or CLI command;
- automatic email sending without human approval;
- personalized editions, immediate alerts, or archive-wide chat;
- knowledge-corpus ingestion or retrieval serving;
- a generalized editorial scheduler or provider framework; or
- exact archive entitlements beyond the first web slice's reviewed product
  boundary.

These may become later, independently selected outcomes. They are not hidden
requirements for the weekly publication.

## Verified current state

### Coffee-app

- The Market Brief format, archive, edition navigation, canonical metadata,
  feed, sitemap, Markdown route, and sharing surfaces are live inside the
  existing reviewed `.svx` publication system.
- Canonical edition 002 is live at `/blog/market-brief-002`, and `/market-wire`
  is the public reader and archive entry point.
- The account-backed subscription journey and signed-in preference removal are live.
  Identity, consent, and paid entitlement remain separate.
- The deterministic email projection exists, but no production-success trigger
  currently submits a deployed edition to Parchment for provider-draft
  creation.
- Account deletion is live and production-verified. It is no longer a Market
  Brief launch dependency.

### Parchment

- `email_subscriptions` stores account-owned `market_read` consent separately
  from identity and paid entitlement.
- Session-authenticated read and preference mutation routes are deployed.
- The account-deletion lifecycle removes the account-owned preference.
- The accepted PADR-0028 lifecycle is deployed and its production capability
  migration is applied. Parchment owns provider audience projection, no-login
  unsubscribe, account-deletion cleanup, verified webhook settlement, and
  immutable draft admission.
- PADR-0021, PADR-0022, and the merged market contracts in Parchment PRs #239
  and #242 own current market facts. The obsolete evidence and duplicate-authority
  PRs #219 and #207 are closed and must not be revived.
- Parchment PR #245 owns the activation boundary. The remaining integration gap
  is coffee-app's deployed-edition handoff and first unsent provider-draft
  canary; automatic sending remains forbidden.

### Coffee-scraper

- The repo owns supplier collection, provenance, bounded Market Brief source
  packets, social evidence, deterministic validation, refinement, and edition
  generation.
- The weekly source and review-PR workflow is enabled under coffee-scraper
  ownership, and its latest scheduled proof succeeded. Human merge remains the
  publication gate.

### Historical notes

The July 19 Market Wire research, design, infrastructure recommendation, and
strategic proposal remain useful product research. They are historical records,
not implementation authority. In particular, `/wire`, `wire_editions`, the old
WP sequence, free-subscriber archive access, and a public edition API are not
MVP contracts.

## Invariants

1. **One reviewed artifact feeds every channel.** The merged `.svx` edition is
   canonical for the MVP. A provider draft or generated email is a projection,
   not an independently editable publication.
2. **Current conversation leads, evidence supports.** Industry reporting and
   discussion establish the weekly throughline. Purveyors facts add evidence and
   buying context only when their authority, scope, and observation time are
   explicit.
3. **Unsupported facts are omitted or qualified.** Missing, stale, incomplete,
   or inapplicable supplier evidence cannot become a whole-market claim.
4. **Identity, consent, and entitlement remain separate.** Creating an account,
   joining Market Brief email, and buying Intelligence are independent actions.
5. **Parchment owns shared delivery authority.** Coffee-app and coffee-scraper do
   not read delivery-provider state, hold provider lifecycle authority, or
   mutate canonical consent outside Parchment contracts.
6. **One-click unsubscribe works without login.** Its authorization, lifetime,
   replay, consent mutation, and provider-suppression behavior belong to the
   accepted Parchment delivery decision.
7. **Merge is not send.** Email draft creation may begin only after the matching
   production deployment succeeds. Initial sends require manual provider
   approval.
8. **Weekly cadence is observable.** The scraper-owned generation plan must name
   the editorial cutoff, source-readiness gate, retry boundary, and missed-run
   alert before production scheduling is enabled.
9. **External content is untrusted.** Capture keeps stable source identity
   separate from content hashes, sanitizes bounded excerpts, and preserves
   citations before any model call.
10. **Owning repos decide their mechanisms.** This cross-product plan does not
    define Parchment event fields, machine scopes, token formats, provider
    reconciliation, scraper storage, or scheduler commands.

## Authority and lifetime

- The canonical edition begins as a coffee-app PR and becomes published truth
  only when its commit is live in production. Corrections use a new reviewed
  commit rather than mutating an email projection.
- Account-owned consent survives deployments and provider retries in Parchment.
  Provider projection and delivery evidence remain subordinate to consent.
- Captured external observations and generated source packets have the bounded
  retention and reproducibility rules accepted in coffee-scraper. They are not
  reader-facing publication state.
- Parchment market facts retain the provenance, freshness, coverage, and
  publication identity of the canonical market reader. Market Brief does not
  recalculate those semantics.

## Dependency order

```text
MB-1 coffee-app publication format [complete]
  + Parchment market-publication gates [complete]
  + MB-2 Parchment delivery decision [complete]
      -> MB-3 Parchment delivery implementation and activation [complete]
  + MB-4 coffee-scraper capture and weekly review PR [operating]
      -> MB-5 coffee-app subscriber and projection surfaces [complete]
      -> MB-5 production-success draft handoff [open]
      -> MB-6 web launch [operating]
      -> MB-6 provider send and delivery measurement [open]
```

The original dependency gates are satisfied through Parchment activation,
coffee-scraper's weekly workflow, and coffee-app's public launch. The remaining
sequence is intentionally narrow: a successful production deployment hands one
immutable edition/version to Parchment, Parchment creates or replays one unsent
provider draft, and a human approves any send. Coffee-app must not invent shared
provider behavior or treat merge alone as proof of deployment.

## Atomic delivery slices

### MB-1: Add the Market Brief publication format

**Repository:** coffee-app
**Status:** Complete in PR #539

Add the smallest durable reader foundation inside `/blog`: Market Brief
frontmatter, edition identity, archive filtering or navigation, canonical URLs,
and the required feed, sitemap, metadata, and content-registry behavior. Keep the
existing authored `.svx` and PR preview workflow.

This slice includes no subscriber UI, provider calls, Parchment schema, or
generation job. It is useful alone because a reviewed Market Brief can publish
on the web before email automation exists.

**Validation:** content-loader and metadata tests, blog route tests, feed and
sitemap assertions, formatting, lint, and Svelte checks.

### MB-2: Accept the Market Brief delivery lifecycle

**Repository:** parchment-api
**Status:** Complete in PADR-0028

Inventory the deployed email-preference contract and the intended delivery
provider, then accept one focused Parchment decision for the missing shared
lifecycle. It must settle ownership and observable behavior for no-login
unsubscribe, audience projection, provider draft/send state, suppression,
retries, machine authorization, and bounded delivery observation.

Exact events, fields, credentials, token mechanics, and worker topology belong
in that Parchment artifact, based on current provider and production evidence.
Do not copy them into this plan.

### MB-3: Implement Parchment-owned delivery and SDK contracts

**Repository:** parchment-api
**Dependency:** accepted MB-2 decision
**Status:** Deployed and activated through Parchment PR #245

Implement the accepted consent and provider lifecycle behind Parchment HTTP and
generated SDK contracts. Preserve account deletion, session preference behavior,
idempotency, and provider retry safety. Deploy and canary the upstream contract
before coffee-app consumes it.

### MB-4: Build source capture and weekly generation

**Repository:** coffee-scraper
**Status:** Operating through coffee-scraper PRs #478-#489 and the enabled weekly
review-PR workflow

Create the repo-owned implementation plan immediately before code. Inventory
allowed sources and provider constraints first. Then add bounded capture, source
identity, sanitization, source-packet assembly, deterministic fact validation,
edition generation, PR creation, scheduling, retries, and missed-edition
visibility as independently testable slices.

Generated output targets the MB-1 frontmatter and content contract. Numeric
Purveyors callouts consume canonical Parchment reads and carry their scope and
observation time. The generator never reads mutable production tables directly
to recreate market authority.

### MB-5: Complete subscriber, feed, and delivery handoff

**Repository:** coffee-app
**Dependencies:** MB-1 and deployed MB-3
**Status:** Subscriber, feed, and projection surfaces complete; production-success
draft trigger open

Add the user-facing consent and unsubscribe flows, feed behavior, email-safe
projection of the canonical edition, and production-deployment handoff required
by the accepted Parchment contract. Coffee-app remains a consumer and renderer;
it does not become the provider-state owner.

The slice must verify that the deployed Parchment contract's no-login unsubscribe
and provider-suppression behavior exclude recipients on the delivered path. It
must also prove that a failed deployment creates no provider draft, a replayed
successful deployment creates no duplicate draft, and the initial send still
requires human approval.

The accepted successor sequence preserves repository ownership and recovery:

1. coffee-app MB-5A defines the deterministic email-safe projection and deployed
   edition/version metadata;
2. Parchment accepts immutable draft work, dedicated machine authorization,
   provider creation, and ambiguous-create recovery; and
3. coffee-app adds the thin production-success trigger against that generated
   SDK contract.

Subscriber and preference UI shipped in PR #561, but that completion does not
authorize either repo to invent the remaining draft handoff or bypass
Parchment's provider lifecycle.

### MB-6: Launch and measure

**Status:** Public web launch operating; provider send and delivery measurement
open

Continue publishing editions through the normal PR and production deployment
path. The web launch has proved citations, coverage language, correction
behavior, account-backed consent and signed-in preference removal, feed output,
and weekly review visibility. No-login unsubscribe and provider suppression on
the delivered-email path, first-draft creation, send, and delivery evidence
remain gated on the email handoff. Set growth and learning metrics only for
events that the accepted contracts actually observe. Unimplemented signals are
absent, not reported as zero.

## Rollout and rollback

- MB-1 remains independently reversible without affecting existing essays.
- MB-3 is deployed behind the accepted Parchment activation boundary and keeps
  the session preference route compatible with current consumers.
- MB-4 scheduling is enabled after capture and generation canaries passed; a
  failed run must remain visible and must not publish without review.
- MB-5 must not enable provider delivery until the remaining production-success
  handoff and first unsent-draft canary pass against the deployed upstream
  lifecycle.
- A failed edition or provider projection never blocks the existing blog or
  Market Index. It creates visible retry or missed-edition work owned by the
  responsible repo.

## Deliberate deferrals

- The exact public/archive access boundary is decided in MB-1 from current
  product evidence. Email consent alone does not imply paid archive entitlement.
- Provider analytics, replies, and first-party evidence-link attribution are
  included only if MB-2 accepts a truthful source and lifecycle.
- Knowledge ingestion begins only through a later Parchment-owned published-
  content contract. Drafts never enter a reader-facing corpus.
- Public API, CLI, personalization, automatic sends, sponsorship tooling, and
  immediate alerts require separate selection in `notes/DEVLOG.md`.

## Inherited knowledge from PR #502

- `MB-AUTHORITY` | shared consent and provider behavior have one Parchment owner |
  mapped to MB-2 and MB-3 | proven | PADR-0028 and Parchment PR #245
- `MB-CANONICAL-EDITION` | one merged edition feeds web, feed, and email | mapped
  to MB-1 and MB-5 | proven for web/feed/projection; provider handoff open |
  coffee-app PRs #539/#541/#564
- `MB-NAMING` | Market Brief is public; `market_read` remains an internal
  compatibility key | stated in Goal | proven in this plan | PR #502 naming review
- `MB-CONSENT` | identity, consent, entitlement, and suppression stay distinct;
  unsubscribe works without login | mapped to MB-2, MB-3, and MB-5 | active;
  Parchment capability proven, coffee-app delivered-email verification open |
  Parchment PR #245 and coffee-app PR #561
- `MB-DELIVERY` | deployment precedes draft creation; provider-confirmed events
  anchor provider metrics | mapped to MB-2, MB-3, and MB-5 | provider lifecycle
  proven; coffee-app handoff open | PADR-0028 and Parchment PR #245
- `MB-SOURCE-IDENTITY` | stable source identity is not a content hash | mapped to
  MB-4 | proven | coffee-scraper PRs #478-#489
- `MB-CADENCE` | daily capture and weekly generation have explicit cutoffs,
  credentials, retries, and failure visibility | mapped to MB-4 | proven and
  enabled | coffee-scraper PRs #478-#489
- `MB-DOC-AUTHORITY` | historical concept records cannot masquerade as current
  implementation instructions | proven by the historical banners and this sole
  current plan | PR #502 supersession decision

The public publication, account-backed consent, projection, provider lifecycle,
source, and cadence proofs now sit on their owning repositories' current
implementation heads. The delivered-email no-login unsubscribe and suppression
verification, plus the remaining provider-draft handoff, must earn production-
path proof; this plan does not infer that proof from the already completed
predecessors.
