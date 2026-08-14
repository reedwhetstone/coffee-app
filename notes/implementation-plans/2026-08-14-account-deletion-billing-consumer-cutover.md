# Account deletion and billing consumer cutover

## Outcome

Replace coffee-app's local billing and account-deletion authority with authenticated browser BFFs over `@purveyors/sdk` 0.28.0. Parchment becomes the only owner of Checkout admission and recovery, catalog/provider mapping, trial eligibility, Stripe webhook settlement, canonical subscriptions and mutations, entitlement recomputation, provider/local/Auth deletion, retries, and operator evidence.

Coffee-app retains cookie-session browser custody, same-origin enforcement, Google reauthentication, Ed25519 assertion signing, stable purchase keys and product presentation, embedded Stripe.js using the public publishable key, and transient browser request/admission state.

This PR does not deploy either application, apply migrations, change provider destinations, revoke deployed credentials, or execute the production maintenance window.

## Implementation boundary

- Pin exact `@purveyors/sdk` 0.28.0 and remove the server Stripe package.
- Replace the legacy `/api/stripe/*` surface with thin `/api/billing/*` BFF routes.
- Persist a stable Checkout request ID and returned admission ID before mounting embedded Checkout. Reconcile by admission ID without accepting or exposing Stripe identifiers.
- Load and mutate every canonical subscription as one unit. Bundled subscriptions name every product family and cancel or resume together.
- Proxy billing discrepancy reads and recomputes to Parchment without local database repair logic.
- Replace the shared-secret deletion capability with a rotating, purpose-bound Ed25519 assertion. Keep it only in a strict, HTTP-only deletion-route cookie, consume it after accepted or replayed operations, and use transient browser state for completion messaging.
- Delete direct Stripe, billing-table, entitlement-repair, webhook, provider-finalization, local Auth deletion, and account-bound deletion receipt paths.
- Retire server Stripe credentials, the deletion provider credential, and Checkout rollout flags from source and configuration contracts.

## Validation

- Exact SDK/lockfile assertion and frozen registry install.
- Focused BFF, Checkout identity, subscription mutation, signer, callback, deletion lifecycle, and admin proxy tests.
- Full unit tests, Svelte check with no warnings, build, changed-file lint, full lint, and `git diff --check`.
- Negative production source/config sweep for direct Stripe server calls, legacy Stripe routes, direct billing/deletion tables, local Auth deletion, provider-finalization, retired credentials/flags, Customer/Checkout Session/item/price identifiers in browser data, and deletion retry/accepted/completion cookies. The owner-bound `subscriptionId` handle required by the accepted PATCH contract is the sole management-identifier exception.

## Inherited invariant ledger

- `BFF-AUTH-CUSTODY`: cookie session, bearer rejection, same-origin mutation, and server-only session forwarding remain active until replacement-head proof.
- `OPAQUE-PROVIDER-CORRELATION`: coffee-app accepts and returns no Stripe Customer, Checkout Session, item, or price identity and persists no owner/provider correlation. The owner-bound `subscriptionId` required for whole-subscription mutation is the sole management-identifier exception.
- `BILLING-TRIAL-ELIGIBILITY`: Parchment alone owns owner-wide trial eligibility.
- `BILLING-INTERVAL-ADMISSION`: Parchment alone validates intervals, bundles, catalog retirement, and family conflicts.
- `BILLING-SUBSCRIPTION-MUTATION`: every self-serve family and bundle is displayed and mutated as one durable subscription.
- `BILLING-CUSTOMER-DELETION`: Parchment owns provider deletion, settlement, entitlement effects, and stale-event no-ops.
- `DELETION-ASSERTION`: purpose-bound one-use Ed25519 assertion with verifier-first rotation and bounded lifetime.
- `DELETION-CONVERGENCE`: Parchment owns provider-before-local-before-Auth completion; the browser exits after durable acceptance.
- `PROVIDER-CONFLICT-CLOSURE`: exact SDK 0.28.0 plus removal of alternate coffee-app writers preserves the merged upstream provider-correlation correction.
- `LEGACY-AUTHORITY-RETIREMENT`: no legacy route, credential, rollout flag, destination, webhook, or recovery path survives in production source/config.
- `ACTIVATION-COMPATIBILITY`: the consumer artifact remains undeployed until the accepted maintenance runbook and production canaries authorize activation.
