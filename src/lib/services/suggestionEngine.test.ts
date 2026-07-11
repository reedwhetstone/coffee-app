import { describe, expect, it } from 'vitest';
import { getSuggestions } from './suggestionEngine';
import type { CanvasBlock } from '$lib/types/genui';

function canvasBlock(type: CanvasBlock['block']['type']): CanvasBlock {
	return {
		id: `${type}-1`,
		block: {
			type,
			version: 1,
			data: []
		} as CanvasBlock['block'],
		messageId: 'msg-1',
		pinned: false,
		minimized: false,
		addedAt: 0
	};
}

describe('getSuggestions access filtering', () => {
	it('keeps Mallard Studio starter suggestions available for members', () => {
		const suggestions = getSuggestions('general', [], false, { canUseMallardWorkspaces: true });

		expect(suggestions.map((suggestion) => suggestion.label)).toContain('Recent roasts');
	});

	it('filters Mallard-only starter suggestions for Parchment Intelligence-only users', () => {
		const suggestions = getSuggestions('general', [], false, { canUseMallardWorkspaces: false });

		expect(suggestions.map((suggestion) => suggestion.label)).toEqual([
			'Find coffee',
			'My inventory'
		]);
		expect(suggestions.map((suggestion) => suggestion.text).join(' ')).not.toMatch(
			/roast|sale|profit/i
		);
	});

	it('keeps portfolio actions in Parchment canvas suggestions', () => {
		const suggestions = getSuggestions('general', [canvasBlock('coffee-cards')], true, {
			canUseMallardWorkspaces: false
		});

		expect(suggestions.map((suggestion) => suggestion.label)).toContain('Add to inventory');
	});

	it('filters roast prompts from Parchment canvas suggestions', () => {
		const suggestions = getSuggestions('general', [canvasBlock('inventory-table')], true, {
			canUseMallardWorkspaces: false
		});

		expect(suggestions.map((suggestion) => suggestion.label)).not.toContain('What should I roast?');
		expect(suggestions.map((suggestion) => suggestion.label)).toEqual(['Clear canvas']);
	});
});
