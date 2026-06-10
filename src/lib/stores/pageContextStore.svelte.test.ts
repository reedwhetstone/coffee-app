import { beforeEach, describe, expect, it } from 'vitest';
import {
	clampPageChatContext,
	pageChatContext,
	PAGE_CONTEXT_MAX_ENTITIES,
	PAGE_CONTEXT_MAX_SUMMARY_CHARS,
	type PageChatContext
} from './pageContextStore.svelte';

describe('clampPageChatContext', () => {
	it('truncates oversized summaries and entity lists', () => {
		const context: PageChatContext = {
			surface: 'catalog',
			summary: 'x'.repeat(PAGE_CONTEXT_MAX_SUMMARY_CHARS + 500),
			entities: Array.from({ length: 20 }, (_, i) => ({
				type: 'coffee' as const,
				id: i,
				label: 'y'.repeat(400)
			}))
		};

		const clamped = clampPageChatContext(context);

		expect(clamped.summary.length).toBe(PAGE_CONTEXT_MAX_SUMMARY_CHARS);
		expect(clamped.entities?.length).toBe(PAGE_CONTEXT_MAX_ENTITIES);
		expect(clamped.entities?.[0].label.length).toBeLessThanOrEqual(120);
	});

	it('passes compact contexts through unchanged', () => {
		const context: PageChatContext = {
			surface: 'analytics',
			summary: 'Parchment Market Index — prices firming',
			entities: [{ type: 'coffee', id: 42, label: 'Ethiopia Hambela' }]
		};

		expect(clampPageChatContext(context)).toEqual(context);
	});
});

describe('pageChatContext store', () => {
	beforeEach(() => {
		pageChatContext.clear();
	});

	it('stores a clamped context and clears it', () => {
		pageChatContext.set({
			surface: 'catalog',
			summary: '  Catalog filtered to Ethiopia  '.padEnd(700, '.'),
			entities: []
		});

		expect(pageChatContext.current?.surface).toBe('catalog');
		expect(pageChatContext.current?.summary.length).toBeLessThanOrEqual(
			PAGE_CONTEXT_MAX_SUMMARY_CHARS
		);

		pageChatContext.clear();
		expect(pageChatContext.current).toBeNull();
	});
});
