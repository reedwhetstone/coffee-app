# Purveyors Market Brief MVP Implementation Plan

**Status:** Accepted for implementation
**Working name:** Purveyors Market Brief
**Updated:** 2026-07-26
**Authority:** This document supersedes the implementation sequencing and unresolved
product choices in `design.md` and `infrastructure.md`. `research.md` remains the
research record.

**Naming contract:** **Market Brief** is the user-facing publication name and
`market-brief` is its coffee-app format/slug. The already-deployed Parchment
publication key remains `market_read`, including the
`/v1/email-subscriptions/market-read` route. Do not rename that internal contract as
part of this MVP.

## 1. Product definition

Purveyors Market Brief is a reliable weekly read of the micro-movements shaping green
coffee: what people are noticing, discussing, buying, questioning, and reacting to,
supported by Purveyors market data where it adds evidence.

The editorial product leads with current industry conversation, news, and sentiment.
Purveyors data validates, challenges, or adds buying context. Broad macro commentary
is supporting context because established coffee publications and importers already
cover it well.

Market Brief and the existing blog are two formats in one publishing system:

- `essay`: sporadic, idea-led analysis using the current blog workflow.
- `market-brief`: a weekly, source-led review of green-coffee news, sentiment, and
  buying signals.

Both formats live under `/blog`, share the same visual system and PR review workflow,
and can link to catalog, Market Index, and Parchment Intelligence. The blog index
provides format tabs or filters. A future `/market-brief` vanity path may redirect to
the filtered blog view, but a separate publication application is not part of MVP.

The existing `/analytics#market-read` live index snapshot keeps its current name.
The weekly publication therefore uses the distinct user-facing label **Market Brief**
and the `market-brief` format/vanity slug, avoiding one product name for two surfaces.

## 2. MVP principles

1. **The weekly habit is the product.** Missing one edition is a visible operational
   failure.
2. **Current conversation leads.** Social and industry sources establish the weekly
   narrative; Purveyors data supplies evidence and buying context.
3. **Facts precede prose.** Numeric and product claims come from deterministic,
   cited inputs before the LLM drafts.
4. **One reviewed artifact feeds every channel.** The merged Market Brief content file
   is the canonical MVP edition. Web, RSS, and email derive from it.
5. **Merge is not send.** Email draft creation starts only after the production
   deployment succeeds. Initial sends always require manual approval in Resend.
6. **Incomplete supplier coverage is disclosed, not blocking.** Claims include an
   `as of` date and observed-source scope. Unsupported callouts are omitted or
   qualified.
7. **Identity, consent, and paid access are separate states.** They share one Purveyors
   user but must never be collapsed into one role or boolean.
8. **Build the smallest permanent pipeline.** Personalization, immediate alerts,
   public edition APIs, automatic sending, vector search, and chat integration are
   later products.

## 3. Identity, consent, and entitlement model

Every Market Brief email subscriber must have:

- a Supabase Auth user;
- the normal `public.user_roles` row with baseline `role = viewer`;
- a separate account-owned email-subscription record for the deployed `market_read`
  topic.

The model has three independent axes:

- `user_roles.role`: application role. `viewer` is free; `member` grants Mallard
  Studio; `admin` is operational.
- `user_roles.ppi_access`: Parchment Intelligence entitlement.
- `email_subscriptions.status`: permission to deliver Market Brief email.

The email record is not a second user system. It is a normalized child of the
Purveyors account. It exists separately because consent, unsubscribe, bounce, and
complaint state do not belong in the role hierarchy.

The canonical preference row stores the user, publication, consent status, and
timestamps. It does not duplicate the user's email address or store Resend-specific
identifiers. Provider projection and event state belong in a dependent connector
contract.

MVP consent states are:

- `subscribed`: active explicit consent;
- `unsubscribed`: user-revoked consent.

Consent source and timestamps remain durable. Provider event IDs, contact IDs, retry
state, broadcast IDs, and deliverability suppression live outside this canonical
preference row. Consent and delivery health are independent: an address can be
suppressed while the user's last recorded preference remains subscribed, and a
suppressed user must still be able to revoke consent.

### State behavior

