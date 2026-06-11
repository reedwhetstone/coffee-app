import { describe, expect, it } from 'vitest';
import {
	buildSearchDataCache,
	extractBlockFromPart,
	extractCanvasMutationsFromPart
} from './blockExtractor';

const rankedCoffees = [
	{ id: 11, name: 'Ethiopia Hambela', rank: 1, rank_basis: 'Purveyor Score 92, exceptional' },
	{ id: 12, name: 'Yemen Haraz', rank: 2, rank_basis: 'Purveyor Score 88, excellent' }
];

function rankPart() {
	return {
		type: 'tool-catalog_rank',
		toolName: 'catalog_rank',
		state: 'output-available',
		output: { coffees: rankedCoffees, objective: 'premium', caveats: [] }
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
