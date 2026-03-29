import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Database } from '$lib/types/database.types';
import {
	listSales,
	getProfitData,
	recordSale,
	updateSale,
	deleteSale,
	type SaleCreateInput
} from '$lib/data/sales.js';
import { SALES_COLUMNS, pickColumns } from '$lib/utils/dbColumns.js';

export const GET: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const [sales, profit] = await Promise.all([
			listSales(supabase, user.id),
			getProfitData(supabase, user.id)
		]);

		return json({ sales, profit });
	} catch (error) {
		console.error('Error querying database:', error);
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({
	url,
	request,
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

		// Verify ownership
		const parsedId = Number(id);
		const { data: existing } = (await supabase
			.from('sales')
			.select('user')
			.eq('id', parsedId)
			.single()) as {
			data: { user: string } | null;
			error: unknown;
		};

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		const raw = await request.json();

		// Strip joined/computed fields — only pass actual sales table columns to Supabase.
		const updateData = pickColumns(raw, SALES_COLUMNS);
		// Remove id and user from the update payload (not safe to mutate via client)
		delete updateData.id;
		delete updateData.user;

		const data = await updateSale(
			supabase,
			parsedId,
			user.id,
			updateData as Database['public']['Tables']['sales']['Update']
		);

		return json(data);
	} catch (error) {
		console.error('Error updating sale:', error);
		return json({ error: 'Failed to update sale' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const raw = await request.json();

		// Strip joined/computed fields — only pass actual sales table columns to Supabase.
		const insertData = pickColumns(raw, SALES_COLUMNS);
		// Remove id and user — server controls these
		delete insertData.id;
		delete insertData.user;

		if (!insertData.green_coffee_inv_id) {
			return json({ error: 'green_coffee_inv_id is required' }, { status: 400 });
		}

		// Verify ownership of the green coffee inventory
		const { data: coffee } = await supabase
			.from('green_coffee_inv')
			.select('user')
			.eq('id', insertData.green_coffee_inv_id)
			.single();

		const coffeeUser = (coffee as unknown as { user: string | null })?.user;

		if (!coffeeUser) {
			return json({ error: 'Green coffee inventory not found' }, { status: 404 });
		}
		if (coffeeUser !== user.id) {
			return json({ error: 'Unauthorized: You do not own this coffee inventory' }, { status: 403 });
		}

		const formattedSale = await recordSale(supabase, user.id, insertData as SaleCreateInput);

		return json(formattedSale);
	} catch (error) {
		console.error('Error creating sale:', error);
		return json({ error: 'Failed to create sale' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const id = url.searchParams.get('id');
		if (!id) {
			return json({ error: 'No ID provided' }, { status: 400 });
		}

		// Verify ownership
		const parsedDeleteId = Number(id);
		const { data: existing } = (await supabase
			.from('sales')
			.select('user')
			.eq('id', parsedDeleteId)
			.single()) as {
			data: { user: string } | null;
			error: unknown;
		};

		if (!existing || existing.user !== user.id) {
			return json({ error: 'Unauthorized' }, { status: 403 });
		}

		await deleteSale(supabase, parsedDeleteId, user.id);

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting sale:', error);
		return json({ error: 'Failed to delete sale' }, { status: 500 });
	}
};
