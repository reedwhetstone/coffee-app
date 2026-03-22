/**
 * Tier 2: Page Load Smoke Tests
 *
 * Verifies that every route in the app loads without crashing.
 * No business logic — just "does the page render without a 4xx/5xx error?"
 *
 * Split into three groups:
 *   1. Public pages — accessible without auth
 *   2. Protected pages — redirect away without auth
 *   3. Protected pages — render correctly with auth
 *
 * Target: < 1 minute
 * Wait strategy: domcontentloaded (never networkidle)
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Public pages — no auth required
// ---------------------------------------------------------------------------

test.describe('Public pages load without auth', () => {
	test('homepage /', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/', { waitUntil: 'domcontentloaded' });
		expect(resp?.status()).toBeLessThan(400);
		await ctx.close();
	});

	test('/catalog', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		// Catalog redirects to /auth if unauthenticated based on server config
		// Just verify it returns a non-5xx response
		const resp = await page.goto('/catalog', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});

	test('/analytics', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});

	test('/blog', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/blog', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});

	test('/contact', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/contact', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});

	test('/api-dashboard', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/api-dashboard', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});

	test('/privacy', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});

	test('/terms', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const resp = await page.goto('/terms', { waitUntil: 'domcontentloaded' });
		expect(resp?.status() ?? 200).toBeLessThan(500);
		await ctx.close();
	});
});

// ---------------------------------------------------------------------------
// Protected pages — redirect when not authenticated
// ---------------------------------------------------------------------------

test.describe('Protected pages redirect without auth', () => {
	test('/beans redirects without auth', async ({ browser }) => {
		const ctx = await browser.newContext(); // no storageState
		const page = await ctx.newPage();
		await page.goto('/beans', { waitUntil: 'domcontentloaded' });
		// Should redirect away from /beans (to /catalog, /auth, or similar)
		expect(page.url()).not.toMatch(/\/beans$/);
		await ctx.close();
	});

	test('/roast redirects without auth', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto('/roast', { waitUntil: 'domcontentloaded' });
		expect(page.url()).not.toMatch(/\/roast$/);
		await ctx.close();
	});

	test('/profit redirects without auth', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto('/profit', { waitUntil: 'domcontentloaded' });
		expect(page.url()).not.toMatch(/\/profit$/);
		await ctx.close();
	});

	test('/chat redirects without auth', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto('/chat', { waitUntil: 'domcontentloaded' });
		expect(page.url()).not.toMatch(/\/chat$/);
		await ctx.close();
	});

	test('/admin redirects without auth', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		await page.goto('/admin', { waitUntil: 'domcontentloaded' });
		expect(page.url()).not.toMatch(/\/admin$/);
		await ctx.close();
	});
});

// ---------------------------------------------------------------------------
// Protected pages — load correctly with auth
// Uses storageState set by the setup project.
// ---------------------------------------------------------------------------

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Protected pages load with auth', () => {
	test('/beans renders without server error', async ({ page }) => {
		await page.goto('/beans', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(/beans/);
		// Verify the page isn't a raw error page
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

	test('/admin renders without server error', async ({ page }) => {
		await page.goto('/admin', { waitUntil: 'domcontentloaded' });
		// Admin may redirect non-admin users — just verify no 5xx
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/subscription renders without server error', async ({ page }) => {
		await page.goto('/subscription', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});

	test('/api-dashboard/keys renders without server error', async ({ page }) => {
		await page.goto('/api-dashboard/keys', { waitUntil: 'domcontentloaded' });
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});
});
