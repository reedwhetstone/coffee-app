# Purveyors Market Read MVP Implementation Plan

**Status:** Accepted for implementation
**Working name:** Purveyors Market Read
**Updated:** 2026-07-26
**Authority:** This document supersedes the implementation sequencing and unresolved
product choices in `design.md` and `infrastructure.md`. `research.md` remains the
research record.

## 1. Product definition

Purveyors Market Read is a reliable weekly read of the micro-movements shaping green
coffee: what people are noticing, discussing, buying, questioning, and reacting to,
supported by Purveyors market data where it adds evidence.

The editorial product leads with current industry conversation, news, and sentiment.
Purveyors data validates, challenges, or adds buying context. Broad macro commentary
is supporting context because established coffee publications and importers already
cover it well.

Market Read and the existing blog are two formats in one publishing system:

- `essay`: sporadic, idea-led analysis using the current blog workflow.
- `market-read`: a weekly, source-led review of green-coffee news, sentiment, and
  buying signals.

Both formats live under `/blog`, share the same visual system and PR review workflow,
and can link to catalog, Market Index, and Parchment Intelligence. The blog index
provides format tabs or filters. A future `/market-read` vanity path may redirect to
the filtered blog view, but a separate publication application is not part of MVP.

## 2. MVP principles

1. **The weekly habit is the product.** Missing one edition is a visible operational
   failure.
2. **Current conversation leads.** Social and industry sources establish the weekly
   narrative; Purveyors data supplies evidence and buying context.
3. **Facts precede prose.** Numeric and product claims come from deterministic,
   cited inputs before the LLM drafts.
4. **One reviewed artifact feeds every channel.** The merged Market Read content file
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

Every Market Read email subscriber must have:

- a Supabase Auth user;
- the normal `public.user_roles` row with baseline `role = viewer`;
- a separate account-owned email-subscription record for the `market_read` topic.

The model has three independent axes:

- `user_roles.role`: application role. `viewer` is free; `member` grants Mallard
  Studio; `admin` is operational.
- `user_roles.ppi_access`: Parchment Intelligence entitlement.
- `email_subscriptions.status`: permission to deliver Market Read email.

The email record is not a second user system. It is a normalized child of the
Purveyors account. It exists separately because consent, unsubscribe, bounce, and
complaint state do not belong in the role hierarchy.

The canonical preference row stores the user, publication, consent status, and
timestamps. It does not duplicate the user's email address or store Resend-specific
identifiers. Provider projection and event state belong in a dependent connector
contract.

MVP preference states are:

- `subscribed`: active explicit consent;
- `unsubscribed`: user-revoked consent;
- `suppressed`: delivery blocked by hard bounce, complaint, or an operator safety
  action.

Consent source and timestamps remain durable. Provider event IDs, contact IDs, retry
state, and broadcast IDs live outside this canonical preference row.

### State behavior

- Creating a Purveyors account does not automatically opt the user into Market Read.
- Subscribing requires authentication and explicit consent.
- Upgrading to Intelligence does not automatically subscribe the user to email.
- Unsubscribing does not remove Studio or Intelligence access.
- Canceling a paid product does not unsubscribe the free email.
- Deleting the Purveyors account ends Market Read delivery.
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

Market Read reuses the current MDsveX blog pipeline. A published issue is an `.svx`
file with the existing blog metadata plus:

```yaml
format: market-read
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

The LLM receives the source packet, structured facts, Market Read editorial rules,
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
- missing hero art or Market Read visual treatment.

The job opens a coffee-app PR containing the edition, hero asset, and validation
summary. Reed reviews the Vercel preview and iterates through the PR.

## 6. Publication and delivery

The launch sequence is:

1. Market Read PR merges.
2. Vercel production deployment reports success.
3. A GitHub Action identifies the newly published Market Read edition.
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

- Purveyors stores canonical consent and suppression state.
- Resend Topics group the projected recipients.
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
2. show that Market Read delivery, archive access, and saved product data will end;
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

Seven days after publication, generate a review packet containing:

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
- Remove the unrelated knowledge/vector work from Market Read scope.

### MR-1: Account-owned email-subscription contract

Repository: parchment-api.

- Add the normalized email-subscription schema and constraints.
- Require an existing Purveyors user.
- Add session-only preference-read and idempotent subscribe/unsubscribe contracts.
- Add a dedicated `POST /v1/email-subscriptions/market-read/unsubscribe` contract for
  no-login links. It accepts only a Parchment-issued, purpose-bound, expiring
  `market_read_unsubscribe` token. The token targets one account/topic, cannot
  subscribe or read preferences, and the operation is idempotent.
- Add token-validation, idempotency, and authorization tests, including expired,
  wrong-purpose, wrong-topic, and forged tokens.
- Reject anonymous, public-demo, and API-key mutation without that signed token.
- Do not add account deletion, provider identifiers, Resend network calls, UI, or
  edition storage.

### MR-2: Resend projection and event reconciliation

Repositories: parchment-api and the selected bounded worker owner.

- Add an atomic preference-change plus provider-outbox contract.
- Project active preferences into the Resend Market Read Topic.
- Deduplicate provider webhooks by event ID.
- Reconcile unsubscribe, hard-bounce, and complaint suppression locally.
- Do not send a Market Read edition.

### MR-3: Coffee-app signup and preference surface

Repository: coffee-app.

- Add authenticated Market Read opt-in.
- Route anonymous subscribe intent through login and back to confirmation.
- Add Settings status and unsubscribe control.
- Add signed one-click unsubscribe link handling against MR-1's token contract;
  coffee-app forwards the token and does not mutate the shared subscription row.
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

### MR-6: Market Read content and archive surface

Repository: coffee-app.

- Add `essay | market-read` metadata.
- Add format filters or tabs to `/blog`.
- Add edition metadata and Market Read treatment.
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
center of Market Read. It follows the smaller RSS capture slice so provenance,
sanitization, and idempotent ingestion are proven before paid or rate-limited sources
are added.

### MR-10: Weekly source packet and draft PR

Repository: coffee-scraper.

- Assemble the seven-day source packet and Parchment facts.
- Generate and validate the `.svx` edition.
- Generate the hero asset through the established blog pipeline.
- Open a reviewable coffee-app PR with a validation summary.

### MR-11: Production-success to Resend draft

Repositories: coffee-app, with Parchment provider-state support if needed.

- Add the successful-deployment trigger.
- Render email-safe HTML from the canonical edition.
- Create or update an idempotent Resend Broadcast draft.
- Record the production commit, edition slug, broadcast ID, and status durably in
  Parchment.
- Process unsubscribe, bounce, and complaint webhooks.
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
- Keep this independent of Market Read delivery correctness.

## 11. Explicitly deferred

- automatic email sending;
- personalized editions and immediate alerts;
- public Market Read API and CLI commands;
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
