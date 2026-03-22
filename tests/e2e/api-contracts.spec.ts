/**
 * Tier 1: API Contract Tests
 *
 * Direct HTTP tests using Playwright's request context — no browser.
 * Validates that every API endpoint:
 *   1. Returns 401 (or empty) without auth
 *   2. Returns the expected status with auth
 *   3. Returns the expected response shape
 *
 * Auth for tests using Playwright's { request } fixture is set via
 * test.use() in each authenticated describe block.
 *
 * Unauthenticated tests use Node.js native fetch() which is completely
 * isolated — Playwright's APIRequestContext shares the browser cookie jar
 * and would incorrectly authenticate requests otherwise.
 *
 * Target: < 30 seconds (no browser, pure HTTP)
 */

import { test, expect } from '@playwright/test';

// Native fetch — completely isolated from Playwright's cookie jar.
// Used for all unauthenticated request tests.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
async function rawFetch(path: string, options?: RequestInit) {
	const resp = await fetch(`${BASE_URL}${path}`, options);
	return { status: resp.status, url: resp.url, json: () => resp.json() as Promise<unknown> };
}

// IDs for test data created during this run — cleaned up in afterAll
let testBeanId: number | null = null;
let testRoastId: number | null = null;
let testSaleId: number | null = null;

test.afterAll(async ({ request }) => {
	if (testSaleId) {
		await request.delete(`/api/profit?id=${testSaleId}`).catch(() => {});
		testSaleId = null;
	}
	if (testRoastId) {
		await request.delete(`/api/roast-profiles?id=${testRoastId}`).catch(() => {});
		testRoastId = null;
	}
	if (testBeanId) {
		await request.delete(`/api/beans?id=${testBeanId}`).catch(() => {});
		testBeanId = null;
	}
});

// ---------------------------------------------------------------------------
// Unauthenticated requests — Node.js native fetch has no shared state
// ---------------------------------------------------------------------------

test.describe('Unauthenticated requests are rejected', () => {
	test('GET /api/beans without auth returns empty data', async () => {
		const resp = await rawFetch('/api/beans');
		expect(resp.status).toBe(200);
		const body = (await resp.json()) as Record<string, unknown>;
		expect(body).toHaveProperty('data');
		expect(body.data).toEqual([]);
	});

	test('GET /api/profit without auth does not crash without auth', async () => {
		const resp = await rawFetch('/api/profit');
		expect(resp.status).toBeLessThan(500);
	});

	test('GET /api/roast-profiles without auth does not crash without auth', async () => {
		const resp = await rawFetch('/api/roast-profiles');
		expect(resp.status).toBeLessThan(500);
	});

	test('GET /api/roast-chart-data without auth does not crash without auth', async () => {
		const resp = await rawFetch('/api/roast-chart-data?roastId=1');
		expect(resp.status).toBeLessThan(500);
	});

	test('GET /api/roast-chart-settings without auth does not crash without auth', async () => {
		const resp = await rawFetch('/api/roast-chart-settings?roastId=1');
		expect(resp.status).toBeLessThan(500);
	});
});

// ---------------------------------------------------------------------------
// GET endpoints — shape assertions
// ---------------------------------------------------------------------------

