import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { seedTestData } from './seed-test-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/user.json');

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

	// 5. Seed test data (idempotent — only inserts if missing)
	const userId = session.user.id;
	console.log(`Authenticated as user: ${userId}`);
	try {
		const seedResult = await seedTestData(supabaseUrl, supabaseServiceRoleKey, userId);
		console.log(`Test data seeded: catalog=${seedResult.catalogId}, inventory=${seedResult.inventoryId}, roast=${seedResult.roastId}`);
	} catch (err) {
		console.warn(`Test data seeding failed (non-fatal): ${err}`);
	}

	// 6. Persist the authenticated session for other tests
	await page.context().storageState({ path: authFile });
});