- Creating a Purveyors account does not automatically opt the user into Market Brief.
- Subscribing requires authentication and explicit consent.
- Upgrading to Intelligence does not automatically subscribe the user to email.
- Unsubscribing does not remove Studio or Intelligence access.
- Canceling a paid product does not unsubscribe the free email.
- Deleting the Purveyors account ends Market Brief delivery.
- One-click unsubscribe must work without login and update the same canonical
  subscription state.

### Access matrix

| Principal                    | Recent three editions | Older edition summaries | Older full editions | Weekly email |
| ---------------------------- | --------------------- | ----------------------- | ------------------- | ------------ |
| Anonymous                    | Yes                   | Yes                     | No                  | No           |
| Viewer, not email subscribed | Yes                   | Yes                     | No                  | No           |
| Viewer, email subscribed     | Yes                   | Yes                     | No                  | Yes          |
| Mallard Studio only          | Yes                   | Yes                     | No                  | Optional     |
| Parchment Intelligence       | Yes                   | Yes                     | Yes                 | Optional     |
| Admin                        | Yes                   | Yes                     | Yes                 | Optional     |

Email delivery is the free distribution relationship. Parchment Intelligence is the
historical and decision-support product. Code and copy must use `email subscriber`
and `Intelligence user` rather than the ambiguous word `subscriber`.

## 4. Canonical MVP edition

Market Brief reuses the current MDsveX blog pipeline. A published issue is an `.svx`
file with the existing blog metadata plus:

```yaml
format: market-brief
edition: 1
windowStart: '2026-07-20'
windowEnd: '2026-07-26'
dataAsOf: '2026-07-26T06:00:00-06:00'
observedSourceCount: 17
```

The body uses normal links for external reporting and social posts. Purveyors data
appears in compact evidence callouts containing:

- the observation;
- the value or count;
- `as of` timestamp;
- observed-source count;
- a deep link to the relevant Purveyors surface or methodology.

The generator also retains a machine-readable source packet as a review artifact.
It maps each proposed section and factual claim to its source URLs or Parchment
fields. The source packet does not need to become a reader-facing bibliography.

The public coffee-app repository means archive gating is a conversion gate rather
than hard digital-rights enforcement during MVP. If source-level secrecy becomes
commercially important, old edition bodies can later move behind a Parchment content
API without changing the editorial workflow.

## 5. Weekly source and editorial pipeline

### Daily source capture

Coffee-scraper runs small daily ingesters into a rolling seven-day window:

- curated X accounts and recent-search queries, within a configured spending cap;
- curated coffee-industry RSS feeds and newsletters where retrieval is permitted;
- selected YouTube channel metadata;
- Bluesky as a low-cost supplementary source;
- Reddit only through an approved API route.

Each observation records:

- platform and source;
- author and canonical URL;
- sanitized, length-capped excerpt;
- published and observed timestamps;
- engagement snapshot;
- discovery query or feed;
- content hash for deduplication.

External content is untrusted data. It is sanitized before storage and wrapped as
untrusted before any LLM call. Engagement is compared within a platform, not across
platforms as if likes, views, and replies were equivalent.

### Weekly source packet

The weekly job combines:

- the rolling social and news observations;
- selected external market context;
- current Parchment signals and market facts;
- data freshness and observed-source coverage;
- relevant existing Purveyors essays.

Deterministic scoring considers recurrence, relevance, novelty, and within-platform
engagement. The job produces a bounded source packet, not a raw social-media dump.

### Drafting

The LLM receives the source packet, structured facts, Market Brief editorial rules,
and Reed's canonical voice guidance. It proposes:

1. the week's throughline;
2. three to five short movements or stories;
3. one or more Purveyors evidence callouts where supported;
4. a short source and methodology note;
5. an Intelligence conversion moment tied to a real locked capability.

Validation rejects:

- a factual claim without a source reference;
- a numeric claim without a mapped deterministic fact;
- stale or out-of-window social material;
- unsupported claims about the entire market when coverage is partial;
- missing inline links;
- invalid frontmatter or non-canonical tags;
- missing hero art or Market Brief visual treatment.

The job opens a coffee-app PR containing the edition, hero asset, and validation
summary. Reed reviews the Vercel preview and iterates through the PR.

## 6. Publication and delivery

The launch sequence is:

