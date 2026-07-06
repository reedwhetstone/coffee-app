import { describe, expect, it } from 'vitest';
import type { UIBlock } from '$lib/types/genui';
import {
	buildSearchDataCache,
	buildSearchDataCacheThroughPart,
	extractBlockFromPart,
	extractCanvasMutationsFromPart
} from './blockExtractor';

const rankedCoffees = [
	{ id: 11, name: 'Ethiopia Hambela', rank: 1, rank_basis: 'Purveyor Score 92, exceptional' },
	{ id: 12, name: 'Yemen Haraz', rank: 2, rank_basis: 'Purveyor Score 88, excellent' }
];

const marketSignals = [
	{
		catalogId: 42,
		name: 'Kenya Gichathaini',
		signalType: 'below_market',
		market: 'wholesale',
		currentPriceLb: 6.25,
		evidence: {
			discount_vs_median_pct: -14.2,
			segment_median: 7.28,
			price_percentile_in_segment: 18
		}
	}
];

function rankPart() {
	return {
		type: 'tool-catalog_rank',
		toolName: 'catalog_rank',
		state: 'output-available',
		output: { coffees: rankedCoffees, objective: 'premium', caveats: [] }
	};
}

function marketSignalsPart() {
	return {
		type: 'tool-market_signals',
		toolName: 'market_signals',
		state: 'output-available',
		output: { data: marketSignals, meta: { asOf: '2026-07-06' } }
	};
}

describe('blockExtractor catalog_rank support', () => {
	it('renders catalog_rank output as coffee cards', () => {
		const block = extractBlockFromPart(rankPart());

		expect(block).toMatchObject({ type: 'coffee-cards', data: rankedCoffees });
	});

	it('suppresses raw catalog_rank output when present_results is in the message', () => {
		const block = extractBlockFromPart(rankPart(), { hasPresentResults: true });

		expect(block).toBeNull();
	});

	it('caches catalog_rank items for present_results merging', () => {
		const cache = buildSearchDataCache([rankPart()]);

		expect(cache.get('catalog_rank')?.get(11)).toMatchObject({ name: 'Ethiopia Hambela' });
	});

	it('builds an annotated coffee-cards block from a catalog_rank presentation', () => {
		const cache = buildSearchDataCache([rankPart()]);
		const presentPart = {
			type: 'tool-present_results',
			toolName: 'present_results',
			state: 'output-available',
			output: {
				presentation: {
					source_tool: 'catalog_rank',
					layout: 'grid',
					items: [
						{ id: 11, annotation: 'Top of the index right now', highlight: true },
						{ id: 12, annotation: 'Rare origin worth a look' }
					]
				}
			}
		};

		const block = extractBlockFromPart(presentPart, {
			searchDataCache: cache,
			hasPresentResults: true
		});

		expect(block).toMatchObject({
			type: 'coffee-cards',
			layout: 'grid',
			annotations: [
				{ id: 11, annotation: 'Top of the index right now', highlight: true },
				{ id: 12, annotation: 'Rare origin worth a look', highlight: undefined }
			]
		});
	});

	it('merges items from multiple messages into one cache (conversation-wide present_results)', () => {
		const olderPart = {
			...rankPart(),
			output: {
				coffees: [{ id: 99, name: 'Older Search Result' }],
				objective: 'value',
				caveats: []
			}
		};
		const cache = buildSearchDataCache([olderPart, rankPart()]);

		expect(cache.get('catalog_rank')?.get(99)).toMatchObject({ name: 'Older Search Result' });
		expect(cache.get('catalog_rank')?.get(11)).toMatchObject({ name: 'Ethiopia Hambela' });
	});

	it('builds causal per-part caches without seeing later results in the same message', () => {
		const priorPart = {
			...rankPart(),
			output: {
				coffees: [{ id: 99, name: 'Prior Search Result' }],
				objective: 'value',
				caveats: []
			}
		};
		const presentPart = {
			type: 'tool-present_results',
			toolName: 'present_results',
			state: 'output-available',
			output: {
				presentation: {
					source_tool: 'catalog_rank',
					layout: 'grid',
					items: [{ id: 11, annotation: 'This ID only appears later in the same message' }]
				}
			}
		};
		const laterPart = rankPart();
		const messages = [{ parts: [priorPart] }, { parts: [presentPart, laterPart] }];

		const presentCache = buildSearchDataCacheThroughPart(messages, 1, 0);
		expect(presentCache.get('catalog_rank')?.get(99)).toMatchObject({
			name: 'Prior Search Result'
		});
		expect(presentCache.get('catalog_rank')?.has(11)).toBe(false);

		const block = extractBlockFromPart(presentPart, {
			searchDataCache: presentCache,
			hasPresentResults: true
		});
		expect(block).toMatchObject({ type: 'error', data: { retryable: false } });

		const laterCache = buildSearchDataCacheThroughPart(messages, 1, 1);
		expect(laterCache.get('catalog_rank')?.get(11)).toMatchObject({ name: 'Ethiopia Hambela' });
	});
});

