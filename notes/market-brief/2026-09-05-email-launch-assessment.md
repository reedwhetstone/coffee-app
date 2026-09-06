# Market Brief email launch assessment

**Observed:** September 5, 2026 Mountain / September 6, 2026 UTC.
**Verdict:** Continue toward a controlled email pilot; not ready for a full-list send.
**Scope:** Read-only assessment plus this report. No provider changes, production
configuration changes, subscriber mutations, drafts, or sends were performed.

## Executive assessment

The architecture is appropriate and does not need a rebuild. Keep coffee-app as
the canonical edition and projection owner, Parchment as the consent and provider
owner, and coffee-scraper as the editorial workflow owner. Keep Resend Broadcasts
and human-approved sends. The remaining work is more than a deployment hook:
production identity is currently absent, provider activation evidence is stale,
and the accepted send-readiness and delivery-observation lifecycle is incomplete.

## Evidence and confidence

Source assessment used freshly fetched `origin/main`, not the stale or dirty
primary working branches:

- coffee-app: `9b0a7a256ccd58244e54b2910ac6ceb67cc3e5ef`
- parchment-api: `50541cebcc101b1e56c9d0e82fce85cba649913b`
- coffee-scraper: `f470b67728bada3a5b295158d1ae9b6d6a32fc7e`

Live anonymous HTTPS reads confirmed:

- `/market-wire`, `/blog/market-brief-002`, and `/blog/feed.xml` return 200.
- The landing page still says “Weekly when live” and “Market Brief waitlist.”
- Edition 002 is present in RSS. RSS links use the non-www host while the
  edition/projection canonical uses `www.purveyors.io`.
- Edition 002 contains none of the five `purveyors:market-brief-*` metadata tags;
  serialized page data explicitly contains `marketBriefDeployment:void 0`.
- Parchment `/health` returns `ok`. Live OpenAPI advertises draft admission,
  Resend webhook, preferences, and no-login unsubscribe routes. Route presence
  does not establish configured credentials, worker health, or audience safety.

Host-wide `openclaw cron list --json` confirms the Sunday review job is enabled
at `10 12 * * 0` UTC, with the last execution `ok`, announcement delivered, and
zero consecutive errors. Its next scheduled run is September 6 at 06:10 MDT.
The narrower automation-tool inventory omitted this job; absence from that
view was not evidence of deletion. Runtime diagnostics flag a legacy finite tool
cap that may omit newer MCP capabilities; review the exact required cap before
changing it, rather than broadening access indiscriminately.

The protected credential store is empty in this session. Current Render process
flags, Resend inventory/domain/webhook status, subscriber counts, database
capabilities, and projection backlog were **not independently re-read**. The
Parchment activation plan retains an August 30 passing provider preflight and
an applied database activation migration, but explicitly leaves provider-facing
cutover receipts incomplete. Do not interpret the historical zero-subscriber
baseline or verified DNS as current proof, and do not reapply the migration.

## Launch blockers, in recommended order

### 1. Restore verifiable production edition identity — coffee-app

`src/routes/blog/[slug]/+page.server.ts` deliberately preserves the article when
projection metadata cannot be produced. This is good reader isolation, but the
live missing metadata makes Parchment's `verifyMarketBriefDeployment` reject a
handoff before provider mutation. This is a demonstrated blocker, not just an
unimplemented hook.

Inspect exact-deployment logs and Vercel runtime metadata to distinguish missing
`VERCEL_ENV`/commit identity from renderer/import failure. Do not invent a commit
or weaken Parchment verification. Add a production artifact canary that proves
all five tags match the exact rendered projection; a healthy article alone must
not pass email readiness. Root cause remains unproven in this assessment.

### 2. Close provider activation evidence — Parchment and operations

Renew the existing read-only provider preflight against the configured sender,
Segment, opt-out-default Topic, and exact webhook. Inventory actual subscriber
consent, pending/retry/conflict work, suppressions, Contacts, and Broadcasts with
identity-free aggregate receipts. Unexpected state requires reconciliation, not
an import or a reset to the old empty-baseline assumption.

Verify the audience worker and account-deletion cleanup, signed webhook handling,
the dedicated draft credential, and current process flags. Verify mailbox sender
authentication, reply handling, provider capacity, and the delivered unsubscribe
experience before a pilot. Keep these checks distinct from database activation.

### 3. Add one durable production-success handoff — coffee-app

No current production-success caller submits the existing Parchment draft
contract. Add a thin exact-production-deployment trigger using the generated SDK
and dedicated machine credential; keep Resend credentials out of coffee-app and
coffee-scraper. Projection must derive from the reviewed deployed artifact.

Prove failed/preview deployments create nothing; replay creates no duplicate;
and a corrected edition retires its unsent predecessor through Parchment's
existing supersession contract. Do not resubmit every historic edition on every
unrelated site deployment. Make selection and first-activation behavior explicit.

The draft API currently advances recovery through repeated admission calls;
the audience interval worker is not a general draft retry worker. Persist a
handoff receipt and assign bounded retry ownership for pending, uncertain, or
retryable responses. Alert on exhaustion/conflict; never blindly create a new
provider draft to recover an ambiguous result.

