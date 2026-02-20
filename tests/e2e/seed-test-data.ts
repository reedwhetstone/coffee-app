/**
 * Seed test data for E2E tests.
 * Ensures the test user has beans, roast profiles, and sales data
 * so CRUD tests have something to interact with.
 *
 * Uses the Supabase service role key (bypasses RLS) to insert directly.
 * Idempotent: checks for existing data before inserting.
 */

interface SeedResult {
	userId: string;
	catalogId: number;
	inventoryId: number;
	roastId: number;
}

export async function seedTestData(supabaseUrl: string, serviceRoleKey: string, userId: string): Promise<SeedResult> {
	const headers = {
		apikey: serviceRoleKey,
		Authorization: `Bearer ${serviceRoleKey}`,
		'Content-Type': 'application/json',
		Prefer: 'return=representation'
	};

	// 1. Ensure user_roles entry exists
	const userRoleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?id=eq.${userId}&select=id`, { headers });
	const existingRoles = await userRoleRes.json();

	if (existingRoles.length === 0) {
		await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
			method: 'POST',
			headers: { ...headers, Prefer: 'return=minimal' },
			body: JSON.stringify({
				id: userId,
				role: 'member',
				user_role: ['member'],
				email: process.env.E2E_TEST_EMAIL || 'test@purveyors.io',
				name: 'E2E Test User'
			})
		});
	}

	// 2. Ensure a catalog entry exists (public coffee)
	let catalogId: number;
	const catalogRes = await fetch(
		`${supabaseUrl}/rest/v1/coffee_catalog?name=eq.Burundi Kayanza Natural&select=id`,
		{ headers }
	);
	const existingCatalog = await catalogRes.json();

	if (existingCatalog.length > 0) {
		catalogId = existingCatalog[0].id;
	} else {
		const insertRes = await fetch(`${supabaseUrl}/rest/v1/coffee_catalog`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				name: 'Burundi Kayanza Natural',
				source: 'e2e-test',
				country: 'Burundi',
				continent: 'Africa',
				region: 'Kayanza',
				processing: 'Natural',
				cost_lb: 6.5,
				score_value: 87,
				stocked: true,
				public_coffee: true,
				description_short: 'E2E test coffee. Bright stone fruit, brown sugar, clean finish.',
				last_updated: new Date().toISOString().split('T')[0]
			})
		});
		const inserted = await insertRes.json();
		catalogId = inserted[0].id;
	}

	// 3. Ensure the test user has this bean in inventory
	let inventoryId: number;
	const invRes = await fetch(
		`${supabaseUrl}/rest/v1/green_coffee_inv?user=eq.${userId}&catalog_id=eq.${catalogId}&select=id`,
		{ headers }
	);
	const existingInv = await invRes.json();

	if (existingInv.length > 0) {
		inventoryId = existingInv[0].id;
	} else {
		const invInsertRes = await fetch(`${supabaseUrl}/rest/v1/green_coffee_inv`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				user: userId,
				catalog_id: catalogId,
				rank: 1,
				notes: 'E2E test bean',
				purchase_date: new Date().toISOString().split('T')[0],
				purchased_qty_lbs: 5,
				bean_cost: 32.5,
				tax_ship_cost: 8.0,
				stocked: true
			})
		});
		const invInserted = await invInsertRes.json();
		inventoryId = invInserted[0].id;
	}

	// 4. Ensure at least one roast profile exists for this bean
	let roastId: number;
	const roastRes = await fetch(
		`${supabaseUrl}/rest/v1/roast_profiles?user=eq.${userId}&coffee_id=eq.${inventoryId}&select=roast_id`,
		{ headers }
	);
	const existingRoasts = await roastRes.json();

	if (existingRoasts.length > 0) {
		roastId = existingRoasts[0].roast_id;
	} else {
		const roastInsertRes = await fetch(`${supabaseUrl}/rest/v1/roast_profiles`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				user: userId,
				coffee_id: inventoryId,
				batch_name: 'Burundi Kayanza #1',
				coffee_name: 'Burundi Kayanza Natural',
				roast_date: new Date().toISOString().split('T')[0],
				oz_in: 8,
				oz_out: 6.8,
				roast_notes: 'E2E test roast profile',
				roast_targets: 'City+, first crack at 400F',
				roaster_type: 'Popper',
				temperature_unit: 'F',
				data_source: 'manual'
			})
		});
		const roastInserted = await roastInsertRes.json();
		roastId = roastInserted[0].roast_id;
	}

	return { userId, catalogId, inventoryId, roastId };
}
