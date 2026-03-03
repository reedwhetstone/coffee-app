# E2E Test Health Audit (2026-03-03)

## Why this exists

Recent CI failures exposed a bad pattern: tests were passing by skipping when required data was missing. That defeats E2E’s purpose.

This audit defines the reliability baseline and the refactor plan for deterministic, comprehensive E2E coverage.

## Current Coverage Snapshot

| Area                                  | Current Coverage                      | Status  | Gaps                                                 |
| ------------------------------------- | ------------------------------------- | ------- | ---------------------------------------------------- |
| Authenticated route access            | `/beans`, `/roast`, `/profit` smoke   | Partial | No role-based assertions, no logout/auth edge states |
| Bean management                       | View, edit, cupping flow              | Good    | Empty/error states, filter/search behavior           |
| Roast profiles                        | Create, open, delete, dropdown create | Partial | Deterministic setup previously missing               |
| Sales/profit                          | Create sale, date-range toggle        | Partial | Profit math verification, chart assertions           |
| Public pages                          | Minimal/none                          | Weak    | Catalog/public blog/home/contact flows               |
| Subscription/admin/chat/api-dashboard | None                                  | Missing | Full area not covered                                |

## Reliability Risks Found

1. **Skip-based false positives**
   - Tests skipped when no inventory/roast data existed.
2. **Non-deterministic test data**
   - Suite relied on whatever happened to exist for a real user.
3. **Brittle waits**
   - Heavy `networkidle` and ad-hoc timing waits create CI variability.
4. **Conditional assertions**
   - Some tests verified behavior only if elements happened to exist.

## P0 Remediation (this PR)

1. **Deterministic seed in `tests/e2e/auth.setup.ts`**

   - After auth session creation, use service-role REST calls to ensure:
     - at least one `green_coffee_inv` row for the test user
     - at least one `roast_profiles` row tied to that inventory bean
   - This removes the need for skip guards and enforces real assertions.

2. **Remove skip-based logic in `tests/e2e/crud.spec.ts`**

   - Replace `skipIfNoBeans` pattern with hard precondition assertions.
   - Roast dropdown test now asserts selectable coffee options must exist.
   - Roast phase/delete tests now assert profile presence instead of logging/skipping.

3. **Keep failures explicit**
   - If seed or preconditions fail, test fails with actionable error text.

## P1 Refactor Plan (next PRs)

1. **Introduce E2E fixtures + page objects**
   - `tests/e2e/fixtures/base.fixture.ts`
   - `tests/e2e/models/BeansPage.ts`, `RoastPage.ts`, `ProfitPage.ts`
2. **Replace `waitForTimeout`/`networkidle` with UI-state waits**
   - Prefer `expect(locator).toBeVisible()/toBeHidden()/toHaveText()`.
3. **Standardize helper assertions**
   - Success toasts, API status, modal close/open checks.

## P2 Coverage Expansion

1. Public route + guest experience suite
2. Subscription lifecycle suite (checkout/cancel/resume)
3. Admin/dashboard role suite
4. Chat/workspace/API-dashboard suite

## Non-goals for this PR

- Rewriting every spec into page objects in one pass
- Adding Stripe/admin/chat full coverage immediately

This PR is about restoring test integrity first: deterministic data + no skip-based passing.
