import { tool } from 'ai';
import { z } from 'zod';
import type { AgentParchmentClient } from './parchment';
import { unwrapParchment } from './parchment';

export function createTastingTools(client: AgentParchmentClient) {
	return {
		bean_tasting_notes: tool({
			description:
				'Get tasting notes and radar chart data for a specific coffee bean; user data, supplier data, or both',
			inputSchema: z.object({
				bean_id: z.number(),
				filter: z.enum(['user', 'supplier', 'both']).default('both')
			}),
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
				return unwrapParchment(
					await client.tasting.get(String(input.bean_id), { filter: input.filter })
				).data;
			}
		})
	};
}
