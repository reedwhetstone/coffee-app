import { describe, expect, it } from 'vitest';
import { inlineCoffeeResults } from './inlineCoffeeResults';

const coffee = (id: number) => ({ id, name: `Coffee ${id}` });
const search = (ids = [1, 2], tool = 'coffee_catalog_search') => ({
	type: `tool-${tool}`,
	toolCallId: `${tool}-call`,
	state: 'output-available',
	output: { coffees: ids.map(coffee) }
});
const present = (ids: number[], state = 'output-available') => ({
	type: 'tool-present_results',
	toolCallId: 'present',
	state,
	output: {
		presentation: {
			source_tool: 'coffee_catalog_search',
			items: ids.map((id) => ({ id, annotation: 'Selected' }))
		}
	}
});
const select = (...parts: unknown[]) => inlineCoffeeResults([{ parts }], 0);

describe('progressive inline coffee selection', () => {
	it('keeps a completed search visible through pending and failed presentation', () => {
		for (const state of ['input-streaming', 'input-available', 'output-error']) {
			expect(select(search(), present([2], state))[0].block.data.map((c) => c.id)).toEqual([1, 2]);
		}
	});

	it('atomically replaces raw results with the completed annotated selection', () => {
		const raw = select(search());
		const curated = select(search(), present([2]));
		expect(curated).toHaveLength(1);
		expect(curated[0].key).toBe(raw[0].key);
		expect(curated[0].block.data.map((c) => c.id)).toEqual([2]);
		expect(curated[0].block.annotations).toEqual([
			{ id: 2, annotation: 'Selected', highlight: undefined }
		]);
	});

	it('uses only causally prior reads, including previous messages', () => {
		expect(select(present([1]), search())[0].partIndex).toBe(1);
		const history = [{ parts: [search()] }, { parts: [present([2])] }];
		expect(inlineCoffeeResults(history, 1)[0].block.data.map((c) => c.id)).toEqual([2]);
		expect(inlineCoffeeResults(history, 0)[0].block.data.map((c) => c.id)).toEqual([1, 2]);
	});

	it('does not hide reads for missing presentation references or canvas-only clear', () => {
		expect(select(search(), present([99]))[0].block.data.map((c) => c.id)).toEqual([1, 2]);
		const clear = present([]);
		expect(select(search(), clear)[0].block.data.map((c) => c.id)).toEqual([1, 2]);
	});

	it('does not repeat duplicate rows or identical ranking and search lists', () => {
		const results = select(search([1, 1, 2]), search([1, 2], 'catalog_rank'));
		expect(results).toHaveLength(1);
		expect(results[0].block.data.map((c) => c.id)).toEqual([1, 2]);
	});

	it('curates equivalent search and ranking views without resurrecting raw results', () => {
		const raw = select(search(), search([1, 2], 'catalog_rank'));
		const curated = select(search(), search([1, 2], 'catalog_rank'), present([2]));
		expect(curated).toHaveLength(1);
		expect(curated[0].key).toBe(raw[0].key);
		expect(curated[0].block.data.map((c) => c.id)).toEqual([2]);
		const refreshed = select(
			search(),
			search([1, 2], 'catalog_rank'),
			present([2]),
			search([3], 'catalog_rank')
		);
		expect(refreshed.map((view) => view.block.data.map((c) => c.id))).toEqual([[2], [3]]);
		expect(new Set(refreshed.map((view) => view.key)).size).toBe(2);
	});

	it('does not treat unfinished, malformed, failed, or action-shaped output as coffee evidence', () => {
		for (const output of [
			{ coffees: [null] },
			{ coffees: [{ id: -1, name: 'Bad' }] },
			{ coffees: [coffee(1)], success: false },
			{ coffees: [coffee(1)], action_card: {} }
		]) {
			expect(select({ ...search(), output }, present([1]))).toEqual([]);
		}
		expect(select({ ...search(), state: 'input-available' })).toEqual([]);
	});
});
