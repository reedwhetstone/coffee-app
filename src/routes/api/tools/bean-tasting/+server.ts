import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { getTastingNotes } from '$lib/data/tasting.js';

// Interface for tool input validation
interface BeanTastingToolInput {
	bean_id: number;
	filter: 'user' | 'supplier' | 'both';
	include_radar_data?: boolean;
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		const { user } = await requireMemberRole(event);
		const { supabase } = event.locals;

		const input: BeanTastingToolInput = await event.request.json();

		// Validate required parameters
		const { bean_id, filter, include_radar_data = true } = input;

		if (!bean_id) {
			return json({ error: 'bean_id is required' }, { status: 400 });
		}

		if (!['user', 'supplier', 'both'].includes(filter)) {
			return json({ error: 'filter must be "user", "supplier", or "both"' }, { status: 400 });
		}

		let result;
		try {
			result = await getTastingNotes(supabase, user.id, bean_id, {
				filter,
				includeRadarData: include_radar_data
			});
		} catch (err) {
			const status = (err as { status?: number }).status;
			if (status === 404) {
				return json(
					{
						error: 'Coffee bean not found',
						message: `No coffee found with bean_id: ${bean_id}`
					},
					{ status: 404 }
				);
			}
			throw err;
		}

		return json(result);
	} catch (error) {
		console.error('Bean tasting tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
