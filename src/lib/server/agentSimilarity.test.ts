import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParchmentClient } from '@purveyors/sdk';
import { findSimilarBeansForAgent } from './agentSimilarity';

const catalogSimilar = vi.fn();
const client = {
	catalog: { similar: catalogSimilar }
} as unknown as ParchmentClient;

function mockSimilarityResponse() {
	return {
		data: {
			data: {
				target: {
					id: 42,
					name: 'Hidden Gesha',
					source: 'Private Supplier',
					origin: 'Panama',
					country: 'Panama',
					processing: 'Washed'
				},
				groups: { canonical_candidates: [], similar_recommendations: [] },
				matches: [
					{
						coffee: {
							id: 77,
							name: 'Gesha Alternative',
							source: 'Supplier B',
							origin: 'Boquete',
							country: 'Panama',
							continent: 'North America',
							processing: 'Washed',
							processing_base_method: 'washed',
							fermentation_type: null,
							drying_method: null,
							stocked: true,
							arrival_date: null,
							stocked_date: null,
							proof: {}
						},
						pricing: {
							price_per_lb: 18,
							cost_lb: 18,
							baseline_quantity_lbs: 1,
							baseline_price_per_lb: 18,
							baseline_source: 'price_per_lb'
						},
						price_delta_1lb: { amount: 2, percent: 12.5, currency: 'USD' },
						score: {
							average: 0.91,
							dimensions: { origin: 0.93, processing: 0.9, tasting: 0.89 },
							chunk_matches: 3
						},
						match: {
							category: 'likely_same',
							classification: {
								kind: 'canonical_candidate',
								identity_eligibility: 'eligible',
								confidence: 'high_beta',
								blockers: [],
								evidence: []
							},
							confidence: 'high_beta',
							beta: true,
							language: 'High beta confidence.',
							same_supplier: false
						},
						explanation: { summary: 'Similar profile.', signals: [] },
						compatibility: { cost_lb: 18 }
					}
				]
			},
			meta: {
				query_strategy: 'bounded-vector-candidates-v1'
			}
		}
	};
}

describe('findSimilarBeansForAgent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		catalogSimilar.mockResolvedValue(mockSimilarityResponse());
	});

	it('uses the request-bound Parchment client and preserves the agent result shape', async () => {
		const result = await findSimilarBeansForAgent({ coffee_id: 42 }, client);

		expect(catalogSimilar).toHaveBeenCalledWith('42', {
			threshold: '0.72',
			limit: 8,
			stocked_only: 'true',
			mode: 'all'
		});
		expect(result).toMatchObject({
			target: {
				coffee_id: 42,
				coffee_name: 'Hidden Gesha',
				source: 'Private Supplier'
			},
			total: 1,
			query_strategy: 'bounded-vector-candidates-v1',
			matches: [
				{
					coffee_id: 77,
					price_per_lb_1lb_baseline: 18,
					price_delta_vs_target: 2,
					avg_similarity: 0.91,
					match_category: 'likely_same'
				}
			]
		});
	});

	it('clamps model-supplied threshold and limit to the supported contract range', async () => {
		await findSimilarBeansForAgent({ coffee_id: 42, threshold: 0.2, limit: 100 }, client);

		expect(catalogSimilar).toHaveBeenCalledWith(
			'42',
			expect.objectContaining({ threshold: '0.5', limit: 15 })
		);
	});

	it('surfaces the upstream error message', async () => {
		catalogSimilar.mockResolvedValue({
			error: { error: { message: 'Similar coffee matching requires member access' } }
		});

		await expect(findSimilarBeansForAgent({ coffee_id: 42 }, client)).rejects.toThrow(
			'Parchment catalog similarity query failed: Similar coffee matching requires member access'
		);
	});

	it('contains no direct Supabase similarity access in the retired chat reader', () => {
		const source = readFileSync(resolve('src/lib/server/agentSimilarity.ts'), 'utf8');

		expect(source).not.toContain('createAdminClient');
		expect(source).not.toMatch(/find_similar_beans_aggregated/);
		expect(source).not.toMatch(/\.rpc\(/);
	});
});
