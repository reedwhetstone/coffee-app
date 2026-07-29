# Parchment sales mutations cutover

## Scope

Move `/api/profit` sale create, update, and delete operations from direct Supabase access to the Parchment SDK 0.19.0 owner-sales contract. Preserve the cookie-session BFF boundary, trusted-origin mutation protection, create membership gate, legacy response shape, and the existing direct profit-summary read.

The diff exceeds the usual 500-line soft cap because this single boundary change removes the legacy direct CRUD implementation and replaces its route-contract tests together. It does not include account deletion, Market Wire, tasting writes, roast work, or Market Index backfill.

## Gate history

The first fresh-context gate returned `ready_with_fixes` with P0/P1/P2/P3 `0/1/1/0`:

- A component-lifetime idempotency key could replay a previously committed sale after the user edited an ambiguously failed submission.
- Mutation response handling could throw on null data or accept incomplete upstream resources.

The patch bound retry keys to the serialized payload, added strict runtime validation for complete sale resources, returned malformed upstream resources as `502 invalid_response`, and applied the existing trusted-origin guard to every mutation.

The focused re-review returned `ready_with_fixes` with P0/P1/P2/P3 `0/1/0/0`:

- The key still survived definitive HTTP failures, although reuse is valid only when `fetch` rejects before the client receives a response.

The final patch now clears the attempt after every resolved HTTP response and retains it only after an ambiguous transport failure. Tests cover concurrent duplicate suppression, same-payload ambiguous retry reuse, changed-payload retry rotation, and definitive-response retry rotation.

## Final verdict

```text
VERDICT: ready
P0: 0
P1: 0
P2: 0
P3: 0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: mergeable
```

No findings remained for response validation, trusted-origin enforcement, cookie-session authority, membership gating, direct-sales mutation removal, upstream error mapping, or the deferred profit-summary boundary.

## Validation

- `pnpm exec vitest run src/lib/server/parchmentSales.test.ts src/routes/api/profit/route.test.ts src/routes/api/profit/sales-read-boundary.test.ts src/routes/profit/SaleForm.test.ts`: `VALIDATION_PASS`, 37 tests.
- `pnpm check --fail-on-warnings`: `VALIDATION_PASS`, 0 errors and 0 warnings.
- `pnpm test -- --run`: `VALIDATION_PASS`, 1,051 tests passed and 11 skipped.
- `pnpm build`: `VALIDATION_PASS`.
- Changed-file Prettier, ESLint, and `git diff --check`: `VALIDATION_PASS`.
- `pnpm lint`: `VALIDATION_FAIL` due to pre-existing Prettier drift in 18 unrelated notes files; every changed file passes Prettier and ESLint.
