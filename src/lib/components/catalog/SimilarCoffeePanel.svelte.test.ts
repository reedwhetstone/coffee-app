import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import SimilarCoffeePanel from './SimilarCoffeePanel.svelte';
import type { CoffeeCatalog } from '$lib/types/component.types';
import { createCatalogProofSummary } from '$lib/catalog/proofSummary';

function createCoffee(overrides: Record<string, unknown> = {}): CoffeeCatalog {
	return {
		id: 1,
		name: 'Target Gesha',
		source: 'Target Importer',
		country: 'Panama',
		region: 'Boquete',
		continent: 'Central America',
		processing: 'Washed',
		ai_description: null,
		ai_tasting_notes: null,
		price_tiers: [{ min_lbs: 1, price: 22 }],
		price_per_lb: 22,
		cost_lb: 99,
		wholesale: false,
		link: null,
		cultivar_detail: null,
		grade: null,
		appearance: null,
		type: null,
		arrival_date: null,
		stocked_date: null,
		stocked: true,
		...overrides
	} as unknown as CoffeeCatalog;
}

function proof(overrides: Record<string, unknown> = {}) {
	return createCatalogProofSummary({
		country: 'Panama',
		region: 'Boquete',
		source: 'Target Importer',
		stocked: true,
		stocked_date: '2026-04-01',
		price_per_lb: 22,
		price_tiers: [
			{ min_lbs: 1, price: 22 },
			{ min_lbs: 10, price: 20 }
		],
		wholesale: false,
		processing_base_method: 'washed',
		drying_method: 'raised_bed',
		processing_disclosure_level: 'high_detail',
		processing_confidence: 0.86,
		processing_evidence_available: true,
		...overrides
	});
}

