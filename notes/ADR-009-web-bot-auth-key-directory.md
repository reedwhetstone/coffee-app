# ADR-009: Host the Purveyors Web Bot Auth Key Directory

**Status:** Accepted

**Date:** 2026-07-15

## Context

Shopify now gives unsigned automated storefront traffic its strictest rate
limits and directs crawler operators to Web Bot Auth. Purveyors needs one stable
HTTPS identity that Shopify can verify without publishing private signing
material. The scraper host is not a public HTTPS service, while coffee-app
already owns the canonical `purveyors.io` public origin.

This is Shopify's bot-operator flow, not the merchant Crawler Access flow.
Shopify's operator registration form requires each bot to send its own
`Signature-Agent` value and expose its own public-key directory before
registration. The Shopify-admin signatures with
`Signature-Agent: "https://shopify.com"` are domain-scoped credentials for a
merchant crawling a store that merchant controls. Purveyors does not administer
supplier stores, so those merchant-issued credentials are not applicable.

## Decision

Coffee-app will serve the required signed JWKS response at
`/.well-known/http-message-signatures-directory`. The endpoint reads one
Ed25519 private JWK from `WEB_BOT_AUTH_PRIVATE_JWK`, publishes only its public
members, binds each response to the incoming authority using HTTP Message
Signatures, and returns `503` when the identity is absent or malformed.

The same private JWK is deployed to the coffee-scraper runtime so outgoing
Shopify requests and the public directory share one cryptographic identity.
Keys are environment secrets, never repository content. The first release
supports one active key. Rotation therefore requires a maintenance window:
pause signed traffic, replace the shared secret and registration, wait for the
five-minute directory cache to expire, then resume. Multi-key overlap is a
future hardening step and must be implemented before zero-downtime rotation.

## Consequences

### Positive

- Shopify can verify a stable Purveyors crawler identity independently of IP.
- The private key never appears in the public directory or source control.
- Invalid deployment configuration fails visibly instead of publishing an
  unsigned or misleading identity document.

### Negative

- Coffee-app and coffee-scraper must share and rotate one deployment secret.
- The directory depends on the availability of the Vercel-hosted public app.
- Web Bot Auth improves identity and rate-limit eligibility but does not replace
  the scraper's conservative request pacing and durable backoff.

### Risks and Tradeoffs

The directory response is dynamic because it must be signed for the requested
authority and expire. A five-minute cache window reduces serverless load while
remaining well inside the one-hour signature lifetime. Key compromise requires
immediate secret rotation and removal of the old public key.
