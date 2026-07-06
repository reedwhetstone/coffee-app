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

/**
 * ADR-008 Market Index decision-surface tools. Thin adapters over the
 * request-credentialed Parchment reads injected by the chat route; entitlement
 * is enforced server-side by Parchment (403s surface as upgrade guidance).
 */
export function createMarketIndexTools(deps: ChatToolDeps) {
	const tools: Record<string, unknown> = {};

	if (deps.marketSignals) {
		const marketSignals = deps.marketSignals;
		tools.market_signals = tool({
			description:
				'Actionable green coffee buy signals from this morning\'s market pass: price drops vs a lot\'s own trailing median, lots priced below their origin/process segment, and price-for-quality outliers. Every signal carries a machine-readable evidence object (segment median, discount %, percentile). Use for questions like "show me buy opportunities on washed Ethiopias under $7". Requires Parchment Intelligence; a 403 means the user should be pointed at the Intelligence plan, not retried. Note: score_value in responses is a supplier-stated number that varies by supplier methodology — never present it as a canonical Purveyors quality metric.',
			inputSchema: z.object({
				type: z
					.array(z.enum(['price_drop', 'below_market', 'value_quality']))
					.optional()
					.describe('Signal types to include (default all)'),
				origin: z.string().optional().describe('Origin country filter, e.g. "Ethiopia"'),
				process: z
					.string()
					.optional()
					.describe('Normalized process bucket, e.g. "Washed"; "undisclosed" for unknown'),
				market: z.enum(['retail', 'wholesale', 'all']).optional().describe('Market scope'),
				min_discount_pct: z.number().optional().describe('Minimum discount magnitude in percent'),
				min_score: z.number().optional().describe('Minimum cup score'),
				window: z.enum(['7d', '30d']).optional().describe('Trailing window for price_drop signals'),
				limit: z
					.number()
					.int()
					.min(1)
					.max(50)
					.optional()
					.default(10)
					.describe('Max signals to return (1-50)')
			}),
			execute: async (input) => marketSignals(input)
		});
	}

	if (deps.marketStats) {
		const marketStats = deps.marketStats;
		tools.market_stats = tool({
			description:
				'Price movement significance for the green coffee market or an origin/process segment: the latest move framed against its trailing baseline (z-score, percentile, quiet/normal/notable/exceptional classification) plus the repricing-vs-mix-shift decomposition (moveDriver). Use to answer "did the market really move?" or "is this Ethiopia move signal or noise?".',
			inputSchema: z.object({
				origin: z.string().optional().describe('Origin country; omit for market-wide'),
				process: z.string().optional().describe('Normalized process bucket; omit for all-process'),
				market: z.enum(['retail', 'wholesale', 'all']).optional().describe('Market scope'),
				window: z.enum(['7d', '30d']).optional().describe('Movement window (default 7d)'),
				baseline_weeks: z.number().optional().describe('Trailing baseline length in weeks')
			}),
			execute: async (input) => marketStats(input)
		});
	}

	if (deps.marketMetadataIndex) {
		const marketMetadataIndex = deps.marketMetadataIndex;
		tools.market_metadata = tool({
			description:
				'The metadata index: how the market\'s composition is changing over time — processing-method mix or disclosure-level mix (transparency trend) — market-wide or per origin. Cup-score trends are not available. Use for questions like "is anaerobic growing in Ethiopia?" or "is the market disclosing more about processing?".',
			inputSchema: z.object({
				dimension: z
					.enum(['process', 'disclosure'])
					.describe(
						'Which metadata dimension to trend. Cup-score trends are intentionally unavailable: supplier scores are inconsistent and not surfaced as a Purveyors metric.'
					),
				origin: z.string().optional().describe('Origin country; omit for market-wide'),
				market: z.enum(['retail', 'wholesale', 'all']).optional().describe('Market scope'),
				grain: z.enum(['week', 'month']).optional().describe('Period grain (default month)'),
				from: z.string().optional().describe('ISO start date'),
				to: z.string().optional().describe('ISO end date')
			}),
			execute: async (input) => marketMetadataIndex(input)
		});
	}

	return tools;
}
