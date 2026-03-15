/**
 * Tasting notes data layer — queries for coffee bean tasting notes.
 *
 * Auth is intentionally excluded from this module. Route handlers are responsible
 * for validating sessions / API keys before calling these functions.
 *
 * Key design decisions:
 *  - getTastingNotes returns a structured TastingNotesResult that the route
 *    handler reshapes into its GenUI response envelope.
 *  - Radar data extraction lives here so the route handler stays thin.
 *  - The filter parameter mirrors the original route's logic exactly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Json } from '$lib/types/database.types';

// ── Output types ──────────────────────────────────────────────────────────────

export interface BeanInfo {
	id: number;
	name: string;
	processing?: string | null;
	region?: string | null;
	source?: string | null;
}

export interface UserNotes {
	notes?: string | null;
	cupping_notes?: Json | null;
}

export interface SupplierNotes {
	cupping_notes?: string | null;
	source?: string | null;
}

export interface AiNotes {
	description?: string | null;
	tasting_notes?: string | null;
}

export interface CombinedNotes {
	descriptions: (string | null | undefined)[];
	sources: string[];
}

export interface TastingNotes {
	user_notes?: UserNotes | null;
	supplier_notes?: SupplierNotes;
	ai_notes?: AiNotes;
	combined_notes?: CombinedNotes;
}

export interface RadarData {
	body: number;
	flavor: number;
	acidity: number;
	sweetness: number;
	fragrance_aroma: number;
}

export interface TastingNotesResult {
	bean_info: BeanInfo;
	tasting_notes: TastingNotes;
	radar_data?: RadarData;
	filter_applied: string;
	message: string;
}

// ── Query function ────────────────────────────────────────────────────────────

/**
 * Fetch tasting notes for a coffee bean.
 *
 * @param supabase - Supabase client
 * @param userId   - Authenticated user ID (used when filter includes 'user')
 * @param beanId   - coffee_catalog.id to look up
 * @param options  - filter: which notes to include; includeRadarData: parse radar chart scores
 *
 * Throws if the bean is not found.
 */
export async function getTastingNotes(
	supabase: SupabaseClient,
	userId: string,
	beanId: number,
	options: {
		filter: 'user' | 'supplier' | 'both';
		includeRadarData?: boolean;
	}
): Promise<TastingNotesResult> {
	const { filter, includeRadarData = true } = options;

	// Get the coffee bean information from catalog
	const { data: coffeeInfo, error: coffeeError } = await supabase
		.from('coffee_catalog')
		.select('id, name, processing, region, source, cupping_notes, ai_tasting_notes, ai_description')
		.eq('id', beanId)
		.single();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const coffee = coffeeInfo as any;

	if (coffeeError || !coffee) {
		throw Object.assign(new Error(`No coffee found with bean_id: ${beanId}`), { status: 404 });
	}

	let userNotes: UserNotes | null = null;
	let message = `Tasting notes for ${coffee.name}`;

	// Get user's inventory entry for this coffee (if they have it)
	if (filter === 'user' || filter === 'both') {
		const { data: userInventory } = await supabase
			.from('green_coffee_inv')
			.select('id, notes, cupping_notes')
			.eq('catalog_id', beanId)
			.eq('user', userId)
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

	// Build tasting notes based on filter
	const tastingNotes: TastingNotes = {};

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
			sources: ['AI Analysis', 'Supplier Notes', 'Your Notes'].slice(0, combinedDescriptions.length)
		};
	}

	// Extract radar chart data if available and requested
	let radarData: RadarData | undefined;
	if (includeRadarData && coffee.ai_tasting_notes) {
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
		} catch (err) {
			console.warn('Failed to parse AI tasting notes for radar data:', err);
		}
	}

	return {
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
		message
	};
}
