# Parchment inventory delete cutover pre-submission audit

## Intent

Replace only the Portfolio inventory DELETE path with the published
session-mode Parchment SDK contract. Preserve the legacy success envelope while
adopting the API's safer dependency conflict behavior instead of cascading
through roast and sales history.

## Scope

- `/api/beans?id=:id` DELETE delegates to `client.inventory.delete(id)`.
- Upstream 404, 409, 429, and 503 statuses are preserved.
- Dependency conflicts keep the inventory row visible and show actionable
  feedback.
- A stale 404 refreshes the Portfolio because the desired absent state already
  exists.
- The direct-Supabase cascade helper is removed.
- Confirmation copy and route documentation no longer promise destructive
  cascading deletion.
- POST, PUT, tasting writes, stocked recomputation, and the unpublished SDK
  0.19.0 batch contract remain out of scope.

## Gate result

The initial independent gate found one P2: a 404 said the item was absent but
left the stale row visible. The patch makes that outcome idempotent by
refreshing on 404. A focused independent re-review passed.

```text
VERDICT: ready
P0/P1/P2/P3: 0/0/0/0
NEXT_ACTION: merge
CONFIDENCE: high
SCOPE_ASSESSMENT: correct_boundary
```

## Validation

- `VALIDATION_PASS` 33 focused route, adapter, boundary, and UI-controller tests
- `VALIDATION_PASS pnpm test` (996 passed; 11 skipped by suite configuration)
- `VALIDATION_PASS pnpm check` (zero errors and zero warnings)
- `VALIDATION_PASS` targeted ESLint and Prettier
- `VALIDATION_PASS pnpm build`
- `VALIDATION_PASS git diff --check`