function similarityResponse(overrides: { matches?: unknown[] } = {}) {
	return {
		data: {
			target: {
				id: 1,
				name: 'Target Gesha',
				source: 'Target Importer',
				origin: 'Boquete',
				country: 'Panama',
				continent: 'Central America',
				processing: 'Washed',
				processing_base_method: 'washed',
				fermentation_type: null,
				drying_method: 'raised_bed',
				stocked: true,
				arrival_date: '2026-03-15',
				stocked_date: '2026-04-01',
				proof: proof(),
				price_per_lb: 22,
				price_tiers: [
					{ min_lbs: 1, price: 22 },
					{ min_lbs: 10, price: 20 }
				],
				cost_lb: 99,
				pricing: {
					price_per_lb: 22,
					price_tiers: [
						{ min_lbs: 1, price: 22 },
						{ min_lbs: 10, price: 20 }
					],
					cost_lb: 99,
					baseline_quantity_lbs: 1,
					baseline_price_per_lb: 22,
					baseline_source: 'price_per_lb'
				}
			},
			matches: overrides.matches ?? [
				{
					coffee: {
						id: 2,
						name: 'Comparable Gesha',
						source: 'Similar Supplier',
						origin: 'Boquete',
						country: 'Panama',
						continent: 'Central America',
						processing: 'Washed',
						processing_base_method: 'washed',
						fermentation_type: null,
						drying_method: 'raised_bed',
						stocked: true,
						arrival_date: '2026-03-20',
						stocked_date: '2026-04-02',
						proof: proof({
							source: 'Similar Supplier',
							stocked_date: '2026-04-02',
							price_per_lb: 20,
							price_tiers: [
								{ min_lbs: 1, price: 20 },
								{ min_lbs: 5, price: 18 }
							]
						})
					},
					pricing: {
						price_per_lb: 20,
						price_tiers: [
							{ min_lbs: 1, price: 20 },
							{ min_lbs: 5, price: 18 }
						],
						cost_lb: 88,
						baseline_quantity_lbs: 1,
						baseline_price_per_lb: 20,
						baseline_source: 'price_per_lb'
					},
					price_delta_1lb: { amount: -2, percent: -9.1, currency: 'USD' },
					score: {
						average: 0.91,
						dimensions: { origin: 0.94, processing: 0.9, tasting: 0.88 },
						chunk_matches: 3
					},
					match: {
						category: 'likely_same',
						classification: {
							kind: 'canonical_candidate',
							identity_eligibility: 'eligible',
							confidence: 'high_beta',
							blockers: [],
							evidence: ['Processing base method matches: washed']
						},
						confidence: 'high_beta',
						beta: true,
						language: 'High beta confidence likely same coffee candidate.'
					},
					explanation: {
						summary: 'Beta similarity score based on available embeddings.',
						signals: ['Origin similarity 0.94', 'Processing similarity 0.9']
					}
				}
			]
		},
		meta: {
			copy: {
				confidence: 'Matches are beta confidence candidates.'
			}
		}
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe('SimilarCoffeePanel', () => {
	it('fetches on demand and renders member match comparison details with canonical pricing', async () => {
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify(similarityResponse()), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchMock);

		render(SimilarCoffeePanel, { coffee: createCoffee() });

		expect(screen.getByText('Loading beta similarity matches...')).toBeInTheDocument();

		await waitFor(() => expect(screen.getByText('Comparable Gesha')).toBeInTheDocument());
		expect(fetchMock).toHaveBeenCalledWith('/v1/catalog/1/similar?limit=8&stocked_only=true', {
			headers: { Accept: 'application/json' }
		});
		expect(screen.getByText('Similar Supplier · In stock')).toBeInTheDocument();
		expect(
			screen.getByText('Stocked: 2026-04-02 · date signal, not a quality claim')
		).toBeInTheDocument();
		expect(screen.getAllByText('Process disclosed')[0]).toBeInTheDocument();
		expect(screen.getAllByText('Freshness dated')[0]).toBeInTheDocument();
		expect(screen.getAllByText('$20.00/lb')[0]).toBeInTheDocument();
		expect(screen.getByText('$2.00/lb lower (9.1%)')).toBeInTheDocument();
		expect(screen.getByText('High beta confidence')).toBeInTheDocument();
		expect(screen.getByText('Likely same coffee candidate')).toBeInTheDocument();
		expect(screen.getByText('Origin:')).toBeInTheDocument();
		expect(screen.getByText('94%')).toBeInTheDocument();
		expect(screen.getByText('2 tiers from 1+ lb $20.00/lb to 5+ lb $18.00/lb')).toBeInTheDocument();
	});

	it('renders similar recommendation identity blockers without calling it same coffee', async () => {
		const blockedMatch = {
			...(similarityResponse().data.matches[0] as Record<string, unknown>),
			match: {
				category: 'similar_profile',
				classification: {
					kind: 'similar_recommendation',
					identity_eligibility: 'blocked',
					confidence: 'high_beta',
					blockers: [
						{
							code: 'processing_base_method_conflict',
							severity: 'hard',
							target_value: 'washed',
							candidate_value: 'natural'
						}
					],
					evidence: []
				},
				confidence: 'high_beta',
				beta: true,
				language: 'Similar profile, not a same-coffee claim.'
			}
		};
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(similarityResponse({ matches: [blockedMatch] })), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
			)
		);

		render(SimilarCoffeePanel, { coffee: createCoffee() });

		await waitFor(() => expect(screen.getByText('Similar recommendation')).toBeInTheDocument());
		expect(screen.getByText('Processing method differs: washed vs natural')).toBeInTheDocument();
		expect(screen.queryByText('Likely same coffee candidate')).not.toBeInTheDocument();
	});

	it('renders an empty state when no beta matches clear the threshold', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(similarityResponse({ matches: [] })), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
			)
		);

		render(SimilarCoffeePanel, { coffee: createCoffee() });

		await waitFor(() => expect(screen.getByText('No beta matches found')).toBeInTheDocument());
		expect(screen.queryByText('Comparable Gesha')).not.toBeInTheDocument();
	});

	it('renders entitlement teaser errors without match details', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							message: 'Similar coffee matching is available to members and paid API tiers.',
							teaser: { locked: true, similar_match_count: 4, beta: true }
						}),
						{ status: 403, headers: { 'Content-Type': 'application/json' } }
					)
			)
		);

		render(SimilarCoffeePanel, { coffee: createCoffee() });

		await waitFor(() => expect(screen.getByText('Comparison unavailable')).toBeInTheDocument());
		expect(screen.getByText('4 beta matches may be available after upgrade.')).toBeInTheDocument();
		expect(screen.queryByText('Comparable Gesha')).not.toBeInTheDocument();
	});
});
