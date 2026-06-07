import { describe, expect, it } from 'vitest';
import { createChatTools } from './tools';

const supabase = {} as Parameters<typeof createChatTools>[0];

function toolNames(access: Parameters<typeof createChatTools>[2]) {
	return Object.keys(createChatTools(supabase, 'user-123', access)).sort();
}

describe('createChatTools entitlement allowlist', () => {
	it('keeps the full tool set for Mallard Studio members', () => {
		expect(toolNames({ memberAccess: true, ppiAccess: false })).toEqual([
			'add_bean_to_inventory',
			'bean_tasting_notes',
			'coffee_catalog_search',
			'create_roast_session',
			'find_similar_beans',
			'green_coffee_inventory',
			'present_results',
			'record_sale',
			'roast_profiles',
			'update_bean',
			'update_roast_notes'
		]);
	});

	it('limits Parchment Intelligence-only users to sourcing, catalog, and portfolio tools', () => {
		expect(toolNames({ memberAccess: false, ppiAccess: true })).toEqual([
			'add_bean_to_inventory',
			'coffee_catalog_search',
			'find_similar_beans',
			'green_coffee_inventory',
			'present_results',
			'update_bean'
		]);
	});

	it('does not expose roasting-only tools to Parchment Intelligence-only users', () => {
		const names = toolNames({ memberAccess: false, ppiAccess: true });

		expect(names).not.toContain('roast_profiles');
		expect(names).not.toContain('bean_tasting_notes');
		expect(names).not.toContain('create_roast_session');
		expect(names).not.toContain('update_roast_notes');
		expect(names).not.toContain('record_sale');
	});
});
