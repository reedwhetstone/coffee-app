# Purveyors Market Brief implementation plan

**Date:** 2026-08-15
**Status:** Active
**MB-1 status:** Implemented in coffee-app PR #539
**MB-5A status:** Implemented in the email-projection successor
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

- The blog already publishes reviewed `.svx` content through GitHub and Vercel.
- `/blog`, `/blog/feed.xml`, sitemap metadata, social metadata, and the existing
  blog content registry are the current publication surface.
- No Market Brief format, edition navigation, archive filter, or recurring
  generation handoff exists on `main`.
- Account deletion is live and production-verified. It is no longer a Market
  Brief launch dependency.

### Parchment

- `email_subscriptions` stores account-owned `market_read` consent separately
  from identity and paid entitlement.
- Session-authenticated read and preference mutation routes are deployed.
- The account-deletion lifecycle removes the account-owned preference.
- No accepted Market Brief provider-projection, no-login unsubscribe, broadcast,
  or delivery-observation contract exists yet.
- PADR-0021, PADR-0022, and the approved canonical market-publication plan own
  current market facts. Their production evidence and product-authority gates are
  active in Parchment PRs #219 and #207 as of this plan.

### Coffee-scraper

- The repo already owns supplier collection, provenance, LLM-assisted
  enrichment, standalone jobs, and production cadence on the scraper host.
- It does not have an accepted Market Brief source-observation contract, bounded
  weekly source packet, edition generator, or missed-edition alert.

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
MB-1 coffee-app publication format
  + active Parchment market-publication gates
  + MB-2 Parchment delivery decision
      -> MB-3 Parchment delivery implementation and SDK
  + MB-4 coffee-scraper capture and generation
      -> MB-5 coffee-app subscriber, feed, and delivery handoff
      -> MB-6 launch and measurement
```

MB-1, the active market-publication program, and MB-2 can advance independently.
MB-4 may build source-led editions before every numeric market product is ready,
but it must omit unsupported Purveyors fact callouts. MB-5 cannot invent shared
provider behavior while MB-2 or MB-3 remains incomplete.

## Atomic delivery slices

### MB-1: Add the Market Brief publication format

**Repository:** coffee-app

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

Implement the accepted consent and provider lifecycle behind Parchment HTTP and
generated SDK contracts. Preserve account deletion, session preference behavior,
idempotency, and provider retry safety. Deploy and canary the upstream contract
before coffee-app consumes it.

### MB-4: Build source capture and weekly generation

**Repository:** coffee-scraper

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

Add the user-facing consent and unsubscribe flows, feed behavior, email-safe
projection of the canonical edition, and production-deployment handoff required
by the accepted Parchment contract. Coffee-app remains a consumer and renderer;
it does not become the provider-state owner.

The slice must prove that a failed deployment creates no provider draft, a
replayed successful deployment creates no duplicate draft, and the initial send
still requires human approval.

The accepted successor sequence preserves repository ownership and recovery:

1. coffee-app MB-5A defines the deterministic email-safe projection and deployed
   edition/version metadata;
2. Parchment accepts immutable draft work, dedicated machine authorization,
   provider creation, and ambiguous-create recovery; and
3. coffee-app adds the thin production-success trigger against that generated
   SDK contract.

Subscriber and preference UI remains part of the broader MB-5 outcome, but it
does not authorize either repo to invent the missing draft contract.

### MB-6: Launch and measure

Publish the first editions through the normal PR and production deployment path.
Verify citations, coverage language, correction behavior, consent, unsubscribe,
provider suppression, feed output, delivery evidence, and weekly failure alerts.
Set growth and learning metrics only for events that the accepted contracts
actually observe. Unimplemented signals are absent, not reported as zero.

## Rollout and rollback

- MB-1 rolls back by reverting a coffee-app content-format change; existing essays
  remain valid.
- MB-3 ships behind the accepted Parchment activation boundary and preserves the
  current session preference route until dependent consumers are proven.
- MB-4 scheduling remains disabled until capture and generation canaries pass.
- MB-5 enables email only after the upstream lifecycle is deployed and provider
  configuration is verified.
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
  mapped to MB-2 and MB-3 | active | PR #502 recurring sender/provider findings
- `MB-CANONICAL-EDITION` | one merged edition feeds web, feed, and email | mapped
  to MB-1 and MB-5 | active | PR #502 product boundary
- `MB-NAMING` | Market Brief is public; `market_read` remains an internal
  compatibility key | stated in Goal | proven in this plan | PR #502 naming review
- `MB-CONSENT` | identity, consent, entitlement, and suppression stay distinct;
  unsubscribe works without login | mapped to MB-2 and MB-3 | active | PR #502
  consent reviews
- `MB-DELIVERY` | deployment precedes draft creation; provider-confirmed events
  anchor provider metrics | mapped to MB-2, MB-3, and MB-5 | active | PR #502
  delivery reviews
- `MB-SOURCE-IDENTITY` | stable source identity is not a content hash | mapped to
  MB-4 | active | PR #502 source-capture review
- `MB-CADENCE` | daily capture and weekly generation have explicit cutoffs,
  credentials, retries, and failure visibility | mapped to MB-4 | active | PR
  #502 scheduling reviews
- `MB-DOC-AUTHORITY` | historical concept records cannot masquerade as current
  implementation instructions | proven by the historical banners and this sole
  current plan | PR #502 supersession decision

The exact downstream proofs replace `active` with `proven` on each owning repo's
current implementation head. This plan does not claim predecessor review results
as implementation proof.
