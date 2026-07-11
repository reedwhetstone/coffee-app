import { describe, expect, it } from 'vitest';
import {
	applyAnalyticsSeedToInput,
	buildAnalyticsChatPrompt,
	readAnalyticsSeedFromSearchParams,
	type AnalyticsChatContext
} from './actionContext';

const analyticsContext: AnalyticsChatContext = {
	origin: null,
	process: null,
	supplier: null,
	viewMode: 'retail',
	timeWindow: '7d',
	activeFilters: {
		marketScope: 'retail',
		movementWindow: '7d',
		latestIndexDate: '2026-04-08',
		stockedListings: 84,
		suppliers: 3,
		origins: 5
	},
	visibleModules: ['public-index', 'supplier-comparison'],
	entitlement: 'intelligence'
};

describe('analytics action context', () => {
	it('builds a user-legible chat prompt without raw context serialization or internal entitlement labels', () => {
		const prompt = buildAnalyticsChatPrompt(analyticsContext, 'Colombia retail prices moved 4%');

		expect(prompt).toContain('Review this market analytics context');
		expect(prompt).toContain('Market read: Colombia retail prices moved 4%');
		expect(prompt).toContain('Scope: retail');
		expect(prompt).toContain('Movement window: 7d');
		expect(prompt).toContain('Latest index date: 2026-04-08');
		expect(prompt).toContain('Stocked listings: 84');
		expect(prompt).toContain('Suppliers in scope: 3');
		expect(prompt).toContain('Origins in scope: 5');
		expect(prompt).toContain('Access level: Parchment Intelligence');
		expect(prompt).not.toContain('Context JSON');
		expect(prompt).not.toContain('Entitlement: intelligence');
		expect(prompt).not.toContain(JSON.stringify(analyticsContext));
	});

	it('extracts /chat analytics seeds from source and prompt search params', () => {
		expect(
			readAnalyticsSeedFromSearchParams(
				new URLSearchParams('source=analytics&prompt=Compare%20Brazil')
			)
		).toBe('Compare Brazil');
		expect(
			readAnalyticsSeedFromSearchParams(new URLSearchParams('prompt=Compare%20Brazil'))
		).toBeNull();
		expect(
			readAnalyticsSeedFromSearchParams(new URLSearchParams('source=analytics&prompt=%20'))
		).toBeNull();
	});

	it('seeds chat input on analytics navigation without replaying the same seed', () => {
		const firstSeed = applyAnalyticsSeedToInput({
			canUseChat: true,
			incomingSeed: 'Ask about Colombia',
			inputMessage: '',
			lastAnalyticsSeed: null
		});

		expect(firstSeed).toEqual({
			inputMessage: 'Ask about Colombia',
			lastAnalyticsSeed: 'Ask about Colombia'
		});
		expect(
			applyAnalyticsSeedToInput({
				canUseChat: true,
				incomingSeed: 'Ask about Colombia',
				inputMessage: '',
				lastAnalyticsSeed: 'Ask about Colombia'
			})
		).toEqual({ inputMessage: '', lastAnalyticsSeed: 'Ask about Colombia' });
	});

	it('updates a prior analytics seed on CSR re-navigation but preserves actively typed input', () => {
		expect(
			applyAnalyticsSeedToInput({
				canUseChat: true,
				incomingSeed: 'Ask about Ethiopia',
				inputMessage: 'Ask about Colombia',
				lastAnalyticsSeed: 'Ask about Colombia'
			})
		).toEqual({
			inputMessage: 'Ask about Ethiopia',
			lastAnalyticsSeed: 'Ask about Ethiopia'
		});

		expect(
			applyAnalyticsSeedToInput({
				canUseChat: true,
				incomingSeed: 'Ask about Ethiopia',
				inputMessage: 'User typed a different question',
				lastAnalyticsSeed: 'Ask about Colombia'
			})
		).toEqual({
			inputMessage: 'User typed a different question',
			lastAnalyticsSeed: 'Ask about Ethiopia'
		});
	});

	it('does not seed analytics prompts for users who cannot use chat', () => {
		expect(
			applyAnalyticsSeedToInput({
				canUseChat: false,
				incomingSeed: 'Ask about Colombia',
				inputMessage: '',
				lastAnalyticsSeed: null
			})
		).toEqual({ inputMessage: '', lastAnalyticsSeed: null });
	});
});
