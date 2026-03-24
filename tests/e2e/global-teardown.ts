/**
 * Global teardown: wipe all data owned by the E2E test user.
 *
 * Uses the Supabase service role key to cascade-delete everything:
 *   sales → roast_temperatures → roast_events → roast_profiles → green_coffee_inv
 *
 * This runs after ALL test suites complete (even on failure), catching orphaned
 * data that per-suite afterAll hooks miss when tests crash mid-run.
 */

import { createClient } from '@supabase/supabase-js';

export default async function globalTeardown() {
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

	// 2. Delete sales referencing these beans
	const { error: salesErr, count: salesCount } = await supabase
		.from('sales')
		.delete({ count: 'exact' })
		.in('green_coffee_inv_id', beanIds);
	if (salesErr) console.warn('[teardown] sales delete error:', salesErr.message);
	else console.log(`[teardown] Deleted ${salesCount ?? 0} sales`);

	// 3. Get roast profile IDs for these beans
	const { data: roasts } = await supabase
		.from('roast_profiles')
		.select('roast_id')
		.in('coffee_id', beanIds);

	if (roasts && roasts.length > 0) {
		const roastIds = roasts.map((r: { roast_id: number }) => r.roast_id);

		// 4. Delete roast temperatures
		const { error: tempErr, count: tempCount } = await supabase
			.from('roast_temperatures')
			.delete({ count: 'exact' })
			.in('roast_id', roastIds);
		if (tempErr) console.warn('[teardown] roast_temperatures error:', tempErr.message);
		else console.log(`[teardown] Deleted ${tempCount ?? 0} roast temperatures`);

		// 5. Delete roast events
		const { error: eventErr, count: eventCount } = await supabase
			.from('roast_events')
			.delete({ count: 'exact' })
			.in('roast_id', roastIds);
		if (eventErr) console.warn('[teardown] roast_events error:', eventErr.message);
		else console.log(`[teardown] Deleted ${eventCount ?? 0} roast events`);

		// 6. Delete roast profiles
		const { error: profileErr, count: profileCount } = await supabase
			.from('roast_profiles')
			.delete({ count: 'exact' })
			.in('coffee_id', beanIds);
		if (profileErr) console.warn('[teardown] roast_profiles error:', profileErr.message);
		else console.log(`[teardown] Deleted ${profileCount ?? 0} roast profiles`);
	}

	// 7. Delete inventory items
	const { error: invErr, count: invCount } = await supabase
		.from('green_coffee_inv')
		.delete({ count: 'exact' })
		.eq('user', userId);
	if (invErr) console.warn('[teardown] green_coffee_inv error:', invErr.message);
	else console.log(`[teardown] Deleted ${invCount ?? 0} inventory items`);

	console.log('[teardown] Cleanup complete');
}
