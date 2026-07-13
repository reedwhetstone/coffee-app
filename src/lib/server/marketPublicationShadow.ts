export type ShadowAcceptancePolicy = {
	version: string;
	minComparableDays: number;
	maxDegradedDays: number;
	healthyMinSupplierCoverage: number;
	healthyMinItemCoverage: number;
	healthyMaxStaleShare: number;
	degradedMinSupplierCoverage: number;
	degradedMinItemCoverage: number;
	degradedMaxStaleShare: number;
	minSegmentOverlap: number;
	maxMedianPriceDeltaAbsPct: number;
	maxP95PriceDeltaAbsPct: number;
	maxPriceDeltaAbsPct: number;
	maxMedianSupplierCountDivergence: number;
	maxP95SupplierCountDivergence: number;
	maxSupplierCountDivergence: number;
	allowZeroLegacyMedianMismatches: number;
	maxMissingPriceMedianPairs: number;
};

export const SHADOW_ACCEPTANCE_POLICIES = {
	'shadow-cutover-v1': {
		version: 'shadow-cutover-v1',
		minComparableDays: 7,
		maxDegradedDays: 1,
		healthyMinSupplierCoverage: 0.8,
		healthyMinItemCoverage: 0.7,
		healthyMaxStaleShare: 0.2,
		degradedMinSupplierCoverage: 0.6,
		degradedMinItemCoverage: 0.5,
		degradedMaxStaleShare: 0.4,
		minSegmentOverlap: 0.85,
		maxMedianPriceDeltaAbsPct: 0.05,
		maxP95PriceDeltaAbsPct: 0.15,
		maxPriceDeltaAbsPct: 0.5,
		maxMedianSupplierCountDivergence: 1,
		maxP95SupplierCountDivergence: 3,
		maxSupplierCountDivergence: 5,
		allowZeroLegacyMedianMismatches: 0,
		maxMissingPriceMedianPairs: 0
	}
} as const satisfies Record<string, ShadowAcceptancePolicy>;
export type QualityTier = 'healthy' | 'degraded' | 'suppressed' | 'unknown' | 'legacy';

export type PublicationRow = {
	id: string;
	as_of_date: string;
	cohort_id: string;
	policy_version: string;
	methodology_version: string;
	quality_tier: QualityTier;
	supplier_coverage_ratio: number | string | null;
	item_coverage_ratio: number | string | null;
	stale_share: number | string | null;
	oldest_observed_at: string | null;
	max_observation_age: string | null;
};

export type SegmentRow = {
	origin: string;
	process: string | null;
	grade: string | null;
	wholesale_only: boolean;
	supplier_count: number;
	price_median: number | string | null;
};

export type PublicationSegmentRow = SegmentRow & { publication_id: string };
export type LegacySegmentRow = SegmentRow & { snapshot_date: string; synthetic?: boolean };

export type Distribution = {
	count: number;
	median: number | null;
	p95: number | null;
	max: number | null;
};

export type DayComparison = {
	date: string;
	publicationId: string | null;
	qualityTier: QualityTier | 'missing';
	compatibilityKey: string | null;
	supplierCoverage: number | null;
	itemCoverage: number | null;
	staleShare: number | null;
	carriedShare: number | null;
	oldestObservedAt: string | null;
	maxObservationAgeDays: number | null;
	legacySegmentCount: number;
	newSegmentCount: number;
	exactSegmentOverlap: number;
	exactSegmentOverlapRatio: number;
	missingFromLegacy: string[];
	missingFromPublication: string[];
	duplicatePublicationSegments: string[];
	duplicateLegacySegments: string[];
	syntheticLegacySegments: string[];
	priceMedianAbsPctDelta: Distribution & {
		zeroLegacyMedianMismatches: number;
		missingMedianPairs: number;
		zeroLegacyMedianMismatchSegments: string[];
		missingMedianSegments: string[];
	};
	supplierCountAbsDivergence: Distribution;
	comparable: boolean;
};

export type CompatibilityGroup = {
	key: string;
	dates: string[];
	comparableDays: number;
	priceMedianAbsPctDelta: Distribution;
	supplierCountAbsDivergence: Distribution;
};

export type ShadowVerdict = {
	accepted: boolean;
	policyVersion: string;
	reasons: string[];
};

