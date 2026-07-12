/**
 * @deprecated This endpoint is kept for backward compatibility only.
 * The chat agent and this compatibility route use the session-mode Parchment SDK.
 */
import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { toLegacyTastingEnvelope } from '$lib/services/tools/tastingEnvelope';

// Interface for tool input validation
interface BeanTastingToolInput {
	bean_id: number;
	filter: 'user' | 'supplier' | 'both';
	include_radar_data?: boolean;
}

type TastingClient = Pick<Awaited<ReturnType<typeof createParchmentServerClient>>, 'tasting'>;

export async function _readLegacyTasting(
	client: TastingClient,
	beanId: number,
	filter: BeanTastingToolInput['filter'],
	includeRadarData: boolean
) {
	// The legacy envelope always includes catalog-derived bean/AI context,
	// even for user-only requests. Fetch both once, then filter the envelope.
	const response = await client.tasting.get(String(beanId), { filter: 'both' });
	if (response.error) {
		const apiError = response.error as { error?: { message?: string }; message?: string };
		throw Object.assign(
			new Error(apiError.message ?? apiError.error?.message ?? 'Tasting request failed'),
			{ status: response.response.status }
		);
	}
	if (!response.data) throw new Error('Tasting request returned no data');
	return toLegacyTastingEnvelope(response.data.data, filter, includeRadarData);
}

export const POST: RequestHandler = async (event) => {
	try {
		// Require member role for tool access
		await requireMemberRole(event);

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
			const client = await createParchmentServerClient(event, { mode: 'session' });
			result = await _readLegacyTasting(client, bean_id, filter, include_radar_data);
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