describe('blockExtractor market_signals support', () => {
	it('renders raw market_signals output as a table', () => {
		const block = extractBlockFromPart(marketSignalsPart());

		expect(block).toMatchObject({
			type: 'data-table',
			data: {
				rows: [
					{
						id: 42,
						signal: 'Below market',
						lot: 'Kenya Gichathaini',
						market: 'wholesale',
						price: '$6.25/lb'
					}
				]
			}
		});
	});

	it('suppresses raw market_signals output when present_results is in the message', () => {
		const block = extractBlockFromPart(marketSignalsPart(), { hasPresentResults: true });

		expect(block).toBeNull();
	});

	it('caches market_signals by catalogId for present_results merging', () => {
		const cache = buildSearchDataCache([marketSignalsPart()]);

		expect(cache.get('market_signals')?.get(42)).toMatchObject({ name: 'Kenya Gichathaini' });
	});

	it('builds an annotated table from a market_signals presentation', () => {
		const cache = buildSearchDataCache([marketSignalsPart()]);
		const presentPart = {
			type: 'tool-present_results',
			toolName: 'present_results',
			state: 'output-available',
			output: {
				presentation: {
					source_tool: 'market_signals',
					layout: 'grid',
					items: [{ id: 42, annotation: 'Best wholesale value signal right now' }]
				}
			}
		};

		const block = extractBlockFromPart(presentPart, {
			searchDataCache: cache,
			hasPresentResults: true
		});

		expect(block).toMatchObject({
			type: 'data-table',
			data: {
				rows: [
					{
						id: 42,
						note: 'Best wholesale value signal right now'
					}
				]
			}
		});
	});
});

describe('blockExtractor present_results cache misses', () => {
	function missPart() {
		return {
			type: 'tool-present_results',
			toolName: 'present_results',
			state: 'output-available',
			output: {
				presentation: {
					source_tool: 'catalog_rank',
					layout: 'grid',
					canvas_layout: 'dashboard',
					items: [{ id: 555, annotation: 'Not in any search result' }]
				}
			}
		};
	}

	it('returns a visible error block instead of failing silently', () => {
		const block = extractBlockFromPart(missPart(), {
			searchDataCache: buildSearchDataCache([rankPart()]),
			hasPresentResults: true
		});

		expect(block).toMatchObject({ type: 'error', data: { retryable: false } });
	});

	it('produces no canvas mutations for a cache-miss error block', () => {
		const block = extractBlockFromPart(missPart(), {
			searchDataCache: buildSearchDataCache([rankPart()]),
			hasPresentResults: true
		});
		const mutations = extractCanvasMutationsFromPart(missPart(), block, 'msg-1');

		expect(mutations).toBeNull();
	});

	it('still honors canvas_action clear when the block is missing', () => {
		const clearPart = {
			type: 'tool-present_results',
			toolName: 'present_results',
			state: 'output-available',
			output: {
				presentation: {
					source_tool: 'catalog_rank',
					layout: 'grid',
					canvas_action: 'clear',
					items: [{ id: 555 }]
				}
			}
		};
		const mutations = extractCanvasMutationsFromPart(clearPart, null, 'msg-1');

		expect(mutations).toEqual([{ type: 'clear' }]);
	});
});

describe('blockExtractor canvas_title plumbing', () => {
	const block: UIBlock = { type: 'coffee-cards', version: 1, data: [] };

	function presentPart(presentation: Record<string, unknown>) {
		return {
			type: 'tool-present_results',
			toolName: 'present_results',
			state: 'output-available',
			output: { presentation: { source_tool: 'catalog_rank', items: [{ id: 1 }], ...presentation } }
		};
	}

	it('attaches a trimmed AI title to a replace mutation', () => {
		const mutations = extractCanvasMutationsFromPart(
			presentPart({ canvas_action: 'replace', canvas_title: '  Ethiopia naturals  ' }),
			block,
			'msg-1'
		);

		expect(mutations).toEqual([
			{ type: 'replace', blocks: [{ block, messageId: 'msg-1', title: 'Ethiopia naturals' }] }
		]);
	});

	it('attaches a title to an add mutation', () => {
		const mutations = extractCanvasMutationsFromPart(
			presentPart({ canvas_action: 'add', canvas_title: 'Espresso roasts' }),
			block,
			'msg-2'
		);

		expect(mutations?.[0]).toEqual({
			type: 'add',
			block,
			messageId: 'msg-2',
			title: 'Espresso roasts'
		});
	});

	it('leaves title undefined when canvas_title is absent or blank', () => {
		const mutations = extractCanvasMutationsFromPart(
			presentPart({ canvas_action: 'add', canvas_title: '   ' }),
			block,
			'msg-3'
		);

		expect(mutations?.[0]).toMatchObject({ type: 'add', title: undefined });
	});
});