export type ShadowReport = {
	generatedAt: string;
	window: { startDate: string; endDate: string; days: number };
	cohort: { key: string; version: number; id: string };
	comparisonCaveat: string;
	policy: ShadowAcceptancePolicy;
	days: DayComparison[];
	summary: {
		calendarDays: number;
		activePublicationDays: number;
		comparableDays: number;
		healthyDays: number;
		degradedDays: number;
		missingPublicationDates: string[];
		missingLegacyDates: string[];
		observedCohortVersions: number[];
		compatibilityGroups: CompatibilityGroup[];
		pooledCompatibleWindow: boolean;
		priceMedianAbsPctDelta: Distribution | null;
		supplierCountAbsDivergence: Distribution | null;
	};
	verdict: ShadowVerdict;
};

type DaySamples = {
	priceDeltas: number[];
	supplierDivergences: number[];
};

const DAY_MS = 86_400_000;

function numeric(value: number | string | null): number | null {
	if (value === null) return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number): number {
	return Math.round(value * 1_000_000) / 1_000_000;
}

export function quantile(values: number[], percentile: number): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const position = (sorted.length - 1) * percentile;
	const lower = Math.floor(position);
	const upper = Math.ceil(position);
	if (lower === upper) return round(sorted[lower]);
	return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

export function distribution(values: number[]): Distribution {
	return {
		count: values.length,
		median: quantile(values, 0.5),
		p95: quantile(values, 0.95),
		max: values.length === 0 ? null : round(Math.max(...values))
	};
}

export function segmentKey(segment: SegmentRow): string {
	return JSON.stringify([
		segment.origin,
		segment.process ?? null,
		segment.grade ?? null,
		segment.wholesale_only
	]);
}

function indexSegments(rows: SegmentRow[]): {
	byKey: Map<string, SegmentRow>;
	duplicates: string[];
} {
	const byKey = new Map<string, SegmentRow>();
	const duplicates = new Set<string>();
	for (const row of rows) {
		const key = segmentKey(row);
		if (byKey.has(key)) duplicates.add(key);
		else byKey.set(key, row);
	}
	return { byKey, duplicates: [...duplicates].sort() };
}

export function parsePostgresIntervalDays(value: string | null): number | null {
	if (!value) return null;
	const dayMatch = value.match(/(-?\d+(?:\.\d+)?)\s+days?/i);
	const timeMatch = value.match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);
	let days = dayMatch ? Number(dayMatch[1]) : 0;
	if (timeMatch) {
		days +=
			(Number(timeMatch[1] ?? 0) * 3600 + Number(timeMatch[2]) * 60 + Number(timeMatch[3])) /
			86_400;
	}
	return dayMatch || timeMatch ? round(days) : null;
}

export function compatibilityKey(
	cohortKey: string,
	cohortVersion: number,
	publication: PublicationRow
): string {
	return [
		`${cohortKey}@${cohortVersion}`,
		publication.methodology_version,
		publication.policy_version
	].join('|');
}

