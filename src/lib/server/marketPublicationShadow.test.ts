import { describe, expect, it } from 'vitest';
import {
	buildShadowReport,
	compareDay,
	quantile,
	SHADOW_ACCEPTANCE_POLICIES,
	type LegacySegmentRow,
	type PublicationRow,
	type PublicationSegmentRow,
	type ShadowAcceptancePolicy
} from './marketPublicationShadow';

const cohort = { key: 'production', version: 1, id: 'cohort-1' };

function publication(date: string, overrides: Partial<PublicationRow> = {}): PublicationRow {
	return {
		id: `publication-${date}`,
		as_of_date: date,
		cohort_id: cohort.id,
		policy_version: 'coverage-v1',
		methodology_version: 'supplier-first-matched-relative-v1',
		quality_tier: 'healthy',
		supplier_coverage_ratio: 0.8,
		item_coverage_ratio: 0.7,
		stale_share: 0.2,
		oldest_observed_at: `${date}T00:00:00Z`,
		max_observation_age: '1 day 12:00:00',
		...overrides
	};
}

function segment(
	publicationId: string,
	overrides: Partial<PublicationSegmentRow> = {}
): PublicationSegmentRow {
	return {
		publication_id: publicationId,
		origin: 'Colombia',
		process: null,
		grade: null,
		wholesale_only: false,
		supplier_count: 4,
		price_median: 10,
		...overrides
	};
}

function legacy(date: string, overrides: Partial<LegacySegmentRow> = {}): LegacySegmentRow {
	return {
		snapshot_date: date,
		origin: 'Colombia',
		process: null,
		grade: null,
		wholesale_only: false,
		supplier_count: 4,
		price_median: 10,
		...overrides
	};
}

function dates(count: number, start = '2026-07-01'): string[] {
	const base = new Date(`${start}T00:00:00Z`).getTime();
	return Array.from({ length: count }, (_, index) =>
		new Date(base + index * 86_400_000).toISOString().slice(0, 10)
	);
}

function reportFor(
	dayList: string[],
	overrides: {
		publications?: PublicationRow[];
		publicationSegments?: PublicationSegmentRow[];
		legacySegments?: LegacySegmentRow[];
		policy?: ShadowAcceptancePolicy;
		observedCohortVersions?: number[];
	} = {}
) {
	const publications = overrides.publications ?? dayList.map((date) => publication(date));
	return buildShadowReport({
		startDate: dayList[0],
		endDate: dayList.at(-1)!,
		cohort,
		publications,
		publicationSegments:
			overrides.publicationSegments ?? publications.map((row) => segment(row.id)),
		legacySegments: overrides.legacySegments ?? dayList.map((date) => legacy(date)),
		policy: overrides.policy,
		observedCohortVersions: overrides.observedCohortVersions,
		generatedAt: '2026-07-13T00:00:00Z'
	});
}

