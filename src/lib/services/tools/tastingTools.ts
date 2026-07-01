import { tool } from 'ai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTastingNotes, getTastingNotesSchema } from '@purveyors/cli/tasting';

export function createTastingTools(supabase: SupabaseClient, userId: string) {
	return {
		bean_tasting_notes: tool({
			description:
				'Get tasting notes and radar chart data for a specific coffee bean; user data, supplier data, or both',
			inputSchema: getTastingNotesSchema,
			execute: async (input) => {
				// CLI schema field names match execute params (bean_id, filter).
				// include_radar_data was chat-specific; CLI returns cupping_notes
				// as raw JSON which contains radar-compatible data.
				if (!input.bean_id || input.bean_id <= 0) {
					return {
						error:
							'bean_id is required and must be a positive integer. Please specify which bean to get tasting notes for.'
					};
				}
				const result = await getTastingNotes(supabase, userId, input.bean_id, input.filter);
				return result;
			}
		})
	};
}
