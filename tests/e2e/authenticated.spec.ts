import { test, expect } from '@playwright/test';

/**
 * Smoke tests for authenticated routes.
 *
 * These run with the session saved by auth.setup.ts.
 * Use codegen to record more tests:
 *   pnpm run test:codegen:auth
 */
test.describe('Authenticated routes', () => {
	test('can access /beans (member-only)', async ({ page }) => {
		await page.goto('/beans');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(/beans/);
	});

	test('can access /roast (member-only)', async ({ page }) => {
		await page.goto('/roast');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveURL(/roast/);
	});

	test('can access /profit (member-only)', async ({ page }) => {
		// Use 'commit' instead of networkidle — the profit page's LayerCake charts
		// keep the network active indefinitely, causing networkidle to time out.
		await page.goto('/profit', { waitUntil: 'commit' });
		await expect(page).toHaveURL(/profit/);
	});

	test('is not redirected to /catalog from protected routes', async ({ page }) => {
		await page.goto('/beans');
		await page.waitForLoadState('networkidle');
		expect(page.url()).not.toContain('/catalog');
	});
});