describe('market publication shadow comparison', () => {
	it('computes interpolated quantiles without mutating input', () => {
		const values = [4, 1, 3, 2];
		expect(quantile(values, 0.5)).toBe(2.5);
		expect(values).toEqual([4, 1, 3, 2]);
	});

	it('reports missing publication and legacy days as non-comparable', () => {
		const dayList = dates(3);
		const report = reportFor(dayList, {
			publications: [publication(dayList[0]), publication(dayList[2])],
			legacySegments: [legacy(dayList[0]), legacy(dayList[1])]
		});

		expect(report.summary.missingPublicationDates).toEqual([dayList[1]]);
		expect(report.summary.missingLegacyDates).toEqual([dayList[2]]);
		expect(report.summary.comparableDays).toBe(1);
		expect(report.verdict.accepted).toBe(false);
	});

	it('handles equal zero medians and rejects mismatched zero baselines without infinity', () => {
		const date = '2026-07-01';
		const equal = compareDay(
			date,
			publication(date),
			[segment(`publication-${date}`, { price_median: 0 })],
			[legacy(date, { price_median: 0 })],
			cohort.key,
			cohort.version
		);
		expect(equal.day.priceMedianAbsPctDelta).toMatchObject({ median: 0, max: 0 });

		const mismatch = compareDay(
			date,
			publication(date),
			[segment(`publication-${date}`, { price_median: 1 })],
			[legacy(date, { price_median: 0 })],
			cohort.key,
			cohort.version
		);
		expect(mismatch.day.priceMedianAbsPctDelta).toMatchObject({
			count: 0,
			median: null,
			zeroLegacyMedianMismatches: 1
		});
		expect(mismatch.day.comparable).toBe(false);
	});

	it('reports segment entrants and departures symmetrically', () => {
		const date = '2026-07-01';
		const result = compareDay(
			date,
			publication(date),
			[segment(`publication-${date}`), segment(`publication-${date}`, { origin: 'Kenya' })],
			[legacy(date), legacy(date, { origin: 'Ethiopia' })],
			cohort.key,
			cohort.version
		).day;

		expect(result.exactSegmentOverlap).toBe(1);
		expect(result.exactSegmentOverlapRatio).toBeCloseTo(1 / 3);
		expect(result.missingFromLegacy).toHaveLength(1);
		expect(result.missingFromPublication).toHaveLength(1);
		expect(result.maxObservationAgeDays).toBe(1.5);
	});

	it('fails a comparable day when matching segments silently lose median values', () => {
		const date = '2026-07-01';
		const report = reportFor([date], {
			publicationSegments: [
				segment(`publication-${date}`),
				segment(`publication-${date}`, { origin: 'Kenya', price_median: null })
			],
			legacySegments: [legacy(date), legacy(date, { origin: 'Kenya' })],
			policy: {
				...SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'],
				version: 'test-missing-median',
				minComparableDays: 1
			}
		});

		expect(report.days[0].priceMedianAbsPctDelta.missingMedianPairs).toBe(1);
		expect(
			report.verdict.reasons.some((reason) =>
				reason.startsWith('2026-07-01 missing_price_median_pairs 1 > 0:')
			)
		).toBe(true);
	});

	it('rejects duplicate segment identities instead of silently overwriting either side', () => {
		const date = '2026-07-01';
		const report = reportFor([date], {
			publicationSegments: [segment(`publication-${date}`), segment(`publication-${date}`)],
			legacySegments: [legacy(date), legacy(date)],
			policy: {
				...SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'],
				version: 'test-duplicates',
				minComparableDays: 1
			}
		});

		expect(report.days[0].duplicatePublicationSegments).toHaveLength(1);
		expect(report.days[0].duplicateLegacySegments).toHaveLength(1);
		expect(report.verdict.reasons.some((reason) => reason.includes('duplicate publication'))).toBe(
			true
		);
		expect(report.verdict.reasons.some((reason) => reason.includes('duplicate legacy'))).toBe(true);
	});

	it('rejects synthetic legacy rows defensively even though the loader filters them', () => {
		const date = '2026-07-01';
		const report = reportFor([date], {
			legacySegments: [legacy(date, { synthetic: true })],
			policy: {
				...SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'],
				version: 'test-synthetic',
				minComparableDays: 1
			}
		});

		expect(report.days[0].syntheticLegacySegments).toHaveLength(1);
		expect(
			report.verdict.reasons.some((reason) =>
				reason.includes('synthetic legacy segments entered comparison')
			)
		).toBe(true);
	});

	it('does not pool incompatible policy or methodology versions', () => {
		const dayList = dates(7);
		const publications = dayList.map((date, index) =>
			publication(date, index === 6 ? { policy_version: 'coverage-v2' } : {})
		);
		const report = reportFor(dayList, { publications });

		expect(report.summary.compatibilityGroups).toHaveLength(2);
		expect(report.summary.pooledCompatibleWindow).toBe(false);
		expect(report.summary.priceMedianAbsPctDelta).toBeNull();
		expect(report.verdict.reasons).toContain(
			'incompatible_versions 2 (cohort/methodology/policy days are not pooled)'
		);
	});

	it('detects a cohort-version transition without pooling the selected version window', () => {
		const dayList = dates(7);
		const report = reportFor(dayList, { observedCohortVersions: [1, 2] });

		expect(report.summary.observedCohortVersions).toEqual([1, 2]);
		expect(report.summary.pooledCompatibleWindow).toBe(false);
		expect(report.summary.priceMedianAbsPctDelta).toBeNull();
		expect(report.verdict.reasons).toContain('incompatible_cohort_versions 1,2');
	});

	it('enforces bounded degraded days and coverage-v1 degraded stale limits', () => {
		const dayList = dates(7);
		const publications = dayList.map((date, index) =>
			publication(
				date,
				index > 4
					? {
							quality_tier: 'degraded',
							supplier_coverage_ratio: 0.6,
							item_coverage_ratio: 0.5,
							stale_share: 0.4
						}
					: {}
			)
		);
		const report = reportFor(dayList, { publications });

		expect(report.verdict.accepted).toBe(false);
		expect(report.verdict.reasons).toContain('degraded_days 2 > 1');
	});

	it('rejects an unusable active day even after seven good comparable days', () => {
		const dayList = dates(8);
		const publications = dayList.map((date) => publication(date));
		const report = reportFor(dayList, {
			publications,
			publicationSegments: publications.map((row, index) =>
				segment(row.id, index === 7 ? { price_median: null } : {})
			)
		});

		expect(report.summary.comparableDays).toBe(7);
		expect(report.verdict.accepted).toBe(false);
		expect(report.verdict.reasons).toContain(`${dayList[7]} has no usable matched median pairs`);
		expect(
			report.verdict.reasons.some((reason) =>
				reason.startsWith(`${dayList[7]} missing_price_median_pairs 1 > 0:`)
			)
		).toBe(true);
	});

	it('rejects an active day whose only matched pair has a zero legacy baseline mismatch', () => {
		const dayList = dates(8);
		const publications = dayList.map((date) => publication(date));
		const report = reportFor(dayList, {
			publications,
			publicationSegments: publications.map((row, index) =>
				segment(row.id, index === 7 ? { price_median: 1 } : {})
			),
			legacySegments: dayList.map((date, index) =>
				legacy(date, index === 7 ? { price_median: 0 } : {})
			)
		});

		expect(report.summary.comparableDays).toBe(7);
		expect(report.verdict.reasons).toContain(`${dayList[7]} has no usable matched median pairs`);
		expect(
			report.verdict.reasons.some((reason) =>
				reason.startsWith(`${dayList[7]} has non-comparable zero legacy medians:`)
			)
		).toBe(true);
	});

	it('accepts every configured threshold edge and rejects the first value beyond it', () => {
		const dayList = dates(7);
		const policy = SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'];
		const publications = dayList.map((date, index) =>
			publication(
				date,
				index === 0
					? {
							quality_tier: 'degraded',
							supplier_coverage_ratio: policy.degradedMinSupplierCoverage,
							item_coverage_ratio: policy.degradedMinItemCoverage,
							stale_share: policy.degradedMaxStaleShare
						}
					: {}
			)
		);
		const atEdge = reportFor(dayList, {
			publications,
			publicationSegments: publications.map((row) =>
				segment(row.id, { price_median: 10 * (1 + policy.maxMedianPriceDeltaAbsPct) })
			)
		});
		expect(atEdge.verdict.accepted).toBe(true);

		const belowCoverage = reportFor(dayList, {
			publications: publications.map((row, index) =>
				index === 0
					? {
							...row,
							supplier_coverage_ratio: policy.degradedMinSupplierCoverage - 0.000001
						}
					: row
			)
		});
		expect(belowCoverage.verdict.accepted).toBe(false);
		expect(belowCoverage.verdict.reasons).toContain(
			`${dayList[0]} supplier_coverage below ${policy.degradedMinSupplierCoverage}`
		);

		const staleBeyond = reportFor(dayList, {
			publications: publications.map((row, index) =>
				index === 0 ? { ...row, stale_share: policy.degradedMaxStaleShare + 0.000001 } : row
			)
		});
		expect(staleBeyond.verdict.reasons).toContain(
			`${dayList[0]} stale_share above ${policy.degradedMaxStaleShare}`
		);
	});

	it('rejects per-day p95 price and supplier-count divergence above their named bounds', () => {
		const date = '2026-07-01';
		const current = Array.from({ length: 20 }, (_, index) =>
			segment(`publication-${date}`, {
				origin: `Origin ${index}`,
				price_median: index >= 18 ? 12 : 10,
				supplier_count: index >= 18 ? 8 : 4
			})
		);
		const baseline = Array.from({ length: 20 }, (_, index) =>
			legacy(date, { origin: `Origin ${index}` })
		);
		const report = reportFor([date], {
			publicationSegments: current,
			legacySegments: baseline,
			policy: {
				...SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'],
				version: 'test-distribution-edges',
				minComparableDays: 1,
				maxMedianPriceDeltaAbsPct: 1,
				maxPriceDeltaAbsPct: 1
			}
		});

		expect(report.summary.priceMedianAbsPctDelta?.p95).toBe(0.2);
		expect(report.summary.supplierCountAbsDivergence?.p95).toBe(4);
		expect(report.verdict.reasons).toContain('2026-07-01 p95_price_divergence above 0.15');
		expect(report.verdict.reasons).toContain('2026-07-01 p95_supplier_count_divergence above 3');
	});

	it('prevents high-volume good days from diluting one bad day', () => {
		const dayList = dates(7);
		const publications = dayList.map((date) => publication(date));
		const publicationSegments = publications.flatMap((row, dayIndex) =>
			Array.from({ length: dayIndex === 6 ? 1 : 100 }, (_, segmentIndex) =>
				segment(row.id, {
					origin: `Origin ${segmentIndex}`,
					price_median: dayIndex === 6 ? 20 : 10
				})
			)
		);
		const legacySegments = dayList.flatMap((date, dayIndex) =>
			Array.from({ length: dayIndex === 6 ? 1 : 100 }, (_, segmentIndex) =>
				legacy(date, { origin: `Origin ${segmentIndex}` })
			)
		);
		const report = reportFor(dayList, { publications, publicationSegments, legacySegments });

		expect(report.summary.priceMedianAbsPctDelta?.median).toBe(0);
		expect(report.verdict.reasons).toContain(`${dayList[6]} median_price_divergence above 0.05`);
		expect(report.verdict.reasons).toContain(`${dayList[6]} max_price_divergence above 0.5`);
	});

	it('rejects an extreme supplier-count outlier through the versioned maximum gate', () => {
		const date = '2026-07-01';
		const report = reportFor([date], {
			publicationSegments: [segment(`publication-${date}`, { supplier_count: 20 })],
			legacySegments: [legacy(date, { supplier_count: 4 })],
			policy: {
				...SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'],
				version: 'test-supplier-max',
				minComparableDays: 1,
				maxMedianSupplierCountDivergence: 100,
				maxP95SupplierCountDivergence: 100
			}
		});

		expect(report.verdict.reasons).toContain('2026-07-01 max_supplier_count_divergence above 5');
	});
});