1. Market Brief PR merges.
2. Vercel production deployment reports success.
3. A GitHub Action identifies the newly published Market Brief edition.
4. The action invokes a protected, idempotent draft-creation path.
5. The canonical edition is rendered into email-safe HTML.
6. Resend creates or updates a Broadcast with `send: false`.
7. Reed reviews and manually schedules or sends the first several editions.

The system must not create a broadcast on merge alone because a deployment can fail.
It must never send directly from the deployment event during MVP.

Parchment records the durable `(production commit, edition slug)` delivery key,
provider broadcast ID, and draft status. GitHub workflow concurrency is not a
substitute for this ledger because deployments and workflows can be replayed.

Resend is a delivery projection:

- Purveyors stores canonical consent and separate delivery-suppression state.
- Resend Topics group the projected Market Brief recipients.
- Resend webhooks update local unsubscribe, hard-bounce, and complaint state.
- Provider identifiers and event IDs support idempotent reconciliation.

RSS publishes summaries and links. It does not expose the complete paid archive.
The recent-three boundary is ordered by publication date descending, with slug as a
stable tie-breaker. Older teaser URLs may remain indexable, but the RSS body remains
summary-only.

## 7. Account deletion

Account-coupled email makes self-service account deletion a launch dependency. The
current privacy copy already discusses deletion, but the product has no deletion
flow.

The Settings danger-zone flow must:

1. require a recent authenticated session and explicit confirmation;
2. show that Market Brief delivery, archive access, and saved product data will end;
3. identify active Stripe products and apply an explicit cancellation policy;
4. remove or suppress the Resend contact;
5. delete the Auth user through a service-owned endpoint;
6. rely on database cascades for local account-owned records;
7. record enough non-personal operational evidence to diagnose partial cleanup.

The implementation must never delete app access while leaving a paid Stripe
subscription renewing silently. The exact refund and effective-cancellation policy
must be approved before enabling deletion in production.

The safest MVP default is to return `409 active_billing` while any Stripe
subscription remains billable. Users cancel first and retain the account through the
paid period; deletion becomes available when billing is inactive. Immediate
cancellation and refunds require a separate approved business policy.

Current schema and webhook behavior require preparatory work before deletion:

- several account-owned tables have non-cascading foreign keys;
- Stripe customer metadata can restore a missing local user association;
- Stripe webhook processing has no provider-event ledger;
- bundled products cannot currently use the normal self-service cancellation path.

Deletion therefore remains a dedicated dependency-ordered project rather than an
incidental button added to Settings.

## 8. MVP legal and operational requirements

Required before the first public send:

- explicit consent timestamp and source;
- accurate sender identity and subject line;
- one-click unsubscribe;
- hard-bounce and complaint suppression;
- physical postal address in each marketing email;
- privacy-policy coverage for email collection and Resend processing;
- SPF, DKIM, and DMARC for the sending subdomain;
- linked attribution and short quotations rather than bulk republication;
- public corrections statement;
- source-specific API, licensing, and retention notes.

Live futures widgets, bulk social archiving, sponsorship policy, international
expansion policy, and automatic sending are not required for MVP.

## 9. Learning loop

Measure web performance from the publication timestamp. Start the email learning
window seven days after a provider-confirmed send timestamp, not merely after web
publication. If an edition remains an unsent draft, record the no-send reason and
omit email performance metrics rather than treating the publication date as a proxy.
After a confirmed send, generate a review packet containing:

- first generated draft versus merged edition;
- PR feedback and major rewrites;
- headline and subject-line changes;
- opens, clicks, replies, unsubscribes, and evidence-link usage;
- proposed editorial lessons for the next issue.

The LLM may propose lessons but cannot silently rewrite its durable editorial prompt.
Reusable lessons are promoted only after review.

## 10. Dependency-ordered PR plan

### MR-0: Canonical plan and strategy alignment

Repository: coffee-app. Documentation only.

- Add this implementation plan.
- Mark the earlier Market Wire implementation sequencing as superseded.
- Align `BLOG_STRATEGY.md` and `DEVLOG.md`.
- Remove the unrelated knowledge/vector work from Market Brief scope.

### MR-1A: Account-owned email-subscription foundation

Repository: parchment-api. **Merged and deployed in PR #109.**

