# ADR 011: Atomic chat action execution ledger

**Status:** Accepted
**Date:** 2026-07-11

## Context

Chat action cards can remount or be replayed after network uncertainty. Component-local status cannot prevent duplicate inventory, roast, or sale writes, and a separate idempotency insert would leave a crash window between claiming a key and performing the business mutation.

## Decision

Every proposed write carries a stable execution ID derived from its assistant message and tool-call identity. The client persists the card's execution status in workspace canvas state. The server retains authentication and product-entitlement checks, then calls one `SECURITY DEFINER` Postgres transaction/RPC that locks a per-user execution key, independently rechecks entitlement and ownership, performs the owned business write, and records its result atomically. Authenticated users can read their own ledger rows but cannot mutate the ledger directly; the function is its only write path.

An identical key and payload returns the stored result. Reusing a key with a different action or fields is a conflict. Ownership checks remain inside the transaction as defense in depth. Failed transactions roll back both the business write and their pending ledger claim; failures are returned to the client but are not retained as durable ledger rows. A retry therefore executes the transaction again under the same key.

## Consequences

- Reloads, canvas remounts, retries, and concurrent duplicate requests cannot duplicate writes.
- The ledger provides an audit trail and deterministic replay result.
- The ledger records committed actions, not failed attempts. Failure telemetry remains an application-observability concern.
- Pre-migration action cards have no trustworthy execution identity and intentionally require the agent to propose them again rather than risking a duplicate write.
- Changes to supported write actions must be added to the transactional RPC as well as the UI/tool contract.
- Entitlements remain enforced by the server route; direct RPC access is limited to authenticated users and ownership is independently enforced by the function.
