import { catalogSimilarityCalibrationExamples } from '../src/lib/server/__fixtures__/catalogSimilarityCalibration';
import type {
	CatalogMatchCalibrationBand,
	CatalogMatchKind
} from '../src/lib/server/catalogSimilarity';
import {
	CATALOG_SIMILARITY_THRESHOLDS,
	classifyCatalogMatch,
	deriveCalibrationBand
} from '../src/lib/server/catalogSimilarity';

const rows = catalogSimilarityCalibrationExamples.map((example) => {
	const actualBand = deriveCalibrationBand(example);
	const classification = classifyCatalogMatch({
		target: example.target,
		candidate: example.candidate,
		score: example
	});

	return {
		...example,
		actualBand,
		actualKind: classification.kind,
		actualIdentityEligibility: classification.identity_eligibility,
		blockerCodes: classification.blockers.map((blocker) => blocker.code),
		passed:
			actualBand === example.expectedBand &&
			classification.kind === example.expectedKind &&
			classification.identity_eligibility === example.expectedIdentityEligibility
	};
});

type EvaluatedRow = (typeof rows)[number];
type CalibrationMetric = {
	target: string;
	truePositives: number;
	falsePositives: number;
	falseNegatives: number;
	precision: number | null;
	recall: number | null;
	support: number;
};

function roundMetric(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function divideOrNull(numerator: number, denominator: number): number | null {
	return denominator === 0 ? null : roundMetric(numerator / denominator);
}

function calculateMetric(input: {
	target: string;
	isPositiveTruth: (row: EvaluatedRow) => boolean;
	isPositivePrediction: (row: EvaluatedRow) => boolean;
}): CalibrationMetric {
	const truePositives = rows.filter(
		(row) => input.isPositiveTruth(row) && input.isPositivePrediction(row)
	).length;
	const falsePositives = rows.filter(
		(row) => !input.isPositiveTruth(row) && input.isPositivePrediction(row)
	).length;
	const falseNegatives = rows.filter(
		(row) => input.isPositiveTruth(row) && !input.isPositivePrediction(row)
	).length;
	const support = rows.filter(input.isPositiveTruth).length;

	return {
		target: input.target,
		truePositives,
		falsePositives,
		falseNegatives,
		precision: divideOrNull(truePositives, truePositives + falsePositives),
		recall: divideOrNull(truePositives, truePositives + falseNegatives),
		support
	};
}

const bandCounts = rows.reduce(
	(counts, row) => {
		counts[row.actualBand] += 1;
		return counts;
	},
	{
		auto_link_candidate: 0,
		likely_same: 0,
		similar_profile: 0,
		below_threshold: 0
	} satisfies Record<CatalogMatchCalibrationBand, number>
);
const classifierKindCounts = rows.reduce(
	(counts, row) => {
		counts[row.actualKind] += 1;
		return counts;
	},
	{
		canonical_candidate: 0,
		similar_recommendation: 0
	} satisfies Record<CatalogMatchKind, number>
);
const autoLinkMetric = calculateMetric({
	target: 'same_bean => auto_link_candidate score band',
	isPositiveTruth: (row) => row.truth === 'same_bean',
	isPositivePrediction: (row) => row.actualBand === 'auto_link_candidate'
});
const likelyOrBetterMetric = calculateMetric({
	target: 'same_bean => likely_same_or_better score band',
	isPositiveTruth: (row) => row.truth === 'same_bean',
	isPositivePrediction: (row) =>
		row.actualBand === 'auto_link_candidate' || row.actualBand === 'likely_same'
});
const canonicalCandidateMetric = calculateMetric({
	target: 'same_bean => hard-gated canonical_candidate',
	isPositiveTruth: (row) => row.truth === 'same_bean',
	isPositivePrediction: (row) => row.actualKind === 'canonical_candidate'
});
const clearNonMatchMetric = calculateMetric({
	target: 'not_match => below_threshold score band',
	isPositiveTruth: (row) => row.truth === 'not_match',
	isPositivePrediction: (row) => row.actualBand === 'below_threshold'
});

const summary = {
	thresholds: CATALOG_SIMILARITY_THRESHOLDS,
	examples: rows.length,
	passingExpectations: rows.filter((row) => row.passed).length,
	bandCounts,
	classifierKindCounts,
	metrics: {
		autoLink: autoLinkMetric,
		likelyOrBetter: likelyOrBetterMetric,
		canonicalCandidate: canonicalCandidateMetric,
		clearNonMatchRejection: clearNonMatchMetric
	}
};

if (process.argv.includes('--json')) {
	console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
	console.log('# Catalog similarity calibration fixture');
	console.log();
	console.log(`Examples: ${summary.examples}`);
	console.log(`Expectation pass count: ${summary.passingExpectations}/${summary.examples}`);
	console.log('Band counts:');
	for (const [band, count] of Object.entries(summary.bandCounts)) {
		console.log(`- ${band}: ${count}`);
	}
	console.log('Classifier kind counts:');
	for (const [kind, count] of Object.entries(summary.classifierKindCounts)) {
		console.log(`- ${kind}: ${count}`);
	}
	console.log('Metrics:');
	for (const metric of Object.values(summary.metrics)) {
		console.log(
			`- ${metric.target}: precision=${metric.precision ?? 'n/a'}, recall=${metric.recall ?? 'n/a'}, ` +
				`tp=${metric.truePositives}, fp=${metric.falsePositives}, fn=${metric.falseNegatives}, support=${metric.support}`
		);
	}
	console.log();
	for (const row of rows) {
		console.log(
			`- ${row.id}: band=${row.actualBand}, classifier=${row.actualKind}/${row.actualIdentityEligibility} ` +
				`(${row.truth})${row.passed ? '' : ' EXPECTATION MISMATCH'}`
		);
	}
}

if (
	rows.some((row) => !row.passed) ||
	autoLinkMetric.falsePositives > 0 ||
	likelyOrBetterMetric.falsePositives > 0 ||
	canonicalCandidateMetric.falsePositives > 0 ||
	clearNonMatchMetric.falseNegatives > 0
) {
	process.exitCode = 1;
}
