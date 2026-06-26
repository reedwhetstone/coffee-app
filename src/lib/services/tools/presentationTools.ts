import { tool } from 'ai';
import { z } from 'zod';

export function createPresentationTools() {
	return {
		present_results: tool({
			description:
				'Present curated results with annotations and layout control. Call AFTER a search tool to control what the user sees.',
			inputSchema: z.object({
				source_tool: z.enum([
					'coffee_catalog_search',
					'catalog_rank',
					'green_coffee_inventory',
					'roast_profiles'
				]),
				layout: z
					.enum(['inline', 'grid', 'focused'])
					.describe(
						'inline: vertical stack for exploration. grid: side-by-side for comparison. focused: single highlighted recommendation.'
					),
				items: z.array(
					z.object({
						id: z.number().describe('Item ID from search results'),
						annotation: z.string().optional().describe('Natural language annotation for this item'),
						highlight: z.boolean().optional().describe('Visually emphasize this item as top pick')
					})
				),
				canvas_layout: z
					.enum(['focus', 'comparison', 'dashboard'])
					.optional()
					.describe(
						'Canvas layout hint. focus: single item with full detail. comparison: side-by-side evaluation. dashboard: grid of multiple items.'
					),
				canvas_action: z
					.enum(['replace', 'add', 'clear'])
					.optional()
					.describe(
						'Canvas action. replace: clear canvas and show new items (default). add: keep existing and add new. clear: clear canvas entirely.'
					)
			}),
			execute: async (input) => ({ presentation: input })
		})
	};
}
