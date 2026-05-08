import type {
	CatalogIdentityEligibility,
	CatalogMatchCalibrationBand,
	CatalogMatchKind,
	CatalogSimilarityScoreInput
} from '../catalogSimilarity';

export type CatalogSimilarityCalibrationTruth =
	| 'same_bean'
	| 'similar_profile'
	| 'not_match'
	| 'ambiguous';

type CalibrationComparable = {
	name: string;
	country: string | null;
	processing: string | null;
	processing_base_method: string | null;
	fermentation_type: string | null;
};

export interface CatalogSimilarityCalibrationExample extends CatalogSimilarityScoreInput {
	id: string;
	label: string;
	truth: CatalogSimilarityCalibrationTruth;
	target: CalibrationComparable;
	candidate: CalibrationComparable;
	expectedBand: CatalogMatchCalibrationBand;
	expectedKind: CatalogMatchKind;
	expectedIdentityEligibility: CatalogIdentityEligibility;
	notes: string;
}

const ethiopiaNaturalTarget = {
	name: 'Ethiopia Guji Natural',
	country: 'Ethiopia',
	processing: 'Natural',
	processing_base_method: 'natural',
	fermentation_type: null
} satisfies CalibrationComparable;

/**
 * Small golden-set floor for canonical coffee matching thresholds.
 *
 * The examples intentionally encode source-safe pair shapes rather than supplier names so the
 * harness is reproducible in unit tests and does not depend on live catalog data. Replace or
 * extend these with reviewed live pairs as the identity program matures.
 */
export const catalogSimilarityCalibrationExamples = [
	{
		id: 'guji-natural-same-lot-shape',
		label: 'High agreement across origin, process, and tasting signals',
		truth: 'same_bean',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Ethiopia Guji Natural Lot B',
			country: 'Ethiopia',
			processing: 'Natural',
			processing_base_method: 'natural',
			fermentation_type: null
		},
		expectedBand: 'auto_link_candidate',
		expectedKind: 'canonical_candidate',
		expectedIdentityEligibility: 'eligible',
		average: 0.962,
		origin: 0.941,
		processing: 0.934,
		chunkMatches: 4,
		notes:
			'Safe only as an auto-link candidate; accepted identities still need reversible audit events.'
	},
	{
		id: 'sidama-natural-likely-same',
		label: 'Likely same coffee but not enough evidence for automatic linking',
		truth: 'same_bean',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Ethiopia Sidama Natural Lot B',
			country: 'Ethiopia',
			processing: 'Natural',
			processing_base_method: 'natural',
			fermentation_type: null
		},
		expectedBand: 'likely_same',
		expectedKind: 'canonical_candidate',
		expectedIdentityEligibility: 'eligible',
		average: 0.908,
		origin: 0.891,
		processing: 0.886,
		chunkMatches: 2,
		notes: 'Strong buyer lead, but the high-confidence auto-link band should stay stricter.'
	},
	{
		id: 'ethiopia-natural-substitute',
		label: 'Same country and process family with moderate score',
		truth: 'similar_profile',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Ethiopia Yirgacheffe Natural',
			country: 'Ethiopia',
			processing: 'Natural',
			processing_base_method: 'natural',
			fermentation_type: null
		},
		expectedBand: 'similar_profile',
		expectedKind: 'similar_recommendation',
		expectedIdentityEligibility: 'insufficient_evidence',
		average: 0.812,
		origin: 0.781,
		processing: 0.872,
		chunkMatches: 2,
		notes: 'Useful substitute research, not an identity claim.'
	},
	{
		id: 'origin-high-process-conflict',
		label: 'High average score with process conflict',
		truth: 'ambiguous',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Ethiopia Guji Washed',
			country: 'Ethiopia',
			processing: 'Washed',
			processing_base_method: 'washed',
			fermentation_type: null
		},
		expectedBand: 'similar_profile',
		expectedKind: 'similar_recommendation',
		expectedIdentityEligibility: 'blocked',
		average: 0.901,
		origin: 0.926,
		processing: 0.731,
		chunkMatches: 3,
		notes: 'Process disagreement blocks likely-same classification despite the average score.'
	},
	{
		id: 'process-high-origin-conflict',
		label: 'High process score with origin conflict',
		truth: 'ambiguous',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Colombia Huila Natural',
			country: 'Colombia',
			processing: 'Natural',
			processing_base_method: 'natural',
			fermentation_type: null
		},
		expectedBand: 'similar_profile',
		expectedKind: 'similar_recommendation',
		expectedIdentityEligibility: 'blocked',
		average: 0.895,
		origin: 0.702,
		processing: 0.923,
		chunkMatches: 3,
		notes: 'Origin disagreement blocks likely-same classification.'
	},
	{
		id: 'single-chunk-overfit',
		label: 'High average score from only one chunk',
		truth: 'ambiguous',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Ethiopia Guji Natural Single Chunk Neighbor',
			country: 'Ethiopia',
			processing: 'Natural',
			processing_base_method: 'natural',
			fermentation_type: null
		},
		expectedBand: 'similar_profile',
		expectedKind: 'similar_recommendation',
		expectedIdentityEligibility: 'insufficient_evidence',
		average: 0.934,
		origin: null,
		processing: null,
		chunkMatches: 1,
		notes: 'Single-chunk matches should not become identity candidates.'
	},
	{
		id: 'washed-vs-natural-non-match',
		label: 'Natural versus washed false-positive guard',
		truth: 'not_match',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Ethiopia Guji Washed',
			country: 'Ethiopia',
			processing: 'Washed',
			processing_base_method: 'washed',
			fermentation_type: null
		},
		expectedBand: 'below_threshold',
		expectedKind: 'similar_recommendation',
		expectedIdentityEligibility: 'blocked',
		average: 0.612,
		origin: 0.701,
		processing: 0.422,
		chunkMatches: 2,
		notes: 'Below the route default and should not appear as a suggested identity match.'
	},
	{
		id: 'different-country-non-match',
		label: 'Different country profile with low score',
		truth: 'not_match',
		target: ethiopiaNaturalTarget,
		candidate: {
			name: 'Colombia Huila Washed',
			country: 'Colombia',
			processing: 'Washed',
			processing_base_method: 'washed',
			fermentation_type: null
		},
		expectedBand: 'below_threshold',
		expectedKind: 'similar_recommendation',
		expectedIdentityEligibility: 'blocked',
		average: 0.548,
		origin: 0.391,
		processing: 0.642,
		chunkMatches: 2,
		notes: 'Protects against broad flavor-neighbor false positives.'
	}
] satisfies CatalogSimilarityCalibrationExample[];
