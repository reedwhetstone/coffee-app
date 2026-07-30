# Checkout admission consumer pre-submission review

## Scope

Coffee-app consumes Parchment's durable Checkout admission contract behind a
default-off rollout flag. The reviewed flow acquires an owner-bound admission
before Stripe creation, uses the admission ID as Stripe's idempotency key,
publishes the verified Stripe Session before returning its client secret, and
checks provider eligibility before admission-managed billing writes.

## Initial verdict

- Verdict: `ready_with_fixes`
- P0: 0
- P1: 2
- P2: 0
- P3: 1
- Scope assessment: `mergeable`

The review found that browser request identity was cleared before embedded
Checkout became usable, and that the temporary legacy-session drain flag also
disabled lifetime subscription reconciliation for historical subscriptions.

## Corrections

- Browser request identity now survives API success, Stripe initialization,
  mounting, and retryable failures. It rotates only after Checkout completion
  or an authoritative terminal admission response.
- Structured Checkout error envelopes preserve their code and message.
- Historical subscription events remain reconcilable for their lifetime.
- Admission-managed subscriptions resolve their Checkout Session and pass
  provider eligibility before reconciliation.
- Incomplete managed context returns non-2xx so Stripe retries.
- Runtime and environment checks enforce the provider credential's 32-character
  minimum, and the rollout guide documents the migration, credential mapping,
  webhook event, atomic legacy-drain enablement, and final flag removal.

## Final verdict

- Verdict: `ready`
- P0: 0
- P1: 0
- P2: 0
- P3: 0
- Next action: submit the PR
- Confidence: high

Focused validation passed with 35 tests across request identity, Checkout
creation, webhook behavior, and browser reconciliation. Svelte/TypeScript
checking and changed-file formatting also passed. Repository-wide lint remains
affected only by pre-existing formatting failures in unrelated notes files.
