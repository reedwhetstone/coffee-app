/**
 * @deprecated This endpoint is kept for backward compatibility only.
 * The chat agent and this compatibility route use the session-mode Parchment SDK.
 */
import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import type { components } from '@purveyors/sdk';

// Interface for tool input validation
interface BeanTastingToolInput {
	bean_id: number;
	filter: 'user' | 'supplier' | 'both';
	include_radar_data?: boolean;
}

type TastingData = components['schemas']['TastingData'];
type TastingClient = Pick<Awaited<ReturnType<typeof createParchmentServerClient>>, 'tasting'>;

export function _toLegacyTastingEnvelope(
	data: TastingData,
	filter: BeanTastingToolInput['filter'],
	includeRadarData: boolean
) {
	const supplier = data.supplier;
	if (!supplier) {
		throw Object.assign(new Error(`No coffee found with bean_id: ${data.beanId}`), { status: 404 });
	}
	const user = data.user;
	const aiNotes = supplier?.ai_tasting_notes;
	let radarData: Record<string, number> | undefined;
	if (includeRadarData && aiNotes) {
		try {
			const parsed = typeof aiNotes === 'string' ? JSON.parse(aiNotes) : aiNotes;
			if (parsed && typeof parsed === 'object') {
				const scores = parsed as Record<string, unknown>;
				radarData = Object.fromEntries(
					['body', 'flavor', 'acidity', 'sweetness', 'fragrance_aroma'].map((key) => [
						key,
						typeof scores[key] === 'number' ? scores[key] : 0
					])
				);
			}
		} catch {
			// Preserve the legacy behavior: malformed AI notes omit radar data.
		}
	}

	const userNotes = user ? { notes: user.notes, cupping_notes: user.cupping_notes } : null;
	const tastingNotes: Record<string, unknown> = {
		ai_notes: {
			description: supplier?.ai_description ?? null,
			tasting_notes: supplier?.ai_tasting_notes ?? null
		}
	};
	if (filter === 'user' || filter === 'both') tastingNotes.user_notes = userNotes;
	if (filter === 'supplier' || filter === 'both') {
		tastingNotes.supplier_notes = {
			cupping_notes: supplier?.cupping_notes ?? null,
			source: supplier?.sourceName ?? null
		};
	}
	if (filter === 'both') {
		const descriptions = [supplier?.ai_description, supplier?.cupping_notes, user?.notes].filter(
			(value): value is string => typeof value === 'string' && value.length > 0
		);
		tastingNotes.combined_notes = {
			descriptions,
			sources: ['AI Analysis', 'Supplier Notes', 'Your Notes'].slice(0, descriptions.length)
		};
	}

	let message = `Tasting notes for ${supplier?.name ?? `coffee #${data.beanId}`}`;
	if (user && (filter === 'user' || filter === 'both'))
		message += ' (including your personal notes)';
	else if (filter === 'user') message += ' (you have not added this coffee to your inventory yet)';

	return {
		bean_info: {
			id: data.beanId,
			name: supplier?.name ?? null,
			processing: supplier?.processing ?? null,
			region: supplier?.region ?? null,
			source: supplier?.sourceName ?? null
		},
		tasting_notes: tastingNotes,
		radar_data: radarData,
		filter_applied: filter,
		message
	};
}

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
	return _toLegacyTastingEnvelope(response.data.data, filter, includeRadarData);
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
