# Reuse Parchment's verified session identity

> **Superseded in part, October 5, 2026.** This note says no cross-request cache or revocation window is introduced. That was true of this slice and is no longer true of the app: a verified identity is now reused for ten seconds on read requests, for session cookies, bearer sessions, and API keys alike. The current rule and its freshness limits are in [Authentication and authorization boundary](../ARCHITECTURE.md#authentication-and-authorization-boundary). Everything else below still holds. An answer that fails these validation rules is never reused, and an API key still carries no user identity.

This is the authentication slice of the [September 10 performance audit](https://github.com/reedwhetstone/parchment-api/pull/292).

The web resolver reads the cookie only to obtain a credential. Parchment's `/me` validates it against live Supabase Auth and current entitlements. When that response includes the additive `sessionIdentity` field, the web app uses its ID/email rather than making a second Auth request. Cookie user fields never grant identity or roles. Principal user types deliberately expose only the two verified fields needed by existing callers.

The request must still be a canonical authenticated session, and the verified identity ID must match its canonical user ID. An explicit Authorization header retains precedence over cookies. Malformed, null, or mismatched identity fails closed. Only an absent field permits the older-API fallback to independent live Supabase verification, with token continuity and ID equality checked. Outages still fail closed. No cross-request cache, token lifetime extension, revocation window, or API-key identity expansion is introduced.

Deploy Parchment's additive `/me` producer first to realize the saved lookup. Both rollout orders remain compatible, including independent rollback. Resource authorization, browser origin checks, and explicit account-deletion reauthentication are unchanged. The public SDK's JSON decoder preserves additive fields; this consumer validates the field at runtime without requiring a release of generated SDK types.

The call-count tests establish one fewer web-side Auth lookup with the new API, not a measured production latency reduction. `/me`, subsequent resource checks, and all current entitlement checks remain. Additional authentication optimization needs correlated production phase measurements.
