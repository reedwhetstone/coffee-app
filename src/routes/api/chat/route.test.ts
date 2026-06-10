import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({ OPENROUTER_API_KEY: 'test-key' }));
vi.mock('$lib/server/auth', () => ({
	AuthError: class AuthError extends Error {},
	requireChatAccess: vi.fn()
}));
vi.mock('$lib/services/tools', () => ({ createChatTools: vi.fn() }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: vi.fn() }));
vi.mock('ai', () => ({
	convertToModelMessages: vi.fn(),
	streamText: vi.fn(),
	stepCountIs: vi.fn()
}));

import { _buildSystemPrompt } from './+server';

describe('chat system prompt entitlement context', () => {
	it('only advertises Parchment tools for Parchment Intelligence-only users', () => {
		const prompt = _buildSystemPrompt({ type: 'roasting' }, 'PPI User', {
			ppiAccess: true,
			memberAccess: false
		});

		expect(prompt).toContain('You have access to Parchment Intelligence tools');
		expect(prompt).toContain('coffee_catalog_search');
		expect(prompt).toContain('green_coffee_inventory');
		expect(prompt).toContain('find_similar_beans');
		expect(prompt).toContain('catalog_facets');
		expect(prompt).toContain('supplier_list');
		expect(prompt).toContain('catalog_rank');
		expect(prompt).toContain('price_index_read');
		expect(prompt).toContain('add_bean_to_inventory');
		expect(prompt).toContain('Mallard-only roast, tasting, and sales tools are unavailable');
		expect(prompt).not.toContain('You have access to these tools');
		expect(prompt).not.toContain('roast_profiles');
		expect(prompt).not.toContain('record_sale');
		expect(prompt).not.toContain('WORKSPACE FOCUS: Roasting');
	});

	it('keeps Mallard-only tool and workspace guidance for members', () => {
		const prompt = _buildSystemPrompt({ type: 'roasting' }, 'Member User', {
			ppiAccess: false,
			memberAccess: true
		});

		expect(prompt).toContain('You have access to these tools');
		expect(prompt).toContain('roast_profiles');
		expect(prompt).toContain('record_sale');
		expect(prompt).toContain('catalog_rank');
		expect(prompt).toContain('price_index_read');
		expect(prompt).toContain('WORKSPACE FOCUS: Roasting');
	});
});
