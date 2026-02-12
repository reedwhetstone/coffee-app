import { json } from '@sveltejs/kit';
import { requireMemberRole } from '$lib/server/auth';
import type { RequestHandler } from './$types';
import type { Json } from '$lib/types/database.types';

// Interface for tool input validation
interface BeanTastingToolInput {
	bean_id: number;
	filter: 'user' | 'supplier' | 'both';
	include_radar_data?: boolean;
}

// Tool response interface
interface BeanTastingToolResponse {
	bean_info: {
		id: number;
		name: string;
		processing?: string;
		region?: string;
		source?: string;
	};
	tasting_notes: {
		user_notes?: {
			notes?: string | null;
			cupping_notes?: Json | null;
		} | null;
		supplier_notes?: {
			cupping_notes?: string | null;
			source?: string | null;
		};
		ai_notes?: {
			description?: string | null;
			tasting_notes?: string | null;
		};
		combined_notes?: {
			descriptions: (string | null | undefined)[];
			sources: string[];
		};
	};
	radar_data?: {
		body: number;
		flavor: number;
		acidity: number;
		sweetness: number;
		fragrance_aroma: number;
	};
	filter_applied: string;
	message: string;
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

		// Get the coffee bean information from catalog
		const { data: coffeeInfo, error: coffeeError } = await supabase
			.from('coffee_catalog')
			.select(
				'id, name, processing, region, source, cupping_notes, ai_tasting_notes, ai_description'
			)
			.eq('id', bean_id)
			.single();

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const coffee = coffeeInfo as any;

		if (coffeeError || !coffee) {
			return json(
				{
					error: 'Coffee bean not found',
					message: `No coffee found with bean_id: ${bean_id}`
				},
				{ status: 404 }
			);
		}

		let userNotes = null;
		let message = `Tasting notes for ${coffee.name}`;

		// Get user's inventory entry for this coffee (if they have it)
		if (filter === 'user' || filter === 'both') {
			const { data: userInventory } = await supabase
				.from('green_coffee_inv')
				.select('id, notes, cupping_notes')
				.eq('catalog_id', bean_id)
				.eq('user', user.id)
				.maybeSingle();

			if (userInventory) {
				userNotes = {
					notes: userInventory.notes,
					cupping_notes: userInventory.cupping_notes
				};
				message += ' (including your personal notes)';
			} else if (filter === 'user') {
				message += ' (you have not added this coffee to your inventory yet)';
			}
		}

		// Prepare tasting notes based on filter
		const tastingNotes: BeanTastingToolResponse['tasting_notes'] = {};

		if (filter === 'user' || filter === 'both') {
			tastingNotes.user_notes = userNotes;
		}

		if (filter === 'supplier' || filter === 'both') {
			tastingNotes.supplier_notes = {
				cupping_notes: coffee.cupping_notes,
				source: coffee.source
			};
		}

		// Always include AI notes for context
		tastingNotes.ai_notes = {
			description: coffee.ai_description,
			tasting_notes: coffee.ai_tasting_notes
		};

		// Create combined notes for 'both' filter
		if (filter === 'both') {
			const combinedDescriptions = [
				coffee.ai_description,
				coffee.cupping_notes,
				userNotes?.notes
			].filter(Boolean);

			tastingNotes.combined_notes = {
				descriptions: combinedDescriptions,
				sources: ['AI Analysis', 'Supplier Notes', 'Your Notes'].slice(
					0,
					combinedDescriptions.length
				)
			};
		}

		// Extract radar chart data if available and requested
		let radarData;
		if (include_radar_data && coffee.ai_tasting_notes) {
			try {
				const aiTastingNotes =
					typeof coffee.ai_tasting_notes === 'string'
						? JSON.parse(coffee.ai_tasting_notes)
						: coffee.ai_tasting_notes;

				if (aiTastingNotes && typeof aiTastingNotes === 'object') {
					radarData = {
						body: aiTastingNotes.body || 0,
						flavor: aiTastingNotes.flavor || 0,
						acidity: aiTastingNotes.acidity || 0,
						sweetness: aiTastingNotes.sweetness || 0,
						fragrance_aroma: aiTastingNotes.fragrance_aroma || 0
					};
				}
			} catch (error) {
				console.warn('Failed to parse AI tasting notes for radar data:', error);
			}
		}

		const response: BeanTastingToolResponse = {
			bean_info: {
				id: coffee.id,
				name: coffee.name,
				processing: coffee.processing,
				region: coffee.region,
				source: coffee.source
			},
			tasting_notes: tastingNotes,
			radar_data: radarData,
			filter_applied: filter,
			message: message
		};

		return json(response);
	} catch (error) {
		console.error('Bean tasting tool error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
