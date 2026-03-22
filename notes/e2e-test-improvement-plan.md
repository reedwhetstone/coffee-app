# E2E Test Improvement Plan: From Smoke Tests to Production-Grade CI/CD

_Created: March 22, 2026_

## Current State Assessment

### What Exists

- 1 file: `tests/e2e/crud.spec.ts` (801 lines)
- 10 test cases across 4 `test.describe` blocks (Bean Management, Cupping Notes, Roast Profiles, Sales Management)
- Runs against **prod Supabase** with a real test user (`greenaziod@gmail.com`)
- Auth via stored `storageState` (pre-authenticated session)
- Single Chromium worker, serial execution
- ~7 minutes total CI run time

### What Works

- `addBeanToInventory()` is well-structured: API snapshot before, form submission, API verification after, DOM confirmation
- `navigateToBeans()` uses response interception instead of `waitForNetworkIdle` (better pattern)
- Error collection infrastructure exists (`setupErrorCollection`, ignore patterns, categorization)
- Helper functions are reusable and documented

### Systemic Problems

#### 1. No Assertions on Error Collection

The error collection system (`setupErrorCollection`) collects console errors and network errors meticulously, but `logErrors()` only `console.log`s them. **No test ever calls `expect()` on the collected errors.** This means:

- A page can throw 10 JS errors and the test passes
- A 500 server error on a background fetch goes unnoticed
- LayerCake rendering errors, fetch failures, and ECONNRESET all appear in logs but never fail a test

**Fix:** Add `expect(consoleErrors).toHaveLength(0)` and `expect(networkErrors.filter(e => e.status >= 500)).toHaveLength(0)` at the end of every test. This is the single highest-impact change.

#### 2. Tests Don't Assert Outcomes

Most tests verify "the page loaded" and "a button was clicked" but never verify the **result** of the action:

- `can navigate to beans`: checks Edit button visible, should check bean name/origin/price visible
- `can edit bean details`: checks Edit button returns, should verify field value changed via API
- `can edit cupping notes`: checks tab visible, should verify score persisted after page reload
- `can run through roast phases`: checks "Weight Loss" text, should verify clicking a phase changes state
- `can delete a roast profile`: calls `waitForNetworkIdle`, should verify profile count decreased
- `can create a new sale`: checks no 500 errors, should verify sale appears in profit summary
- `can change profit date range`: clicks buttons, should verify chart data or URL params changed

**Fix:** Each test needs at least one `expect()` that verifies the data change, not just that the UI rendered.

#### 3. Conditional Skips Hide Real Failures

Several tests use patterns like:

```typescript
const hasProfile = await profileCard.isVisible({ timeout: 5000 }).catch(() => false);
if (!hasProfile) {
	console.log('No roast profiles found; skipping...');
	return;
}
```

This means if the roast page is completely broken and renders nothing, the test **passes**. A test that can't distinguish between "no data for this user" and "page is broken" is not a test.

**Fix:** Replace conditional skips with explicit guards:

```typescript
// Verify the page itself loaded (even if empty)
await expect(page.getByText(/Roast Profiles|No profiles yet/i)).toBeVisible({ timeout: 10000 });

// If empty state, verify it's the real empty state, not a crash
if (await page.getByText(/No profiles yet/).isVisible()) {
	await expect(page.getByRole('button', { name: /New Roast/i })).toBeVisible();
	return; // Legitimate empty state
}
```

#### 4. No Test Isolation

All tests share a single test user's prod data. Side effects accumulate:

- `addBeanToInventory` creates beans that are never cleaned up
- `can create a new sale` creates sales against real inventory
- Roast profile tests consume inventory (depleting stock for subsequent runs)

**Fix:** Implement `test.beforeEach` / `test.afterEach` hooks, or use Supabase API directly for setup/teardown (faster than UI interactions).

#### 5. `waitForNetworkIdle` is Fragile

Used 15+ times. Races with client-side SvelteKit effects, fails when background fetches keep the network active, and the 3s timeout is often too short for CI.

**Fix:** Replace with specific response interception:

```typescript
// Bad
await submitBtn.click();
await waitForNetworkIdle(page);

// Good
const [response] = await Promise.all([
	page.waitForResponse(
		(resp) => resp.url().includes('/api/beans') && resp.request().method() === 'PUT'
	),
	submitBtn.click()
]);
expect(response.status()).toBeLessThan(400);
```

#### 6. No Page Object Model

All selectors are inline. `page.locator('button.group.relative').first()` appears in multiple tests. When the UI changes, every test breaks.

**Fix:** Extract page objects:

```typescript
// tests/e2e/pages/beans.page.ts
export class BeansPage {
  constructor(private page: Page) {}
  async navigate() { ... }
  async selectBean(index = 0) { ... }
  get firstBeanCard() { return this.page.locator('[data-testid="bean-card"]').first(); }
  get editButton() { return this.page.getByRole('button', { name: 'Edit' }); }
}
```

#### 7. No Data-Testid Attributes

Tests rely on text content (`/Start New Roast/i`), CSS classes (`button.group.relative`), and ARIA roles. These are fragile.

**Fix:** Add `data-testid` attributes to key interactive elements, then use `page.getByTestId()`.

#### 8. No Analytics Page Tests

The entire `/analytics` route has zero test coverage.

**Fix:** Add analytics test suite: public page load, stats validation, toggle behavior, chart rendering guards.

## Recommended Implementation Order

### Phase 1: Quick Wins (1 PR, ~2 hours)

1. **Assert on error collection** - add `expect()` calls to every test
2. **Fix conditional skips** - distinguish "no data" from "page broken"
3. **Remove `waitForNetworkIdle`** - replace with response interception

### Phase 2: Test Quality (1 PR, ~3 hours)

4. **Add outcome assertions** - every test verifies the data change
5. **Add analytics page tests** - public page load, stats, toggles
6. **Add `data-testid` attributes** - key interactive elements

### Phase 3: Architecture (2 PRs, ~4 hours)

7. **Extract page objects** - BeansPage, RoastPage, ProfitPage, AnalyticsPage
8. **Setup/teardown hooks** - beforeEach/afterEach for isolation
9. **API-based setup** - Supabase API for data seeding

### Phase 4: Coverage Expansion (ongoing)

10. Chat page tests, auth flow tests, error boundary tests, catalog tests, blog tests

## CI Pipeline Improvements

### Current

```
Code Quality (format + lint + type-check) -> Playwright Tests
```

### Recommended

```
Code Quality -> Unit Tests (Vitest) -> E2E Smoke (fast, 2 min) -> E2E Full (thorough, 10 min)
```

**Add Vitest unit tests** for server load functions, utility functions, chat tools, and API route handlers.

**Split E2E into two tiers:**

- **Smoke** (every PR): page loads, critical path (login -> add bean -> create roast -> record sale)
- **Full** (merge to main): all tests including edge cases, errors, and performance

## Summary

The current tests prove "the app boots and you can click things." The tests should prove "the app works correctly and handles errors gracefully."

**Single highest-ROI change:** `expect(consoleErrors).toHaveLength(0)` at the end of every test. That one line would catch LayerCake rendering errors, fetch failures, and most regressions before production.
