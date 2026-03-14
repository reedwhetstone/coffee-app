import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateStockedStatus } from '$lib/server/stockedStatusUtils';
import {
	listRoasts,
	createRoasts,
	updateRoast,
	deleteRoast,
	deleteBatch,
	type RoastCreateInput,
	type RoastUpdateInput
} from '$lib/data/roast.js';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const data = await listRoasts(supabase, user.id);
		return json({ data });
	} catch (error) {
		console.error('Error fetching roast profiles:', error);
		return json({ error: 'Failed to fetch roast profiles' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const requestData = (await request.json()) as RoastCreateInput;
		const { profiles, roastIds } = await createRoasts(supabase, user.id, requestData);

		// Update stocked status for all affected coffees
		const isBatch = 'batch_beans' in requestData && Array.isArray(requestData.batch_beans);
		if (isBatch) {
			const batchData = requestData as { batch_beans: { coffee_id: number }[] };
			const coffeeIds = batchData.batch_beans.map((b) => b.coffee_id);
			await Promise.all(coffeeIds.map((id) => updateStockedStatus(supabase, id, user.id)));
			return json({ profiles, roast_ids: roastIds });
		} else {
			// Single / legacy array path — profiles already inserted
			const singleData = requestData as { coffee_id?: number };
			const profileArray = Array.isArray(requestData) ? requestData : [singleData];
			const coffeeIds = profileArray.map((p) => (p as { coffee_id: number }).coffee_id);
			await Promise.all(coffeeIds.map((id) => updateStockedStatus(supabase, id, user.id)));
			return json(profiles);
		}
	} catch (error) {
		console.error('Error creating roast profiles:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to create roast profiles' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		const batchName = url.searchParams.get('name');

		if (id) {
			const parsedId = Number(id);

			// Need coffee_id before deletion for stocked status update
			const { data: existing } = await supabase
				.from('roast_profiles')
				.select('user, coffee_id')
				.eq('roast_id', parsedId)
				.single();

			const row = existing as { user: string; coffee_id: number } | null;
			if (!row || row.user !== user.id) {
				return json({ error: 'Unauthorized' }, { status: 403 });
			}

			await deleteRoast(supabase, parsedId, user.id);
			await updateStockedStatus(supabase, row.coffee_id, user.id);
		} else if (batchName) {
			const { coffeeIds } = await deleteBatch(supabase, batchName, user.id);
			for (const coffee_id of coffeeIds) {
				await updateStockedStatus(supabase, coffee_id, user.id);
			}
		} else {
			return json({ error: 'No ID or batch name provided' }, { status: 400 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting roast profile(s):', error);
		const message = error instanceof Error ? error.message : 'Failed to delete roast profile(s)';
		return json({ error: message }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({
	request,
	url,
	locals: { supabase, safeGetSession }
}) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		const parsedId = Number(id);
		const body = (await request.json()) as RoastUpdateInput;

		// Need coffee_id before update for stocked status
		const { data: existing } = await supabase
			.from('roast_profiles')
			.select('user, coffee_id')
			.eq('roast_id', parsedId)
			.single();

		const row = existing as { user: string; coffee_id: number } | null;
		if (!row || row.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const updated = await updateRoast(supabase, parsedId, user.id, body);

		// Update stocked status for this coffee after updating roast profile
		await updateStockedStatus(supabase, row.coffee_id, user.id);

		return json(updated);
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return json({ error: 'Failed to update roast profile' }, { status: 500 });
	}
};
