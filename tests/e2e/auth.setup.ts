import { test as setup, expect, type APIRequestContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/user.json');

interface CatalogSeedRow {
	id: number;
	name: string;
	cost_lb: number | null;
}

interface InventorySeedRow {
	id: number;
	catalog_id: number | null;
	coffee_catalog?: { name: string } | null;
}

function serviceHeaders(serviceRoleKey: string) {
	return {
		apikey: serviceRoleKey,
		Authorization: `Bearer ${serviceRoleKey}`,
		'Content-Type': 'application/json;charset=UTF-8'
	};
}

async function ensureSeedInventoryForUser(
	request: APIRequestContext,
	supabaseUrl: string,
	serviceRoleKey: string,
	userId: string
): Promise<{ inventoryId: number; coffeeName: string }> {
	const headers = serviceHeaders(serviceRoleKey);

	const existingInventoryResp = await request.get(`${supabaseUrl}/rest/v1/green_coffee_inv`, {
		headers,
		params: {
			select: 'id,catalog_id,coffee_catalog!catalog_id(name)',
			user: `eq.${userId}`,
			order: 'id.asc',
			limit: '1'
		}
	});

	if (!existingInventoryResp.ok()) {
		const body = await existingInventoryResp.text();
		throw new Error(
			`Failed querying green_coffee_inv (${existingInventoryResp.status()}): ${body}`
		);
	}

	const existingInventory = (await existingInventoryResp.json()) as InventorySeedRow[];
	if (existingInventory.length > 0) {
		return {
			inventoryId: existingInventory[0].id,
			coffeeName: existingInventory[0].coffee_catalog?.name || 'E2E Seed Coffee'
		};
	}

	const catalogResp = await request.get(`${supabaseUrl}/rest/v1/coffee_catalog`, {
		headers,
		params: {
			select: 'id,name,cost_lb',
			stocked: 'eq.true',
			order: 'id.asc',
			limit: '1'
		}
	});

	if (!catalogResp.ok()) {
		const body = await catalogResp.text();
		throw new Error(`Failed querying coffee_catalog (${catalogResp.status()}): ${body}`);
	}

	const catalogRows = (await catalogResp.json()) as CatalogSeedRow[];
	if (catalogRows.length === 0) {
		throw new Error('No stocked catalog rows found for E2E seed data');
	}

	const catalog = catalogRows[0];
	const qty = 5;
	const perLb = catalog.cost_lb ?? 10;
	const beanCost = Number((perLb * qty).toFixed(2));

	const insertInventoryResp = await request.post(`${supabaseUrl}/rest/v1/green_coffee_inv`, {
		headers: {
			...headers,
			Prefer: 'return=representation'
		},
		data: {
			user: userId,
			catalog_id: catalog.id,
			purchase_date: new Date().toISOString().slice(0, 10),
			purchased_qty_lbs: qty,
			bean_cost: beanCost,
			tax_ship_cost: 0,
			stocked: true,
			notes: 'e2e-seed',
			last_updated: new Date().toISOString()
		}
	});

	if (!insertInventoryResp.ok()) {
		const body = await insertInventoryResp.text();
		throw new Error(`Failed inserting green_coffee_inv (${insertInventoryResp.status()}): ${body}`);
	}

	const inserted = (await insertInventoryResp.json()) as InventorySeedRow[];
	if (inserted.length === 0) {
		throw new Error('Inserted green_coffee_inv row missing from response');
	}

	return {
		inventoryId: inserted[0].id,
		coffeeName: catalog.name
	};
}

async function ensureSeedRoastProfileForUser(
	request: APIRequestContext,
	supabaseUrl: string,
	serviceRoleKey: string,
	userId: string,
	inventoryId: number,
	coffeeName: string
) {
	const headers = serviceHeaders(serviceRoleKey);

	const existingRoastResp = await request.get(`${supabaseUrl}/rest/v1/roast_profiles`, {
		headers,
		params: {
			select: 'roast_id',
			user: `eq.${userId}`,
			coffee_id: `eq.${inventoryId}`,
			limit: '1'
		}
	});

	if (!existingRoastResp.ok()) {
		const body = await existingRoastResp.text();
		throw new Error(`Failed querying roast_profiles (${existingRoastResp.status()}): ${body}`);
	}

	const existingRoasts = (await existingRoastResp.json()) as { roast_id: number }[];
	if (existingRoasts.length > 0) return;

	const now = new Date();
	const insertRoastResp = await request.post(`${supabaseUrl}/rest/v1/roast_profiles`, {
		headers,
		data: {
			user: userId,
			coffee_id: inventoryId,
			coffee_name: coffeeName,
			batch_name: `E2E Seed Batch ${now.toISOString().slice(0, 10)}`,
			roast_date: now.toISOString().slice(0, 10),
			oz_in: 8,
			roast_targets: 'E2E seed roast profile',
			roast_notes: 'e2e-seed',
			last_updated: now.toISOString()
		}
	});

	if (!insertRoastResp.ok()) {
		const body = await insertRoastResp.text();
		throw new Error(`Failed inserting roast_profiles (${insertRoastResp.status()}): ${body}`);
	}
}

/**
 * Chunk a cookie value the same way @supabase/ssr does.
 * Single cookie if value fits, otherwise .0, .1, etc.
 */
function createChunks(key: string, value: string, chunkSize = 3180) {
	if (value.length <= chunkSize) {
		return [{ name: key, value }];
	}
	const chunks: { name: string; value: string }[] = [];
	for (let i = 0; i < value.length; i += chunkSize) {
		chunks.push({
			name: `${key}.${chunks.length}`,
			value: value.slice(i, i + chunkSize)
		});
	}
	return chunks;
}

setup('authenticate', async ({ page, request }) => {
	const email = process.env.E2E_TEST_EMAIL!;
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
	const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY!;
	const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

	// 1a. Generate a magic link via admin API (bypasses disabled email provider)
	const linkResponse = await request.post(`${supabaseUrl}/auth/v1/admin/generate_link`, {
		headers: {
			apikey: supabaseAnonKey,
			Authorization: `Bearer ${supabaseServiceRoleKey}`,
			'Content-Type': 'application/json;charset=UTF-8'
		},
		data: {
			type: 'magiclink',
			email: email
		}
	});
	if (!linkResponse.ok()) {
		const body = await linkResponse.json();
		throw new Error(
			`Admin generate_link failed (${linkResponse.status()}): ${JSON.stringify(body)}`
		);
	}
	const linkData = await linkResponse.json();

	// 1b. Exchange the token for a session
	const verifyResponse = await request.post(`${supabaseUrl}/auth/v1/verify`, {
		headers: {
			apikey: supabaseAnonKey,
			Authorization: `Bearer ${supabaseAnonKey}`,
			'Content-Type': 'application/json;charset=UTF-8'
		},
		data: {
			type: 'magiclink',
			token_hash: linkData.hashed_token
		}
	});
	if (!verifyResponse.ok()) {
		const body = await verifyResponse.json();
		throw new Error(`Token verify failed (${verifyResponse.status()}): ${JSON.stringify(body)}`);
	}
	const session = await verifyResponse.json();

	// 1c. Ensure deterministic seed data for E2E (no skip-based false positives)
	const { inventoryId, coffeeName } = await ensureSeedInventoryForUser(
		request,
		supabaseUrl,
		supabaseServiceRoleKey,
		session.user.id
	);
	await ensureSeedRoastProfileForUser(
		request,
		supabaseUrl,
		supabaseServiceRoleKey,
		session.user.id,
		inventoryId,
		coffeeName
	);

	// 2. Build the cookie in @supabase/ssr format
	const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
	const cookieName = `sb-${projectRef}-auth-token`;

	const sessionData = JSON.stringify({
		access_token: session.access_token,
		refresh_token: session.refresh_token,
		expires_at: session.expires_at,
		expires_in: session.expires_in,
		token_type: session.token_type,
		user: session.user
	});

	// 3. Set auth cookies on the browser context (chunked if needed)
	const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
	const domain = new URL(baseUrl).hostname;
	const chunks = createChunks(cookieName, sessionData);

	await page.context().addCookies(
		chunks.map((chunk) => ({
			name: chunk.name,
			value: chunk.value,
			domain,
			path: '/',
			httpOnly: false,
			secure: false,
			sameSite: 'Lax' as const
		}))
	);

	// 4. Verify authenticated access to a member-only route
	await page.goto('/beans');
	await page.waitForLoadState('networkidle');
	await expect(page).toHaveURL(/beans/);

	// 5. Persist the authenticated session for other tests
	await page.context().storageState({ path: authFile });
});
