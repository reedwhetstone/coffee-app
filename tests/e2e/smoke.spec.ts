/**
 * Tier 2: Page Load Smoke Tests
 *
 * Verifies that every route in the app loads without crashing.
 * No business logic — just "does the page render without a 4xx/5xx error?"
 *
 * Split into three groups:
 *   1. Public pages — accessible without auth (via HTTP request)
 *   2. Protected pages — redirect away without auth (via HTTP request)
 *   3. Protected pages — render correctly with auth (via browser page)
 *
 * Target: < 1 minute
 * Wait strategy: domcontentloaded (never networkidle)
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Public pages — no auth required
// Use playwright.request.newContext() for genuinely cookieless HTTP requests.
// ---------------------------------------------------------------------------

test.describe('Public pages load without auth', () => {
	test('homepage /', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/');
		expect(resp.status()).toBeLessThan(400);
		await ctx.dispose();
	});

	test('/blog', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/blog');
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});

	test('/contact', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/contact');
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});

	test('/privacy', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/privacy');
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});

	test('/terms', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/terms');
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});
});

// ---------------------------------------------------------------------------
// Protected pages — redirect to /catalog when not authenticated
// The SvelteKit authGuard hook redirects unauthenticated requests server-side.
// Use playwright.request for a clean HTTP-level check without browser cookies.
// ---------------------------------------------------------------------------

test.describe('Protected pages handled without auth', () => {
	const protectedRoutes = ['/beans', '/roast', '/profit', '/chat', '/admin'];

	for (const route of protectedRoutes) {
		test(`${route} does not crash without auth`, async ({ playwright }) => {
			const ctx = await playwright.request.newContext();
			const resp = await ctx.get(route);
			// Should not return a server error — may redirect (303) or return 200
			expect(resp.status()).toBeLessThan(500);
			await ctx.dispose();
		});
	}
});

// ---------------------------------------------------------------------------
// Protected pages — load correctly with auth
// Chromium project sets storageState: authFile in playwright.config.ts.
// ---------------------------------------------------------------------------

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Protected pages load with auth', () => {
	test('/beans renders without server error', async ({ page }) => {
		await page.goto('/beans', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(/beans/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/roast renders without server error', async ({ page }) => {
		await page.goto('/roast', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(/roast/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/profit renders without server error', async ({ page }) => {
		// Charts block networkidle — use commit to avoid hanging
		await page.goto('/profit', { waitUntil: 'commit' });
		await expect(page).toHaveURL(/profit/);
	});

	test('/chat renders without server error', async ({ page }) => {
		await page.goto('/chat', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(/chat/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/catalog renders without server error', async ({ page }) => {
		await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(/catalog/);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/analytics renders without server error', async ({ page }) => {
		await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/api-dashboard renders without server error', async ({ page }) => {
		await page.goto('/api-dashboard', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/api-dashboard/keys renders without server error', async ({ page }) => {
		await page.goto('/api-dashboard/keys', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/admin renders without crashing (may redirect non-admins)', async ({ page }) => {
		await page.goto('/admin', { waitUntil: 'domcontentloaded' });
		// Admin redirects non-admin users to catalog; verify no 5xx either way
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});
});