### 4. Implement the accepted send-readiness gate — Parchment

Draft creation is not permission to send. PADR-0028 requires proof that the
audience has converged and that pending, uncertain, retrying, or conflicted
unsubscribe work blocks readiness. A newer unsubscribe invalidates prior proof.
Current draft acceptance/supersession plans explicitly defer this boundary, and
the runtime does not expose a send-readiness implementation.

Build the smallest operator-facing readiness result tied to the exact draft and
current consent/projection state. Define invalidation/expiry and how the human
checks it immediately before provider approval; a timestamped static checklist
alone cannot solve consent changing after the check. Detect provider-edited or
already-sent drafts. Do not add an automatic send path or assume the Resend send
button enforces Parchment's audience contract.

### 5. Prove the delivered path and honest measurement — Parchment / coffee-app

Use explicitly approved test recipients for the first pilot. Verify HTML and
plain text in real inboxes, mobile rendering, links, and actual provider-managed
one-click unsubscribe. Prove canonical opt-out convergence, suppression exclusion,
and account-deletion cleanup before expanding the audience.

The current webhook normalizer handles `contact.updated` and
`suppression.added`/`suppression.removed`; other events are unsupported/ignored.
It is not a complete sent/delivered/delayed/failed event ledger. Implement the
bounded provider-observation slice promised by PADR-0028, or explicitly record
provider-dashboard receipts for a pilot without claiming first-party delivery
metrics. Opens/clicks remain intentionally outside MVP measurement.

## Cleanup and improvements

- **Before first full send:** one Parchment-owned operating runbook for preflight,
  audience convergence, exact draft review, manual approval, retry/conflict
  recovery, and evidence. Containment disables new audience/draft work while
  preserving webhook and deletion cleanup; it does not erase provider bindings.
- **Before first full send:** monitor publication-to-draft lag, oldest pending
  opt-out, retry/conflict counts, worker liveness, and provider suppression and
  failure evidence. A 200 health endpoint is not delivery health.
- **At launch:** change waitlist language only after the email path works. Keep
  opt-in separate from account creation and paid access. Account-required signup
  is deliberate current behavior; assess conversion later rather than rebuilding
  anonymous signup as a launch dependency.
- **Email polish:** review the actual projection, not the web page as a proxy.
  The renderer projects article Markdown, not the richer web frontmatter cards.
  Confirm essential facts remain readable, keep markup compact enough to avoid
  inbox clipping, and confirm the sender identity/footer is complete. Do not make
  pixel parity with the interactive web reader a launch requirement.
- **Low-priority consistency:** normalize RSS canonical-host usage; converge
  public/operator naming on Market Brief while retaining compatibility paths and
  the internal `market_read` key. Do not perform a broad route rename.
- **Documentation:** qualify coffee-app's “activated” lifecycle summary with
  Parchment's actual provider-facing evidence gaps. Governance cleanup PRs #269
  and #576 are already merged; do not revive their superseded predecessors.
- **Later:** operator conflict UI and aggregate delivery reporting can grow from
  demonstrated use. Defer automatic sends, personalization, a new publication
  service, provider abstraction, and unrelated infrastructure refactors.

## Recommended delivery sequence

1. Repair production metadata and prove the exact email projection locally and
   against the deployed edition. Refresh provider/runtime inventory in parallel
   when protected access is available; do not mutate subscriber state to assess it.
2. Ship the production-success handoff with durable retry receipts. Canary one
   real **unsent** draft after the upstream provider gates are evidenced.
3. Complete Parchment send readiness and delivered-path safety proof. Run one
   explicitly approved small pilot, with truthful provider evidence.
4. Update launch copy, then manually approve the first full-list edition. Expand
   only after delivery, suppression, and unsubscribe outcomes have been reviewed.

## References

- [Current cross-product plan](implementation-plan.md)
- [Parchment activation status and outstanding receipts](https://github.com/reedwhetstone/parchment-api/blob/50541cebcc101b1e56c9d0e82fce85cba649913b/docs/plans/2026-08-30-market-brief-production-activation.md)
- [Accepted delivery lifecycle](https://github.com/reedwhetstone/parchment-api/blob/50541cebcc101b1e56c9d0e82fce85cba649913b/docs/adr/PADR-0028-market-brief-delivery-lifecycle.md)
- [Draft verification and recovery](https://github.com/reedwhetstone/parchment-api/blob/50541cebcc101b1e56c9d0e82fce85cba649913b/packages/api/src/marketBrief/drafts.ts)
- [Webhook event coverage](https://github.com/reedwhetstone/parchment-api/blob/50541cebcc101b1e56c9d0e82fce85cba649913b/packages/api/src/marketBrief/webhook.ts)
- [Editorial workflow](https://github.com/reedwhetstone/coffee-scraper/blob/f470b67728bada3a5b295158d1ae9b6d6a32fc7e/workflows/market-wire/README.md)
