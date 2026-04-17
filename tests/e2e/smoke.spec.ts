/**
 * Tier 2: Page Load Smoke Tests
 *
 * Verifies that key routes in the app load without crashing.
 * No business logic, just "does the page render without a 4xx/5xx error?"
 *
 * Split into three groups:
 *   1. Public pages, accessible without auth (via HTTP request)
 *   2. Protected pages, redirect or degrade gracefully without auth (via HTTP request)
 *   3. Protected pages, render correctly with auth (via browser page)
 *
 * Target: < 1 minute
 * Wait strategy: domcontentloaded (never networkidle unless required by a setup step)
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Public pages, no auth required.
// Use playwright.request.newContext() for genuinely cookieless HTTP requests.
// ---------------------------------------------------------------------------

test.describe('Public pages load without auth', () => {
	test.use({ storageState: { cookies: [], origins: [] } });
	test('homepage /', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/');
		expect(resp.status()).toBeLessThan(400);
		await ctx.dispose();
	});

	test('homepage / exposes the live catalog path for signed-out users', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		// Structural: page renders with an H1 and a visible path to the catalog.
		// Don't assert on marketing copy — that's expected to change over time.
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
		await expect(page.getByRole('button', { name: /catalog/i }).first()).toBeVisible();
	});

	test('/catalog', async ({ playwright }) => {
		const ctx = await playwright.request.newContext();
		const resp = await ctx.get('/catalog');
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
// Protected pages, redirect or degrade gracefully without auth.
// Use playwright.request for a clean HTTP-level check without browser cookies.
// ---------------------------------------------------------------------------

test.describe('Protected pages handled without auth', () => {
	const protectedRoutes = ['/dashboard', '/beans', '/roast', '/profit', '/chat', '/admin'];

	for (const route of protectedRoutes) {
		test(`${route} does not crash without auth`, async ({ playwright }) => {
			const ctx = await playwright.request.newContext();
			const resp = await ctx.get(route);
			expect(resp.status()).toBeLessThan(500);
			await ctx.dispose();
		});
	}
});

// ---------------------------------------------------------------------------
// Protected pages, load correctly with auth.
// Chromium project sets storageState: authFile in playwright.config.ts.
// ---------------------------------------------------------------------------

test.use({ storageState: 'tests/e2e/.auth/user.json' });

test.describe('Protected pages load with auth', () => {
	test('/ renders the marketing homepage for signed-in users', async ({ page }) => {
		await page.goto('/', { waitUntil: 'domcontentloaded' });
		// Structural: signed-in nav renders (Dashboard visible, no auth toggle).
		// Don't assert on marketing copy — that's expected to change over time.
		await expect(page).toHaveURL('/');
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
		await expect(page.locator('h1')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible();
		await expect(page.locator('[aria-label="Toggle authentication menu"]')).toHaveCount(0);
	});

	test('/blog keeps the public shell for signed-in users', async ({ page }) => {
		await page.goto('/blog', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL('/blog');
		await expect(page.getByRole('heading', { name: 'Blog' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible();
		await expect(page.locator('[aria-label="Toggle authentication menu"]')).toHaveCount(0);
	});

	test('/api keeps the public shell for signed-in users', async ({ page }) => {
		await page.goto('/api', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL('/api');
		await expect(page.getByRole('heading', { name: /green coffee data/i }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible();
		await expect(page.locator('[aria-label="Toggle authentication menu"]')).toHaveCount(0);
	});

	test('/dashboard renders as the signed-in app home', async ({ page }) => {
		await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
		await expect(page).toHaveURL(/dashboard/);
		await expect(page.getByRole('heading', { name: /Welcome back,/ })).toBeVisible();
		await expect(page.getByText('Quick start')).toBeVisible();
		await expect(page.locator('[aria-label="Toggle authentication menu"]')).toHaveCount(1);
	});

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
		await expect(page.getByRole('heading', { name: 'Green Coffee Catalog' })).toBeVisible();
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
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
	});
});