export function compareDay(
	date: string,
	publication: PublicationRow | undefined,
	newSegments: PublicationSegmentRow[],
	legacySegments: LegacySegmentRow[],
	cohortKey: string,
	cohortVersion: number
): { day: DayComparison; samples: DaySamples } {
	const { byKey: newByKey, duplicates: duplicatePublicationSegments } = indexSegments(newSegments);
	const { byKey: legacyByKey, duplicates: duplicateLegacySegments } = indexSegments(legacySegments);
	const newKeys = [...newByKey.keys()];
	const legacyKeys = [...legacyByKey.keys()];
	const overlap = newKeys.filter((key) => legacyByKey.has(key));
	const unionSize = new Set([...newKeys, ...legacyKeys]).size;
	const priceDeltas: number[] = [];
	const supplierDivergences: number[] = [];
	const zeroLegacyMedianMismatchSegments: string[] = [];
	const missingMedianSegments: string[] = [];

	for (const key of overlap) {
		const current = newByKey.get(key)!;
		const legacy = legacyByKey.get(key)!;
		const currentMedian = numeric(current.price_median);
		const legacyMedian = numeric(legacy.price_median);
		if (currentMedian === null || legacyMedian === null) {
			missingMedianSegments.push(key);
		} else {
			if (legacyMedian === 0) {
				if (currentMedian === 0) priceDeltas.push(0);
				else zeroLegacyMedianMismatchSegments.push(key);
			} else {
				priceDeltas.push(Math.abs((currentMedian - legacyMedian) / legacyMedian));
			}
		}
		supplierDivergences.push(Math.abs(current.supplier_count - legacy.supplier_count));
	}

	const priceDistribution = distribution(priceDeltas);
	const supplierDistribution = distribution(supplierDivergences);
	const day: DayComparison = {
		date,
		publicationId: publication?.id ?? null,
		qualityTier: publication?.quality_tier ?? 'missing',
		compatibilityKey: publication ? compatibilityKey(cohortKey, cohortVersion, publication) : null,
		supplierCoverage: numeric(publication?.supplier_coverage_ratio ?? null),
		itemCoverage: numeric(publication?.item_coverage_ratio ?? null),
		staleShare: numeric(publication?.stale_share ?? null),
		carriedShare: numeric(publication?.stale_share ?? null),
		oldestObservedAt: publication?.oldest_observed_at ?? null,
		maxObservationAgeDays: parsePostgresIntervalDays(publication?.max_observation_age ?? null),
		legacySegmentCount: legacySegments.length,
		newSegmentCount: newSegments.length,
		exactSegmentOverlap: overlap.length,
		exactSegmentOverlapRatio: unionSize === 0 ? 0 : round(overlap.length / unionSize),
		missingFromLegacy: newKeys.filter((key) => !legacyByKey.has(key)).sort(),
		missingFromPublication: legacyKeys.filter((key) => !newByKey.has(key)).sort(),
		duplicatePublicationSegments,
		duplicateLegacySegments,
		syntheticLegacySegments: legacySegments
			.filter((segment) => segment.synthetic === true)
			.map(segmentKey)
			.sort(),
		priceMedianAbsPctDelta: {
			...priceDistribution,
			zeroLegacyMedianMismatches: zeroLegacyMedianMismatchSegments.length,
			missingMedianPairs: missingMedianSegments.length,
			zeroLegacyMedianMismatchSegments,
			missingMedianSegments
		},
		supplierCountAbsDivergence: supplierDistribution,
		comparable:
			publication !== undefined &&
			publication.quality_tier !== 'suppressed' &&
			overlap.length > 0 &&
			priceDeltas.length > 0
	};

	return { day, samples: { priceDeltas, supplierDivergences } };
}

function dateRange(startDate: string, endDate: string): string[] {
	const start = new Date(`${startDate}T00:00:00Z`);
	const end = new Date(`${endDate}T00:00:00Z`);
	const dates: string[] = [];
	for (let time = start.getTime(); time <= end.getTime(); time += DAY_MS) {
		dates.push(new Date(time).toISOString().slice(0, 10));
	}
	return dates;
}

