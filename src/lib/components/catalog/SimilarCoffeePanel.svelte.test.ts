import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { components } from '@purveyors/sdk';
import SimilarCoffeePanel from './SimilarCoffeePanel.svelte';
import type { CoffeeCatalog } from '$lib/types/component.types';
import { createCatalogProofSummary, type CatalogProofInput } from '$lib/catalog/proofSummary';

function createCoffee(overrides: Partial<CoffeeCatalog> = {}): CoffeeCatalog {
	return {
		id: 1,
		name: 'Target Gesha',
		source: 'Target Importer',
		country: 'Panama',
		region: 'Boquete',
		continent: 'Central America',
		processing: 'Washed',
		decaffeinated: false,
		decafMethod: null,
		ai_description: null,
		ai_tasting_notes: null,
		price_tiers: [{ min_lbs: 1, price: 22 }],
		price_per_lb: 22,
		cost_lb: 99,
		wholesale: false,
		public_coffee: true,
		process_additives: null,
		link: null,
		cultivar_detail: null,
		grade: null,
		appearance: null,
		type: null,
		arrival_date: null,
		stocked_date: null,
		stocked: true,
		...overrides
	};
}

function proof(
	overrides: Partial<CatalogProofInput> = {}
): components['schemas']['CatalogProofSummary'] {
	const summary = createCatalogProofSummary({
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
	const process = summary.families.process;
	return {
		version: summary.version,
		overall: summary.overall,
		families: {
			process: {
				...process,
				label:
					process.label === 'disclosed'
						? 'disclosed'
						: process.signals.length > 0
							? 'partial'
							: 'not_available'
			},
			provenance: {
				...summary.families.provenance,
				label:
					summary.families.provenance.label === 'identified'
						? 'identified'
						: summary.families.provenance.label === 'partial'
							? 'partial'
							: 'not_available'
			},
			freshness: {
				...summary.families.freshness,
				label: summary.families.freshness.label === 'not_available' ? 'not_available' : 'dated'
			},
			pricing: {
				...summary.families.pricing,
				label:
					summary.families.pricing.label === 'tiered'
						? 'tiered'
						: summary.families.pricing.label === 'listed'
							? 'listed'
							: 'not_available'
			}
		},
		limitations: summary.limitations
	};
}

type SimilarityResponse = components['schemas']['CatalogSimilarityResponse'];
type SimilarityMatch = SimilarityResponse['data']['matches'][number];

function similarityResponse(overrides: { matches?: SimilarityMatch[] } = {}): SimilarityResponse {
	const matches = overrides.matches ?? [
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
				decaffeinated: true,
				decafMethod: { code: 'mountain_water', label: 'Mountain Water' },
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
				language: 'High beta confidence likely same coffee candidate.',
				same_supplier: false
			},
			explanation: {
				summary: 'Beta similarity score based on available embeddings.',
				signals: ['Origin similarity 0.94', 'Processing similarity 0.9']
			},
			compatibility: { cost_lb: 88 }
		}
	];
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
				decaffeinated: true,
				decafMethod: { code: 'swiss_water', label: 'Swiss Water' },
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
			matches,
			groups: {
				canonical_candidates: matches.filter((match) => match.match.category === 'likely_same'),
				similar_recommendations: matches.filter(
					(match) => match.match.category === 'similar_profile'
				)
			}
		},
		meta: {
			resource: 'catalog-similarity',
			namespace: '/v1/catalog/{id}/similar',
			version: 'v1',
			status: 'beta',
			auth: { kind: 'session', role: 'member', apiPlan: null },
			access: { requiredCapability: 'canUseBeanMatching', canUseBeanMatching: true },
			query: { threshold: 0.7, limit: 8, stockedOnly: true, mode: 'all' },
			copy: {
				confidence: 'Matches are beta confidence candidates.'
			},
			classification_version: 'canonical-match-v1',
			query_strategy: 'bounded-vector-candidates-v1'
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
		expect(fetchMock).toHaveBeenCalledWith('/api/catalog/1/similar?limit=8&stocked_only=true', {
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
		expect(screen.getByLabelText('Decaf · Swiss Water')).toBeInTheDocument();
		expect(screen.getByLabelText('Decaf · Mountain Water')).toBeInTheDocument();
		expect(screen.getByText('Likely same coffee candidate')).toBeInTheDocument();
		expect(screen.getByText('Origin:')).toBeInTheDocument();
		expect(screen.getByText('94%')).toBeInTheDocument();
		expect(screen.getByText('2 tiers from 1+ lb $20.00/lb to 5+ lb $18.00/lb')).toBeInTheDocument();
	});

	it('does not display a stale legacy decaf label over an explicit false flag', async () => {
		const payload = similarityResponse();
		const firstMatch = payload.data.matches[0];
		if (!firstMatch) throw new Error('Expected a generated similarity fixture match');
		payload.data.target.decaffeinated = false;
		payload.data.target.decafMethod = null;
		payload.data.target.processing = 'Swiss Water Decaf';
		firstMatch.coffee.decaffeinated = false;
		firstMatch.coffee.decafMethod = null;
		firstMatch.coffee.processing = 'Mountain Water Decaf';
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify(payload), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
			)
		);

		render(SimilarCoffeePanel, { coffee: createCoffee() });

		await screen.findByText('Comparable Gesha');
		expect(screen.queryByLabelText('Decaf · Swiss Water')).not.toBeInTheDocument();
		expect(screen.queryByLabelText('Decaf · Mountain Water')).not.toBeInTheDocument();
	});

	it('renders similar recommendation identity blockers without calling it same coffee', async () => {
		const firstMatch = similarityResponse().data.matches[0];
		if (!firstMatch) throw new Error('Expected a generated similarity fixture match');
		const blockedMatch: SimilarityMatch = {
			...firstMatch,
			match: {
				...firstMatch.match,
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
							message: 'Similar coffee matching is available to members and customer API keys.',
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