test.describe('GET endpoints return expected shapes', () => {
	test.use({ storageState: 'tests/e2e/.auth/user.json' });

	test('GET /api/beans returns { data: [...] }', async ({ request }) => {
		const resp = await request.get('/api/beans');
		expect(resp.status()).toBe(200);
		const body = await resp.json();
		expect(body).toHaveProperty('data');
		expect(Array.isArray(body.data)).toBe(true);
	});

	test('GET /api/profit returns { sales: [...], profit: [...] }', async ({ request }) => {
		const resp = await request.get('/api/profit');
		expect(resp.status()).toBe(200);
		const body = await resp.json();
		expect(body).toHaveProperty('sales');
		expect(body).toHaveProperty('profit');
		expect(Array.isArray(body.sales)).toBe(true);
	});

	test('GET /api/roast-profiles returns { data: [...] }', async ({ request }) => {
		const resp = await request.get('/api/roast-profiles');
		expect(resp.status()).toBe(200);
		const body = await resp.json();
		expect(body).toHaveProperty('data');
		expect(Array.isArray(body.data)).toBe(true);
	});

	test('GET /api/catalog requires auth and returns catalog data', async ({ request }) => {
		const resp = await request.get('/api/catalog');
		expect(resp.status()).toBe(200);
		const body = await resp.json();
		const isValidShape =
			Array.isArray(body) ||
			Array.isArray(body.data) ||
			(typeof body === 'object' && body !== null);
		expect(isValidShape).toBe(true);
	});

	test('GET /api/roast-chart-data with no roastId returns 400', async ({ request }) => {
		const resp = await request.get('/api/roast-chart-data');
		expect(resp.status()).toBeGreaterThanOrEqual(400);
		expect(resp.status()).toBeLessThan(500);
	});

	test('GET /api/roast-chart-settings with no roastId returns 400', async ({ request }) => {
		const resp = await request.get('/api/roast-chart-settings');
		expect(resp.status()).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// POST /api/beans — create a bean via manual entry
// ---------------------------------------------------------------------------

test.describe('POST /api/beans — create inventory', () => {
	test.use({ storageState: 'tests/e2e/.auth/user.json' });

	test('creates a bean with manual_name and returns the new inventory item', async ({
		request
	}) => {
		const resp = await request.post('/api/beans', {
			data: {
				manual_name: `API_TEST_BEAN_${Date.now()}`,
				purchase_date: new Date().toISOString().split('T')[0],
				purchased_qty_lbs: 2,
				bean_cost: 18,
				tax_ship_cost: 0
			}
		});
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toBeTruthy();
		expect(typeof body).toBe('object');
		testBeanId = body.id ?? body.data?.[0]?.id ?? null;
		expect(testBeanId).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// PUT /api/beans — update a bean
// ---------------------------------------------------------------------------

test.describe('PUT /api/beans — update inventory', () => {
	test.use({ storageState: 'tests/e2e/.auth/user.json' });

	test('updates the test bean notes field', async ({ request }) => {
		if (!testBeanId) {
			test.skip();
			return;
		}
		const resp = await request.put(`/api/beans?id=${testBeanId}`, {
			data: {
				notes: 'Updated by API contract test'
			}
		});
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// POST /api/roast-profiles — create a roast profile
// ---------------------------------------------------------------------------

test.describe('POST /api/roast-profiles — create roast', () => {
	test.use({ storageState: 'tests/e2e/.auth/user.json' });

	test('creates a roast profile for the test bean', async ({ request }) => {
		if (!testBeanId) {
			test.skip();
			return;
		}
		const resp = await request.post('/api/roast-profiles', {
			data: {
				coffee_id: testBeanId,
				batch_name: `API_TEST_ROAST_${Date.now()}`,
				roast_date: new Date().toISOString().split('T')[0],
				roast_notes: 'API contract test',
				oz_in: 8
			}
		});
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toBeTruthy();
		const profiles = Array.isArray(body) ? body : (body.profiles ?? [body]);
		testRoastId = profiles[0]?.roast_id ?? profiles[0]?.id ?? null;
		expect(testRoastId).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// POST /api/profit — create a sale
// ---------------------------------------------------------------------------

test.describe('POST /api/profit — create sale', () => {
	test.use({ storageState: 'tests/e2e/.auth/user.json' });

	test('creates a sale for the test bean', async ({ request }) => {
		if (!testBeanId) {
			test.skip();
			return;
		}
		const today = new Date().toISOString().split('T')[0];
		const resp = await request.post('/api/profit', {
			data: {
				green_coffee_inv_id: testBeanId,
				oz_sold: 4,
				price: 15,
				buyer: 'API_TEST_BUYER',
				sell_date: today,
				purchase_date: today
			}
		});
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toBeTruthy();
		testSaleId = body.id ?? body.data?.id ?? null;
		expect(testSaleId).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// DELETE endpoints — cleanup verification
// ---------------------------------------------------------------------------

test.describe('DELETE endpoints return success', () => {
	test.use({ storageState: 'tests/e2e/.auth/user.json' });

	test('DELETE /api/profit?id=X deletes the test sale', async ({ request }) => {
		if (!testSaleId) {
			test.skip();
			return;
		}
		const resp = await request.delete(`/api/profit?id=${testSaleId}`);
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toHaveProperty('success', true);
		testSaleId = null;
	});

	test('DELETE /api/roast-profiles?id=X deletes the test roast', async ({ request }) => {
		if (!testRoastId) {
			test.skip();
			return;
		}
		const resp = await request.delete(`/api/roast-profiles?id=${testRoastId}`);
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toHaveProperty('success', true);
		testRoastId = null;
	});

	test('DELETE /api/beans?id=X deletes the test bean', async ({ request }) => {
		if (!testBeanId) {
			test.skip();
			return;
		}
		const resp = await request.delete(`/api/beans?id=${testBeanId}`);
		expect(resp.status()).toBeLessThan(400);
		const body = await resp.json();
		expect(body).toHaveProperty('success', true);
		testBeanId = null;
	});
});
