import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { fetchParchmentRoasts } from '$lib/server/parchmentRoasts';
import { isCookieSessionPrincipal, principalHasRole } from '$lib/server/principal';
import {
	createRoasts,
	updateRoast,
	deleteRoast,
	deleteBatch,
	type RoastCreateInput,
	type RoastUpdateInput
} from '$lib/data/roast.js';

export const GET: RequestHandler = async (event) => {
	try {
		if (!isCookieSessionPrincipal(event.locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const data = await fetchParchmentRoasts(client);
		return json({ data });
	} catch (error) {
		console.error('Error fetching roast profiles:', error);
		return json({ error: 'Failed to fetch roast profiles' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { supabase } = locals;
		if (!isCookieSessionPrincipal(locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const { user } = locals.principal;
		if (!principalHasRole(locals.principal, 'member')) {
			return json(
				{ error: 'Mallard Studio membership is required to create roast profiles' },
				{ status: 403 }
			);
		}

		const requestData = (await request.json()) as RoastCreateInput;
		const { profiles, roastIds } = await createRoasts(supabase, user.id, requestData);

		// The Parchment-owned database trigger updates stocked state in the same
		// transaction as every roast mutation.
		const isBatch = 'batch_beans' in requestData && Array.isArray(requestData.batch_beans);
		if (isBatch) {
			return json({ profiles, roast_ids: roastIds });
		}
		return json(profiles);
	} catch (error) {
		console.error('Error creating roast profiles:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to create roast profiles' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
	try {
		if (!isCookieSessionPrincipal(locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const { supabase } = locals;
		const { user } = locals.principal;

		const id = url.searchParams.get('id');
		const batchName = url.searchParams.get('name');

		if (id) {
			const parsedId = Number(id);
			await deleteRoast(supabase, parsedId, user.id);
		} else if (batchName) {
			await deleteBatch(supabase, batchName, user.id);
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

export const PUT: RequestHandler = async ({ request, url, locals }) => {
	try {
		if (!isCookieSessionPrincipal(locals.principal)) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const { supabase } = locals;
		const { user } = locals.principal;

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		const parsedId = Number(id);
		const body = (await request.json()) as RoastUpdateInput;

		const { profile } = await updateRoast(supabase, parsedId, user.id, body);
		return json(profile);
	} catch (error) {
		console.error('Error updating roast profile:', error);
		return json({ error: 'Failed to update roast profile' }, { status: 500 });
	}
};
