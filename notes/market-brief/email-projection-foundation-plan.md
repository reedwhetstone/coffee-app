# Market Brief email projection foundation

**Status:** Implemented (MB-5A)

**Decision authority:** The accepted
[Market Brief implementation plan](implementation-plan.md), merged MB-1
[publication foundation](publication-format-plan.md), accepted Parchment
[PADR-0028](https://github.com/reedwhetstone/parchment-api/blob/ca3924cd079a6c36b47b170ee8dc6828db950c3d/docs/adr/PADR-0028-market-brief-delivery-lifecycle.md),
and the merged Parchment runtime lineage through PR #226.

**Implementation boundary:** Define the deterministic, email-safe projection of
one canonical Market Brief `.svx` edition and the public metadata Parchment can
later use to verify that exact edition version is deployed. This slice creates
no subscriber state, machine credential, outbound handoff, Parchment draft,
provider request, production deployment, or send authority.

## Outcome and non-goals

For any valid Market Brief edition, coffee-app can derive one stable subject,
HTML projection, text projection, canonical URL, and projection digest from the
same reviewed `.svx` artifact that renders the web page. A production page may
advertise its exact Vercel commit and projection digest only when a valid
production commit identity is available. Parchment can later compare that
deployed identity with the content submitted through its own draft-acceptance
contract without treating a merge, preview, or caller assertion as deployment
proof.

This slice does not include:

- an authored Market Brief edition or generated editorial content;
- subscriber signup, settings, consent, entitlement, or unsubscribe UI;
- a public Market Brief content API or a second edition store;
- a Parchment draft-acceptance endpoint, delivery ledger, machine scope, or
  credential;
- an outbound deployment-success trigger, GitHub workflow, or Vercel hook;
- Resend credentials, resources, contacts, drafts, provider calls, or webhooks;
- a postal-address configuration or send-readiness claim; and
- production deployment, activation, scheduling, approval, or sending.

## Authority and lifetime

- The reviewed `.svx` file remains the canonical authored edition for its full
  lifetime. The email is a deterministic projection, never a second editable
  artifact.
- The normalized blog registry remains the owner of edition identity, format,
  date, slug, and public visibility.
- The projection renderer owns only a versioned transformation from the
  canonical source into provider-neutral subject, HTML, and text.
- The projection digest identifies rendered bytes. It is not the edition
  version identity and cannot replace the exact production commit.
- The edition version is the canonical edition identity plus the exact Vercel
  production commit, as required by PADR-0028. Corrections therefore create a
  new version while preserving edition identity and canonical URL.
- The deployed page metadata is evidence about coffee-app deployment. It grants
  no Parchment authority and cannot create delivery work by itself.

## Source and projection contract

Market Brief content uses a deliberately bounded Markdown subset for email:

- headings, paragraphs, emphasis, links, images, lists, blockquotes, rules,
  tables, and code are supported;
- raw HTML, Svelte components, Svelte expressions, directives, and executable
  markup are rejected for Market Brief projection;
- links must resolve to HTTP, HTTPS, mailto, or a same-document anchor;
- images must resolve to HTTPS;
- authored HTML attributes and styles are not accepted;
- provider personalization and recipient data are absent; and
- the footer contains the canonical web URL and Resend's documented
  `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder. It does not mint a Parchment token
  or enumerate recipients.

The renderer applies a fixed versioned template, fixed allowlist sanitization,
absolute URLs, inline email-safe presentation, and bounded output. It emits a
plain-text companion from the same sanitized projection. The digest is SHA-256
over a canonical versioned payload containing subject, HTML, and text.

The first template deliberately makes no send-readiness claim. A truthful
physical postal address remains an activation requirement and must be accepted
before the later Parchment draft can become send-ready.

## Transition and failure model

1. The blog registry validates canonical Market Brief identity as in MB-1.
2. The reader loader reads the raw source for that same slug and rejects a
   missing source, non-Market Brief post, malformed frontmatter boundary, or
   unsupported source construct before the public edition renders.
3. Markdown links and images are normalized against the canonical production
   URL. Unsafe schemes and non-HTTPS images fail instead of being silently
   rewritten into a different meaning.
4. A fixed renderer and sanitizer produce HTML and text. Oversized input or
   output fails deterministically.
5. The projection digest covers the exact versioned subject, HTML, and text.
6. A valid 40-character Vercel production commit from `VERCEL_ENV=production`
   may be combined with edition identity and digest into deployed metadata.
   Preview, missing, or malformed deployment identity omits that metadata while
   leaving the public web edition readable.
7. If the production-only projection runtime cannot initialize after canonical
   source validation, the public edition remains readable and emits no deployed
   metadata. The error is logged, and any later delivery handoff must fail closed
   on the missing proof instead of treating the page response as deployment proof.
8. A preview, local build, replay, or branch deployment cannot claim a production
   version merely by possessing the source commit. The future outbound handoff
   remains separately gated on a successful production deployment event.

## Sibling and caller inventory

- `src/lib/server/blog.ts` remains the canonical registry and gains the raw
  source lookup used by the projection.
- The Market Brief projection module owns source-subset validation, deterministic
  rendering, digesting, and deployed-manifest construction.
- `/blog/[slug]` remains the sole reader URL. Its server load derives deployed
  metadata only for Market Brief editions, and its head emits no email body or
  subscriber data.
- RSS, sitemap, `llms.txt`, archive filters, tag routes, and essay rendering keep
  their MB-1 behavior and do not derive a competing projection.
- Parchment has no runtime caller in this slice. Its next successor owns draft
  acceptance, machine authorization, immutable version admission, provider
  creation, ambiguity recovery, and independent deployed-page verification.
- The later coffee-app trigger will call that accepted Parchment operation only
  after production deployment succeeds. It will reuse this renderer rather than
  create another email template.

## PR and dependency boundary

This PR owns one coherent MB-5A foundation:

1. raw canonical source lookup without a second content store;
2. the supported source subset and negative validation;
3. deterministic sanitized HTML and text rendering;
4. subject, canonical URL, provider-managed unsubscribe placeholder, and digest;
5. deployed edition/version metadata on the canonical page; and
6. current-head tests, plan, and inherited invariant ledger.

The outbound handoff is not included because no accepted Parchment draft route
or dedicated machine authority exists. The dependency order is therefore:

1. coffee-app MB-5A projection and deployed identity;
2. Parchment draft acceptance, immutable edition-version ledger, provider-draft
   recovery, and machine authorization; then
3. coffee-app production-success trigger using that exact generated SDK contract.

This is a repository-ownership and recovery boundary, not a split by technical
layer.

## Acceptance and validation

- A valid Market Brief fixture produces the expected subject, canonical URL,
  sanitized HTML, readable text, and stable SHA-256 digest.
- Rendering the same edition twice produces byte-identical subject, HTML, text,
  and digest.
- A content change changes the digest while retaining the edition and canonical
  URL; a production-commit change changes the edition version without changing
  the content digest.
- Raw HTML, Svelte constructs, unsafe links, non-HTTPS images, malformed source,
  non-Market Brief posts, missing raw source, and oversized content fail closed
  at canonical reader validation and in the projection test corpus.
- A production-only projection runtime failure omits deployment metadata without
  taking the public reader down; the absent manifest remains a hard stop for any
  later delivery handoff.
- The HTML allowlist removes no supported Markdown semantics, contains no script,
  event attribute, remote credential, recipient identifier, or provider ID, and
  includes the exact Resend unsubscribe placeholder once.
- The plain-text projection contains the canonical URL and unsubscribe guidance.
- Only a valid exact production commit creates deployed metadata. Missing or
  malformed commit identity never blocks the public edition and never emits a
  false deployment claim.
- Essay routes, Market Brief metadata, feed, sitemap, `llms.txt`, archive filters,
  tags, drafts, and corrections preserve their MB-1 behavior.
- Focused tests, full unit tests, formatting, ESLint, Svelte checks, build, and
  `git diff --check` pass. Existing unrelated baseline failures are named rather
  than attributed to this PR.

## Rollout and rollback

The slice is dormant until a Market Brief edition exists. It makes no network
request and requires no credential. A production page with a valid Vercel commit
emits verification metadata, but no delivery work consumes it until Parchment's
successor is accepted and deployed. Rollback removes the projection and metadata
while preserving the MB-1 web publication format and every essay.

## Inherited knowledge ledger

- `MB-AUTHORITY` | coffee-app owns canonical edition/rendering; Parchment owns
  consent and provider lifecycle | provider-neutral projection only; no provider
  caller or shared state | active until current-head proof passes | PR #502,
  PR #538, PADR-0028
- `MB-CANONICAL-EDITION` | one reviewed `.svx` artifact feeds web, feed, and email
  | raw source and normalized registry feed one versioned projection; no second
  content store | active | PR #502 and PR #539
- `MB-EDITION-VERSION` | edition identity plus exact production commit defines a
  deliverable version; content hash is only projection integrity | deployed
  metadata keeps commit and digest separate | active | PADR-0028
- `MB-DELIVERY` | deployment precedes draft; approval precedes send | metadata is
  emitted only for a valid production commit and creates no work | deferred to
  Parchment draft acceptance and later coffee-app trigger | PR #502 and PADR-0028
- `MB-MACHINE-AUTHORITY` | only a dedicated bounded coffee-app machine principal
  may request draft work | no credential or outbound caller exists in MB-5A |
  deferred to the named Parchment successor | PR #502 correction
  `r3653796621` and PADR-0028
- `MB-CONSENT` | identity, consent, entitlement, suppression, and unsubscribe stay
  distinct | projection contains no audience or consent data and uses only the
  provider-managed placeholder | active/proven in scope | PRs #221-#226
- `MB-UNSUBSCRIBE-LIFETIME` | delivered unsubscribe remains usable without login
  | Resend replaces its documented Broadcast placeholder per Contact; Parchment
  still owns canonical convergence | active/proven in scope | PR #502 correction
  `r3653884045`, PR #225, PADR-0028
- `MB-PRIVACY` | raw recipient identity and provider IDs stay in bounded private
  owners | projection contains neither and deployed metadata exposes only public
  edition identity, commit, renderer version, and digest | active | PRs #224-#226
- `MB-NAMING` | Market Brief is public; `market_read` remains internal | subject,
  template, and metadata use Market Brief only | active | PR #502 and PR #539
- `MB-SOURCE-IDENTITY` and `MB-CADENCE` | source observation identity and weekly
  generation stay with coffee-scraper | no capture or scheduler enters this slice
  | deferred to MB-4 | accepted implementation plan
- `MB-DOC-AUTHORITY` | historical Market Wire records cannot drive implementation
  | this selected plan extends only accepted MB-1 and PADR-0028 direction |
  proven | PR #538

## Named successors

Parchment next owns immutable draft acceptance and recovery for the exact
`(edition, production commit, projection digest)` boundary, including its
dedicated machine authority and independent verification of the deployed page.
After that generated SDK contract is deployed, coffee-app can add the thin
production-success trigger. Neither successor may add automatic send.