function evaluateVerdict(
	days: DayComparison[],
	groups: CompatibilityGroup[],
	configuredCohortVersion: number,
	observedCohortVersions: number[],
	policy: ShadowAcceptancePolicy
): ShadowVerdict {
	const reasons: string[] = [];
	const comparable = days.filter((day) => day.comparable);
	const degraded = days.filter((day) => day.qualityTier === 'degraded');
	const unsupported = days.filter(
		(day) => day.publicationId && !['healthy', 'degraded'].includes(day.qualityTier)
	);

	if (comparable.length < policy.minComparableDays) {
		reasons.push(`comparable_days ${comparable.length} < ${policy.minComparableDays}`);
	}
	if (groups.length > 1) {
		reasons.push(
			`incompatible_versions ${groups.length} (cohort/methodology/policy days are not pooled)`
		);
	}
	if (observedCohortVersions.length > 1) {
		reasons.push(`incompatible_cohort_versions ${observedCohortVersions.join(',')}`);
	} else if (
		observedCohortVersions.length === 1 &&
		observedCohortVersions[0] !== configuredCohortVersion
	) {
		reasons.push(
			`cohort_version_window_mismatch configured=${configuredCohortVersion} observed=${observedCohortVersions[0]}`
		);
	}
	if (unsupported.length > 0) {
		reasons.push(`unsupported_active_quality_days ${unsupported.length}`);
	}
	if (degraded.length > policy.maxDegradedDays) {
		reasons.push(`degraded_days ${degraded.length} > ${policy.maxDegradedDays}`);
	}

	for (const day of days.filter((candidate) => candidate.publicationId)) {
		const healthy = day.qualityTier === 'healthy';
		const minSupplierCoverage = healthy
			? policy.healthyMinSupplierCoverage
			: policy.degradedMinSupplierCoverage;
		const minItemCoverage = healthy
			? policy.healthyMinItemCoverage
			: policy.degradedMinItemCoverage;
		const maxStaleShare = healthy ? policy.healthyMaxStaleShare : policy.degradedMaxStaleShare;
		if ((day.supplierCoverage ?? -1) < minSupplierCoverage) {
			reasons.push(`${day.date} supplier_coverage below ${minSupplierCoverage}`);
		}
		if ((day.itemCoverage ?? -1) < minItemCoverage) {
			reasons.push(`${day.date} item_coverage below ${minItemCoverage}`);
		}
		if ((day.staleShare ?? 1) > maxStaleShare) {
			reasons.push(`${day.date} stale_share above ${maxStaleShare}`);
		}
		if (day.exactSegmentOverlap === 0) {
			reasons.push(`${day.date} has no matched segment identities`);
		}
		if (day.priceMedianAbsPctDelta.count === 0) {
			reasons.push(`${day.date} has no usable matched median pairs`);
		}
		if (day.exactSegmentOverlapRatio < policy.minSegmentOverlap) {
			reasons.push(`${day.date} segment_overlap below ${policy.minSegmentOverlap}`);
		}
		if (
			day.priceMedianAbsPctDelta.zeroLegacyMedianMismatches > policy.allowZeroLegacyMedianMismatches
		) {
			reasons.push(
				`${day.date} has non-comparable zero legacy medians: ${day.priceMedianAbsPctDelta.zeroLegacyMedianMismatchSegments.slice(0, 3).join(', ')}`
			);
		}
		if (day.priceMedianAbsPctDelta.missingMedianPairs > policy.maxMissingPriceMedianPairs) {
			reasons.push(
				`${day.date} missing_price_median_pairs ${day.priceMedianAbsPctDelta.missingMedianPairs} > ${policy.maxMissingPriceMedianPairs}: ${day.priceMedianAbsPctDelta.missingMedianSegments.slice(0, 3).join(', ')}`
			);
		}
		if (day.duplicatePublicationSegments.length > 0) {
			reasons.push(
				`${day.date} duplicate publication segment identities: ${day.duplicatePublicationSegments.slice(0, 3).join(', ')}`
			);
		}
		if (day.duplicateLegacySegments.length > 0) {
			reasons.push(
				`${day.date} duplicate legacy segment identities: ${day.duplicateLegacySegments.slice(0, 3).join(', ')}`
			);
		}
		if (day.syntheticLegacySegments.length > 0) {
			reasons.push(
				`${day.date} synthetic legacy segments entered comparison: ${day.syntheticLegacySegments.slice(0, 3).join(', ')}`
			);
		}
		if (
			day.priceMedianAbsPctDelta.count > 0 &&
			(day.priceMedianAbsPctDelta.median ?? Infinity) > policy.maxMedianPriceDeltaAbsPct
		) {
			reasons.push(`${day.date} median_price_divergence above ${policy.maxMedianPriceDeltaAbsPct}`);
		}
		if (
			day.priceMedianAbsPctDelta.count > 0 &&
			(day.priceMedianAbsPctDelta.p95 ?? Infinity) > policy.maxP95PriceDeltaAbsPct
		) {
			reasons.push(`${day.date} p95_price_divergence above ${policy.maxP95PriceDeltaAbsPct}`);
		}
		if (
			day.priceMedianAbsPctDelta.count > 0 &&
			(day.priceMedianAbsPctDelta.max ?? Infinity) > policy.maxPriceDeltaAbsPct
		) {
			reasons.push(`${day.date} max_price_divergence above ${policy.maxPriceDeltaAbsPct}`);
		}
		if (
			day.supplierCountAbsDivergence.count > 0 &&
			(day.supplierCountAbsDivergence.median ?? Infinity) > policy.maxMedianSupplierCountDivergence
		) {
			reasons.push(
				`${day.date} median_supplier_count_divergence above ${policy.maxMedianSupplierCountDivergence}`
			);
		}
		if (
			day.supplierCountAbsDivergence.count > 0 &&
			(day.supplierCountAbsDivergence.p95 ?? Infinity) > policy.maxP95SupplierCountDivergence
		) {
			reasons.push(
				`${day.date} p95_supplier_count_divergence above ${policy.maxP95SupplierCountDivergence}`
			);
		}
		if (
			day.supplierCountAbsDivergence.count > 0 &&
			(day.supplierCountAbsDivergence.max ?? Infinity) > policy.maxSupplierCountDivergence
		) {
			reasons.push(
				`${day.date} max_supplier_count_divergence above ${policy.maxSupplierCountDivergence}`
			);
		}
	}

	return { accepted: reasons.length === 0, policyVersion: policy.version, reasons };
}

