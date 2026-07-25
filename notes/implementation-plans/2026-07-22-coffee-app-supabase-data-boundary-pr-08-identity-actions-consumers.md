# PR 08: Coffee-app bean-identity and chat-action consumer cutover

## PR goal

Replace direct bean-identity and confirmed chat-action database calls with the
released Parchment SDK contracts.

## Why this slice comes now

PR 07 centralizes the sensitive business mutations. Coffee-app can now retain
only proposal, confirmation, and presentation responsibilities.

## In scope

- Bean identity state/candidate/review adapters
- `/api/chat/execute-action` delegation to Parchment
- Closed action payload mapping and stable execution IDs
- Existing action-card response and replay UX
- Delete direct identity tables/RPCs and `execute_chat_action`

## Out of scope

- Chat workspace/message storage
- Tool prompt redesign
- New action types

## Files to change

- `src/lib/server/beanIdentity.ts`
- `src/routes/api/chat/execute-action/+server.ts`
- chat action adapters/tests
- boundary manifest

## Acceptance criteria

- Confirmed actions execute once through Parchment and replay deterministically.
- Entitlement/ownership failures retain current user-facing behavior.
- No direct bean-identity or action-ledger mutation remains in coffee-app.

## Test plan

- Action mapping, replay, rejected entitlement, ownership, invalid payload,
  upstream timeout, and conflict cases
- Bean identity transition fixtures
- coffee-app check, focused tests, lint/format, and build

## Risks

- Network ambiguity after commit. Stable execution IDs and Parchment replay
  semantics are mandatory before cutover.

## Follow-on dependency

None. Workspace persistence remains explicitly app-local.
