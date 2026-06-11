import { beforeEach, describe, expect, it, vi } from 'vitest';

const similarityMocks = vi.hoisted(() => ({
	fetchCatalogSimilarityMatches: vi.fn()
}));

vi.mock('$lib/server/catalogSimilarity', () => ({
	DEFAULT_CATALOG_SIMILARITY_LIMIT: 8,
	DEFAULT_CATALOG_SIMILARITY_THRESHOLD: 0.72,
	MAX_CATALOG_SIMILARITY_LIMIT: 15,
	MAX_CATALOG_SIMILARITY_THRESHOLD: 0.95,
	MIN_CATALOG_SIMILARITY_THRESHOLD: 0.5,
	fetchCatalogSimilarityMatches: similarityMocks.fetchCatalogSimilarityMatches
}));

vi.mock('$lib/supabase-admin', () => ({
	createAdminClient: vi.fn(() => ({ admin: true }))
}));

import { findSimilarBeansForAgent } from './agentSimilarity';

function mockSimilarityResult() {
	return {
		target: {
			id: 42,
			name: 'Hidden Gesha',
			source: 'Private Supplier',
			origin: 'Panama',
			country: 'Panama',
			processing: 'Washed'
		},
		matches: [],
		queryStrategy: 'bounded-v3'
	};
}

describe('findSimilarBeansForAgent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('defaults admin-backed similarity reads to public catalog visibility', async () => {
		const client = { rpc: vi.fn() };
		similarityMocks.fetchCatalogSimilarityMatches.mockResolvedValue(mockSimilarityResult());

		await findSimilarBeansForAgent({ coffee_id: 42 }, { client: client as never });

		expect(similarityMocks.fetchCatalogSimilarityMatches).toHaveBeenCalledWith(
			expect.objectContaining({
				supabase: client,
				coffeeId: 42,
				publicOnly: true
			})
		);
	});

	it('can explicitly allow full-catalog similarity reads for privileged callers', async () => {
		const client = { rpc: vi.fn() };
		similarityMocks.fetchCatalogSimilarityMatches.mockResolvedValue(mockSimilarityResult());

		await findSimilarBeansForAgent(
			{ coffee_id: 42 },
			{ client: client as never, publicOnly: false }
		);

		expect(similarityMocks.fetchCatalogSimilarityMatches).toHaveBeenCalledWith(
			expect.objectContaining({
				supabase: client,
				coffeeId: 42,
				publicOnly: false
			})
		);
	});
});