export function buildShadowReport(input: {
	startDate: string;
	endDate: string;
	cohort: { key: string; version: number; id: string };
	publications: PublicationRow[];
	publicationSegments: PublicationSegmentRow[];
	legacySegments: LegacySegmentRow[];
	policy?: ShadowAcceptancePolicy;
	generatedAt?: string;
	observedCohortVersions?: number[];
}): ShadowReport {
	const policy = input.policy ?? SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'];
	const publicationsByDate = new Map(input.publications.map((row) => [row.as_of_date, row]));
	const publicationSegmentsById = new Map<string, PublicationSegmentRow[]>();
	for (const row of input.publicationSegments) {
		const rows = publicationSegmentsById.get(row.publication_id) ?? [];
		rows.push(row);
		publicationSegmentsById.set(row.publication_id, rows);
	}
	const legacyByDate = new Map<string, LegacySegmentRow[]>();
	for (const row of input.legacySegments) {
		const rows = legacyByDate.get(row.snapshot_date) ?? [];
		rows.push(row);
		legacyByDate.set(row.snapshot_date, rows);
	}

	const samplesByDay = new Map<string, DaySamples>();
	const days = dateRange(input.startDate, input.endDate).map((date) => {
		const publication = publicationsByDate.get(date);
		const result = compareDay(
			date,
			publication,
			publication ? (publicationSegmentsById.get(publication.id) ?? []) : [],
			legacyByDate.get(date) ?? [],
			input.cohort.key,
			input.cohort.version
		);
		samplesByDay.set(date, result.samples);
		return result.day;
	});

	const groupMap = new Map<string, DayComparison[]>();
	for (const day of days.filter((candidate) => candidate.compatibilityKey)) {
		const rows = groupMap.get(day.compatibilityKey!) ?? [];
		rows.push(day);
		groupMap.set(day.compatibilityKey!, rows);
	}
	const groups = [...groupMap.entries()].map(([key, groupDays]) => {
		const priceDeltas = groupDays.flatMap((day) => samplesByDay.get(day.date)?.priceDeltas ?? []);
		const supplierDivergences = groupDays.flatMap(
			(day) => samplesByDay.get(day.date)?.supplierDivergences ?? []
		);
		return {
			key,
			dates: groupDays.map((day) => day.date),
			comparableDays: groupDays.filter((day) => day.comparable).length,
			priceMedianAbsPctDelta: distribution(priceDeltas),
			supplierCountAbsDivergence: distribution(supplierDivergences)
		};
	});
	const allDates = dateRange(input.startDate, input.endDate);
	const observedCohortVersions = [
		...new Set(input.observedCohortVersions ?? [input.cohort.version])
	].sort((a, b) => a - b);
	const pooled =
		groups.length === 1 &&
		observedCohortVersions.length === 1 &&
		observedCohortVersions[0] === input.cohort.version;

	return {
		generatedAt: input.generatedAt ?? new Date().toISOString(),
		window: { startDate: input.startDate, endDate: input.endDate, days: allDates.length },
		cohort: input.cohort,
		comparisonCaveat:
			'Legacy snapshots are a divergence baseline, not ground truth. Differences may reflect supplier-first weighting, carry-forward, assortment composition, or defects and require investigation before cutover.',
		policy,
		days,
		summary: {
			calendarDays: allDates.length,
			activePublicationDays: days.filter((day) => day.publicationId).length,
			comparableDays: days.filter((day) => day.comparable).length,
			healthyDays: days.filter((day) => day.qualityTier === 'healthy').length,
			degradedDays: days.filter((day) => day.qualityTier === 'degraded').length,
			missingPublicationDates: days.filter((day) => !day.publicationId).map((day) => day.date),
			missingLegacyDates: days.filter((day) => day.legacySegmentCount === 0).map((day) => day.date),
			observedCohortVersions,
			compatibilityGroups: groups,
			pooledCompatibleWindow: pooled,
			priceMedianAbsPctDelta: pooled ? groups[0].priceMedianAbsPctDelta : null,
			supplierCountAbsDivergence: pooled ? groups[0].supplierCountAbsDivergence : null
		},
		verdict: evaluateVerdict(days, groups, input.cohort.version, observedCohortVersions, policy)
	};
}
