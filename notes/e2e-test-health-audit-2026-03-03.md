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

1. **No synthetic DB seeding (prod-safe policy)**

   - Keep auth setup focused on authentication only.
   - Do not write synthetic seed rows via service-role in CI against prod DB.

2. **Replace skip-based logic with real precondition setup in `tests/e2e/crud.spec.ts`**

   - Add `ensureBeanExists()` that uses the real UI flow:
     - open Add Bean form
     - select a live catalog product
     - fill required fields
     - submit and assert `POST /api/beans` succeeds
   - This preserves end-to-end integrity and avoids skip-pass false positives.
   - Roast dropdown flow now ensures bean preconditions first, then asserts options load.

3. **Fix app-level blocker discovered by E2E**

   - `/api/beans` POST was sending a non-existent `name` field to `green_coffee_inv` inserts.
   - Removed invalid field from insert payload so form-based bean creation can succeed.

4. **Keep failures explicit**
   - If preconditions fail (form/API), tests fail with actionable error text.

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

This PR is about restoring test integrity first: no skip-based passing, real precondition setup through app flows, and explicit failures.