- Add the normalized email-subscription schema and constraints.
- Require an existing Purveyors user.
- Add session-only preference-read and idempotent subscribe/unsubscribe contracts.
- Preserve `market_read` as the publication key and
  `/v1/email-subscriptions/market-read` as the deployed route.
- Reject anonymous, public-demo, and API-key preference mutation.
- Do not add account deletion, provider identifiers, Resend network calls, UI, or
  edition storage.

### MR-1B: Purpose-bound no-login unsubscribe

Repository: parchment-api. **Pending.**

- Add a Parchment-owned token-issuance contract, exposed through the generated SDK
  to an authorized bounded sender. It returns a purpose-bound, expiring
  `market_read_unsubscribe` token for exactly one account/topic and never exposes
  signing material.
- Add the no-login unsubscribe contract, which accepts only a valid Parchment-issued
  token and cannot subscribe or read preferences.
- Add token-issuance, token-validation, idempotency, and authorization tests,
  including expired, wrong-purpose, wrong-topic, and forged tokens.
- Reject anonymous, public-demo, and API-key mutation without that valid token.
- Do not add provider identifiers, Resend network calls, UI, or edition storage.

### MR-2: Resend projection and event reconciliation

Repository: parchment-api. The bounded projection worker is the Parchment-owned
**Market Brief projection worker** (`market-read-projection`); no coffee-app-side
component owns this shared provider or preference state.

- Add an atomic preference-change plus provider-outbox contract.
- Project active preferences into the Resend Market Brief Topic.
- Deduplicate provider webhooks by event ID and reconcile unsubscribe, hard-bounce,
  and complaint suppression locally; each reconciliation is idempotent on the
  provider event ID.
- Define one authenticated draft-operation contract owned by the
  `market-read-projection` worker:
  - **Authentication:** only the service-authenticated coffee-app deployment
    worker may invoke the bounded operation; anonymous, public-demo, and API-key
    callers are rejected.
  - **Audience and rendering:** the operation selects the topic-scoped audience
    and renders each recipient's purpose-bound, no-login unsubscribe link using
    the MR-1B Parchment token issuance. It never returns a raw list of account
    IDs, provider contact IDs, or shared preference rows to coffee-app.
  - **Provider ownership:** the operation creates or updates the Resend Broadcast
    and records its provider identifiers, delivery status, and idempotency ledger
    in Parchment. Coffee-app does not own shared preference or provider lifecycle
    state.
  - **Idempotency:** repeated calls for the same (Topic, edition, production
    commit) return the existing draft receipt without duplicating projection,
    suppression, broadcast, or ledger state.
  - **MR-11 consumption:** coffee-app submits only the production commit, edition
    slug, and rendered email content, then receives a bounded draft receipt. It
    cannot expand the audience or reach provider state directly.
- Provide the no-login one-click unsubscribe path through Resend's native topic
  unsubscribe or the MR-1B purpose-bound Parchment token if provider behavior
  requires it. The path may only unsubscribe one account/topic and must be
  idempotent.
- Do not send a Market Brief edition.

### MR-3: Coffee-app signup and preference surface

Repository: coffee-app.

- Add authenticated Market Brief opt-in.
- Route anonymous subscribe intent through login and back to confirmation.
- Add Settings status and unsubscribe control.
- Add the MR-1B no-login unsubscribe landing behavior, forwarding the existing
  provider or Parchment token without minting one or giving coffee-app direct write
  access to the shared preference row.
- Keep paid entitlements independent.

The existing Google login is sufficient for the first account-coupled flow. Adding
passwordless email authentication is useful funnel work but is not required to prove
the subscription contract.

### MR-4: Account-deletion prerequisites

Repositories: parchment-api, then coffee-app billing infrastructure where required.

- Add a service-owned deletion tombstone or state machine.
- Resolve non-cascading account-owned foreign keys deliberately.
- Harden Stripe webhook reconciliation against deleted or deleting users.
- Add provider-event idempotency.
- Make every paid product family cancellable through an explicit supported path.

### MR-5: Account-deletion orchestration

Repositories: dependency-ordered Parchment contract, then coffee-app UI.

- Add service-owned deletion orchestration with recent reauthentication.
- Return `409 active_billing` while any product remains billable.
- Handle Stripe and Resend external cleanup explicitly.
- Add danger-zone UI and consequence copy.
- Update privacy and retention copy to match actual behavior.

