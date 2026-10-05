/**
 * Global teardown: wipe all data owned by the E2E test user.
 *
 * Uses the service role for legacy test tables and inventory, and the app route for roasts:
 *   sales → roast_temperatures → roast_events → DELETE /api/roast-profiles?id= → green_coffee_inv
 *
 * Then removes the roast batches the run left empty, through the app's own routes. A roast
 * belongs to a batch, and deleting the roast keeps the batch, so each roast a spec creates
 * would otherwise leave one behind.
 *
 * This runs after ALL test suites complete (even on failure), catching orphaned
 * data that per-suite afterAll hooks miss when tests crash mid-run.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { request, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
	deleteRoastsById,
	removeEmptyBatches,
	roastIdsForInventory,
	storageStateEmail
} from './batch-cleanup';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/user.json');

export default async function globalTeardown() {
	await wipeTestUserRows();
	// Runs whether or not the account still has inventory: the batch of a roast that a spec
	// already deleted is empty, and nothing above reaches it.
	await removeLeftoverBatches();
}

/** An app-route context is only opened for the saved test-account session. */
async function testAccountContext(): Promise<APIRequestContext | null> {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const testEmail = process.env.E2E_TEST_EMAIL;
	if (!supabaseUrl || !testEmail) {
		console.warn('[teardown] Missing env vars, skipping app-route cleanup');
		return null;
	}
	if (!existsSync(authFile)) {
		console.warn('[teardown] No saved session, skipping app-route cleanup');
		return null;
	}

	// The cleanup acts as whoever the saved session is. Refuse unless that is the test account.
	let signedInAs: string | null = null;
	try {
		signedInAs = storageStateEmail(JSON.parse(readFileSync(authFile, 'utf8')), supabaseUrl);
	} catch {
		signedInAs = null;
	}
	if (signedInAs !== testEmail.toLowerCase()) {
		console.warn('[teardown] Saved session is not the test account, skipping app-route cleanup');
		return null;
	}

	return request.newContext({
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
		storageState: authFile
	});
}

/** Remove empty batches left by this run, or all when explicitly requested. */
async function removeLeftoverBatches() {
	const context = await testAccountContext();
	if (!context) return;
	try {
		await removeEmptyBatches(context, {
			scope: process.env.E2E_EMPTY_BATCH_CLEANUP === 'all' ? 'all' : 'this-run',
			startedAt: process.env.E2E_RUN_STARTED_AT,
			log: (message) => console.log(message)
		});
	} catch (error) {
		console.warn('[teardown] Roast batch cleanup failed:', error);
	} finally {
		await context.dispose();
	}
}

async function listTestRoasts(inventoryIds: number[]): Promise<number[] | null> {
	const context = await testAccountContext();
	if (!context) return null;
	try {
		const response = await context.get('/api/roast-profiles');
		if (!response.ok()) {
			console.warn(`[teardown] Could not list roasts through the app (${response.status()})`);
			return null;
		}
		const ids = roastIdsForInventory(await response.json(), inventoryIds);
		if (ids === null) console.warn('[teardown] Invalid roast list response; keeping test data');
		return ids;
	} catch (error) {
		console.warn('[teardown] Could not list roasts through the app:', error);
		return null;
	} finally {
		await context.dispose();
	}
}

async function wipeTestUserRows() {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const testEmail = process.env.E2E_TEST_EMAIL;

	if (!supabaseUrl || !serviceKey || !testEmail) {
		console.warn('[teardown] Missing env vars, skipping cleanup');
		return;
	}

	const supabase = createClient(supabaseUrl, serviceKey);

	// Resolve the test user's ID from their email
	const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
	if (userError) {
		console.warn('[teardown] Failed to list users:', userError.message);
		return;
	}

	const testUser = userData.users.find((u) => u.email === testEmail);
	if (!testUser) {
		console.warn(`[teardown] Test user ${testEmail} not found, skipping`);
		return;
	}

	const userId = testUser.id;
	console.log(`[teardown] Cleaning up data for ${testEmail} (${userId})...`);

	// 1. Get all inventory IDs for this user
	const { data: beans, error: beansError } = await supabase
		.from('green_coffee_inv')
		.select('id')
		.eq('user', userId);

	if (beansError) {
		console.warn('[teardown] Failed to fetch beans:', beansError.message);
		return;
	}

	if (!beans || beans.length === 0) {
		console.log('[teardown] No test data to clean up');
		return;
	}

	const beanIds = beans.map((b: { id: number }) => b.id);
	console.log(`[teardown] Found ${beanIds.length} inventory items to clean`);

	// Read roasts through the app before mutating. Without a verified list, keep the inventory
	// so that a later run can find and clean its roasts.
	const roastIds = await listTestRoasts(beanIds);
	if (roastIds === null) return;

	// 2. Delete sales referencing these beans
	const { error: salesErr, count: salesCount } = await supabase
		.from('sales')
		.delete({ count: 'exact' })
		.in('green_coffee_inv_id', beanIds);
	if (salesErr) console.warn('[teardown] sales delete error:', salesErr.message);
	else console.log(`[teardown] Deleted ${salesCount ?? 0} sales`);

	if (roastIds.length > 0) {
		// 3. Delete roast temperatures
		const { error: tempErr, count: tempCount } = await supabase
			.from('roast_temperatures')
			.delete({ count: 'exact' })
			.in('roast_id', roastIds);
		if (tempErr) console.warn('[teardown] roast_temperatures error:', tempErr.message);
		else console.log(`[teardown] Deleted ${tempCount ?? 0} roast temperatures`);

		// 4. Delete roast events
		const { error: eventErr, count: eventCount } = await supabase
			.from('roast_events')
			.delete({ count: 'exact' })
			.in('roast_id', roastIds);
		if (eventErr) console.warn('[teardown] roast_events error:', eventErr.message);
		else console.log(`[teardown] Deleted ${eventCount ?? 0} roast events`);

		// 5. Delete each roast through the app. A failed request must leave inventory intact
		// so the next run can retry rather than making its roasts harder to discover.
		const context = await testAccountContext();
		if (!context) return;
		try {
			const cleanup = await deleteRoastsById(context, roastIds, (message) => console.warn(message));
			if (cleanup.failed > 0) {
				console.warn('[teardown] Roast deletion incomplete; keeping inventory for retry');
				return;
			}
			console.log(`[teardown] Deleted ${cleanup.deleted} roasts through the app`);
		} catch (error) {
			console.warn('[teardown] Roast deletion failed; keeping inventory for retry:', error);
			return;
		} finally {
			await context.dispose();
		}
	}

	// 6. Delete inventory items
	const { error: invErr, count: invCount } = await supabase
		.from('green_coffee_inv')
		.delete({ count: 'exact' })
		.eq('user', userId);
	if (invErr) console.warn('[teardown] green_coffee_inv error:', invErr.message);
	else console.log(`[teardown] Deleted ${invCount ?? 0} inventory items`);

	console.log('[teardown] Cleanup complete');
}
