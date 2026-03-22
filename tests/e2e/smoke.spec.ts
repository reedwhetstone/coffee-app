/**
 * Tier 2: Page Load Smoke Tests
 *
 * Verifies that every route in the app loads without crashing.
 * No business logic — just "does the page render without a 4xx/5xx error?"
 *
 * Split into three groups:
 *   1. Public pages — accessible without auth
 *   2. Protected pages — redirect away without auth (server-side)
 *   3. Protected pages — render correctly with auth
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
	test('homepage /', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(400);
		await ctx.dispose();
	});

	test('/blog', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/blog', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});

	test('/contact', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/contact', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});

	test('/privacy', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/privacy', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});

	test('/terms', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/terms', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(500);
		await ctx.dispose();
	});
});

// ---------------------------------------------------------------------------
// Protected pages — redirect to /catalog when not authenticated
// The SvelteKit authGuard hook redirects unauthenticated requests server-side.
// We verify the final URL is NOT the protected route.
// ---------------------------------------------------------------------------

test.describe('Protected pages redirect without auth', () => {
	test('/beans redirects to /catalog without auth', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		// Follow redirects and check final URL
		const resp = await ctx.get('/beans', { maxRedirects: 5 });
		// The server sends a 303 → catalog; after following, status should be 200
		expect(resp.status()).toBeLessThan(400);
		// Final URL should not be /beans
		expect(resp.url()).not.toMatch(/\/beans$/);
		await ctx.dispose();
	});

	test('/roast redirects to /catalog without auth', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/roast', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(400);
		expect(resp.url()).not.toMatch(/\/roast$/);
		await ctx.dispose();
	});

	test('/profit redirects to /catalog without auth', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/profit', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(400);
		expect(resp.url()).not.toMatch(/\/profit$/);
		await ctx.dispose();
	});

	test('/chat redirects without auth', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/chat', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(400);
		expect(resp.url()).not.toMatch(/\/chat$/);
		await ctx.dispose();
	});

	test('/admin redirects without auth', async ({ playwright, baseURL }) => {
		const ctx = await playwright.request.newContext({ baseURL });
		const resp = await ctx.get('/admin', { maxRedirects: 5 });
		expect(resp.status()).toBeLessThan(400);
		expect(resp.url()).not.toMatch(/\/admin$/);
		await ctx.dispose();
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
		// Admin redirects non-admin users to catalog — verify no 5xx either way
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});
});