### MR-6: Market Brief content and archive surface

Repository: coffee-app.

- Add `essay | market-brief` metadata.
- Add format filters or tabs to `/blog`.
- Add edition metadata and Market Brief treatment.
- Enforce recent-three versus Intelligence archive access server-side.
- Add summary-only RSS behavior.

### MR-7: External-source observation contract

Repository: parchment-api.

- Add bounded, provenance-aware social/news observation storage.
- Add ingestion-run identity and revision metadata.
- Add service-authenticated ingest and weekly-window read contracts using a
  dedicated exact machine scope.
- Deduplicate by stable source identity and external ID, with normalized URL hash as
  the fallback.
- Keep content hash separate from identity so corrected feed metadata can update
  without duplicating an observation.
- Add retention and source-policy fields.
- Keep edition publication and vector knowledge out of scope.

### MR-8: Curated industry-feed capture

Repository: coffee-scraper.

- Add a standalone command for two or three verified public or permitted RSS feeds.
- Store title, link, date, author, and a bounded sanitized summary, not full article
  text.
- Add XML/entity safety, byte caps, deduplication, and a seven-day window.
- Write through the Parchment contract.
- Add dry-run fixtures and prove two idempotent reruns.
- Keep this command independent of the nightly all-supplier scrape.

### MR-9: Social-source capture

Repository: coffee-scraper.

- Add approved X, YouTube, Bluesky, and other configured source adapters.
- Keep a source-specific access, cost, attribution, and retention policy.
- Normalize engagement within each platform.
- Add strict rate and spending caps.
- Keep Reddit disabled until an approved API route is confirmed.

Social capture remains MVP scope because current conversation is the editorial
center of Market Brief. It follows the smaller RSS capture slice so provenance,
sanitization, and idempotent ingestion are proven before paid or rate-limited sources
are added.

### MR-10: Weekly source packet and draft PR

Repository: coffee-scraper.

- Assemble the seven-day source packet and Parchment facts.
- Generate and validate the `.svx` edition.
- Generate the hero asset through the established blog pipeline.
- Open a reviewable coffee-app PR with a validation summary.

### MR-11: Production-success to Resend draft

Repositories: coffee-app plus the Parchment-owned `market-read-projection`
draft operation from MR-2.

- Add the successful-deployment trigger.
- Render email-safe HTML from the canonical edition.
- Invoke the authenticated MR-2 draft operation with the production commit,
  edition slug, and rendered email content. The Parchment worker selects the
  audience, renders recipient-specific unsubscribe links, creates or updates the
  idempotent Resend Broadcast draft, and records the production commit, edition
  slug, broadcast ID, and status durably in Parchment. Coffee-app receives only a
  bounded draft receipt; it must not enumerate recipients, mint tokens, or read
  shared provider state.
- Reuse MR-2's provider reconciliation and suppression state; do not process
  unsubscribe, bounce, or complaint webhooks in this deployment slice.
- Keep manual send approval.

### MR-12: Learning report

Repository: coffee-scraper or the established editorial automation owner.

- Compare generated and merged content.
- Collect bounded seven-day performance signals.
- Produce reviewed editorial lessons.

### MR-13: Pricing

Repository: coffee-app after Reed supplies the matching Stripe price identifiers.

- Change Intelligence to $12, Studio to $5, and the bundle to $15.
- Update annual pricing, checkout, marketing copy, and tests together.
- Keep this independent of Market Brief delivery correctness.

## 11. Explicitly deferred

- automatic email sending;
- personalized editions and immediate alerts;
- public Market Brief API and CLI commands;
- vector ingestion, knowledge search, chat integration, and catalog-chunk retirement;
- live futures widgets;
- cross-platform social posting;
- referral and sponsorship systems;
- hard DRM for edition source in the public repository.

## 12. Launch checkpoints

The MVP is operationally ready when:

- a real account can explicitly subscribe and unsubscribe;
- one-click unsubscribe and provider suppression reconcile locally;
- account deletion cannot orphan a renewing paid subscription or email contact;
- daily capture produces a bounded seven-day source packet;
- the weekly job opens a valid previewable PR;
- a merged edition deploys successfully before a Resend draft is created;
- Reed can approve the email manually;
- failures are visible and retryable;
- the first three editions publish on schedule.
