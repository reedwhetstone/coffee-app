import { tool } from 'ai';
import { z } from 'zod';
import type { ChatToolDeps } from './shared';

export function createMarketTools(deps: ChatToolDeps) {
	const readPriceIndex = deps.readPriceIndex;

	if (!readPriceIndex) return {};

	return {
		price_index_read: tool({
			description:
				'Read the Parchment Market Index: aggregate green coffee price snapshots (min/p25/median/avg/p75/max per lb, supplier and listing counts) by origin and process over a time window. Use for market pricing questions like "is this priced well?" or "what are Ethiopia naturals going for?". Aggregate data only — never per-supplier prices.',
			inputSchema: z.object({
				origin: z.string().optional().describe('Origin country to filter snapshots'),
				process: z.string().optional().describe('Processing method to filter snapshots'),
				days: z.number().optional().default(90).describe('Lookback window in days (max 365)'),
				wholesale: z
					.boolean()
					.optional()
					.describe('Filter to wholesale-only (true) or retail (false) segments'),
				limit: z.number().optional().default(30).describe('Number of snapshots (max 60)')
			}),
			execute: async (input) => readPriceIndex(input)
		})
	};
}
