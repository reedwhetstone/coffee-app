import { catalogSimilarityCalibrationExamples } from '../src/lib/server/__fixtures__/catalogSimilarityCalibration';
import {
	CATALOG_SIMILARITY_THRESHOLDS,
	deriveCalibrationBand
} from '../src/lib/server/catalogSimilarity';

const rows = catalogSimilarityCalibrationExamples.map((example) => ({
	...example,
	actualBand: deriveCalibrationBand(example),
	passed: deriveCalibrationBand(example) === example.expectedBand
}));

const autoLinkCandidates = rows.filter((row) => row.actualBand === 'auto_link_candidate');
const falsePositiveAutoLinks = autoLinkCandidates.filter((row) => row.truth !== 'same_bean');
const likelyOrBetter = rows.filter(
	(row) => row.actualBand === 'auto_link_candidate' || row.actualBand === 'likely_same'
);
const likelyFalsePositives = likelyOrBetter.filter((row) => row.truth === 'not_match');

const summary = {
	thresholds: CATALOG_SIMILARITY_THRESHOLDS,
	examples: rows.length,
	passingExpectations: rows.filter((row) => row.passed).length,
	autoLinkCandidates: autoLinkCandidates.length,
	falsePositiveAutoLinks: falsePositiveAutoLinks.length,
	likelyOrBetter: likelyOrBetter.length,
	likelyFalsePositives: likelyFalsePositives.length
};

if (process.argv.includes('--json')) {
	console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
	console.log('# Catalog similarity calibration fixture');
	console.log();
	console.log(`Examples: ${summary.examples}`);
	console.log(`Expectation pass count: ${summary.passingExpectations}/${summary.examples}`);
	console.log(`Auto-link candidates: ${summary.autoLinkCandidates}`);
	console.log(`False-positive auto-link candidates: ${summary.falsePositiveAutoLinks}`);
	console.log(`Likely-or-better non-match false positives: ${summary.likelyFalsePositives}`);
	console.log();
	for (const row of rows) {
		console.log(
			`- ${row.id}: ${row.actualBand} (${row.truth})${row.passed ? '' : ' EXPECTATION MISMATCH'}`
		);
	}
}

if (
	rows.some((row) => !row.passed) ||
	falsePositiveAutoLinks.length > 0 ||
	likelyFalsePositives.length > 0
) {
	process.exitCode = 1;
}
