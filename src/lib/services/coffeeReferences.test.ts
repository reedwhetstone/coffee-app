import { describe, expect, it } from 'vitest';
import {
	catalogReferenceId,
	coffeeReferencesThroughPart,
	safeAnswerLink
} from './coffeeReferences';
const read = (id = 7, name = 'Guji', tool = 'coffee_catalog_search') => ({
	type: `tool-${tool}`,
	state: 'output-available',
	output: { coffees: [{ id, name, cost_lb: 8 }] }
});
const assistant = (parts: unknown[], id = 'answer') => ({ id, role: 'assistant', parts });
describe('causal coffee references', () => {
	it('uses only completed assistant evidence before the cited text, latest read wins', () => {
		const messages = [
			assistant([read()], 'earlier'),
			{ id: 'user', role: 'user', parts: [read(99)] },
			assistant([read(7, 'New observation', 'catalog_rank'), { type: 'text' }, read(7, 'Future')])
		];
		const refs = coffeeReferencesThroughPart(messages, 2, 1);
		expect([...refs.keys()]).toEqual([7]);
		expect(refs.get(7)).toMatchObject({
			coffee: { name: 'New observation' },
			messageId: 'answer',
			partIndex: 0
		});
		expect(coffeeReferencesThroughPart(messages, 0, 0).size).toBe(0);
		expect(coffeeReferencesThroughPart(messages, 0, 1).get(7)?.coffee.name).toBe('Guji');
	});
	it('rejects proposed, failed, unfinished, malformed and non-catalog records', () => {
		const parts = [
			{ ...read(), state: 'input-available' },
			{ ...read(), output: { coffees: [{ id: 7, name: 'Bad' }], success: false } },
			read(-1),
			read(7, 'Not coffee', 'inventory'),
			{
				type: 'tool-present_results',
				state: 'output-available',
				output: { presentation: { source_tool: 'coffee_catalog_search', items: [{ id: 7 }] } }
			}
		];
		expect(coffeeReferencesThroughPart([assistant(parts)], 0, parts.length).size).toBe(0);
	});
	it('admits an earlier tool part only when its output completes, consistently after reload', () => {
		const messages = [assistant([{ ...read(), state: 'input-available' }, { type: 'text' }])];
		expect(coffeeReferencesThroughPart(messages, 0, 1).size).toBe(0);
		messages[0].parts[0] = read();
		expect(coffeeReferencesThroughPart(messages, 0, 1).get(7)?.coffee.name).toBe('Guji');
		expect(
			coffeeReferencesThroughPart(JSON.parse(JSON.stringify(messages)), 0, 1).get(7)?.coffee.name
		).toBe('Guji');
	});

	it('survives JSON persistence without admitting later observations', () => {
		const messages = JSON.parse(
			JSON.stringify([
				assistant([read(), { type: 'text' }]),
				assistant([read(7, 'Changed')], 'later')
			])
		);
		expect(coffeeReferencesThroughPart(messages, 0, 1).get(7)?.coffee.name).toBe('Guji');
	});
});
describe('catalog reference URLs', () => {
	it('recognizes only exact first-party catalog identities', () => {
		expect(catalogReferenceId('/catalog?coffee=7')).toBe(7);
		expect(catalogReferenceId('https://purveyors.io/catalog?coffee=7&showWholesale=true')).toBe(7);
		for (const href of [
			'/catalog?coffee=0',
			'/catalog?coffee=7&coffee=8',
			'/catalog?coffee=7.1',
			'/catalog?coffee=9007199254740992'
		])
			expect(catalogReferenceId(href)).toBe('unavailable');
		for (const href of [
			'https://evil.test/catalog?coffee=7',
			'//evil.test/catalog?coffee=7',
			'https://purveyors.io.evil.test/catalog?coffee=7',
			'/beans?coffee=7',
			'/catalog',
			'javascript:alert(1)'
		])
			expect(catalogReferenceId(href)).toBeNull();
	});
	it('preserves safe ordinary navigation while rejecting active/protocol-relative links', () => {
		for (const href of [
			'javascript:alert(1)',
			'data:text/html,hi',
			'//evil.test',
			'/\\evil.test',
			'java\nscript:alert(1)'
		])
			expect(safeAnswerLink(href)).toBeUndefined();
		expect(safeAnswerLink('https://supplier.test/lot')).toBe('https://supplier.test/lot');
		expect(safeAnswerLink('/catalog?country=Ethiopia')).toBe('/catalog?country=Ethiopia');
	});
});
