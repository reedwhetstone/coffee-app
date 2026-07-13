#!/usr/bin/env npx tsx

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	buildShadowReport,
	type LegacySegmentRow,
	type PublicationRow,
	type PublicationSegmentRow,
	type ShadowReport
} from '../src/lib/server/marketPublicationShadow';

const DEFAULT_DAYS = 30;
const MIN_DAYS = 7;
const MAX_DAYS = 90;
const PAGE_SIZE = 1_000;
const MAX_ROWS_PER_QUERY = 100_000;
const COMMAND = 'pnpm run audit:market-publication-shadow';

export type CliOptions = {
	days: number;
	asOf: string;
	json: boolean;
	cohortKey: string;
	cohortVersion: number;
};

type CohortRow = {
	id: string;
	cohort_key: string;
	version: number;
};

type QueryResult<T> = PromiseLike<{
	data: T[] | null;
	error: { message: string; code?: string } | null;
}>;

export function usage(): string {
	return [
		'Usage: pnpm run audit:market-publication-shadow -- [options]',
		'',
		`  --days N             Recent calendar days (${MIN_DAYS}-${MAX_DAYS}, default ${DEFAULT_DAYS})`,
		'  --as-of YYYY-MM-DD    Inclusive UTC end date (default today)',
		'  --cohort-key KEY      Cohort key (default production)',
		'  --cohort-version N    Cohort version (default 1)',
		'  --json                JSON to stdout; human summary remains on stderr',
		'  --help                Show this help'
	].join('\n');
}

function valueAfter(args: string[], index: number, flag: string): string {
	const value = args[index + 1];
	if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
	return value;
}

function validIsoDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function parseArgs(args: string[], today = new Date()): CliOptions {
	const options: CliOptions = {
		days: DEFAULT_DAYS,
		asOf: today.toISOString().slice(0, 10),
		json: false,
		cohortKey: 'production',
		cohortVersion: 1
	};

	for (let index = 0; index < args.length; index += 1) {
		const flag = args[index];
		if (flag === '--') continue;
		if (flag === '--help') continue;
		if (flag === '--json') {
			options.json = true;
			continue;
		}
		if (flag === '--days') {
			options.days = Number(valueAfter(args, index, flag));
			index += 1;
			continue;
		}
		if (flag === '--as-of') {
			options.asOf = valueAfter(args, index, flag);
			index += 1;
			continue;
		}
		if (flag === '--cohort-key') {
			options.cohortKey = valueAfter(args, index, flag);
			index += 1;
			continue;
		}
		if (flag === '--cohort-version') {
			options.cohortVersion = Number(valueAfter(args, index, flag));
			index += 1;
			continue;
		}
		throw new Error(`unknown option: ${flag}`);
	}

	if (!Number.isInteger(options.days) || options.days < MIN_DAYS || options.days > MAX_DAYS) {
		throw new Error(`--days must be an integer from ${MIN_DAYS} through ${MAX_DAYS}`);
	}
	if (!validIsoDate(options.asOf)) throw new Error('--as-of must be a real YYYY-MM-DD date');
	if (!options.cohortKey.trim()) throw new Error('--cohort-key must not be empty');
	if (!Number.isInteger(options.cohortVersion) || options.cohortVersion < 1) {
		throw new Error('--cohort-version must be a positive integer');
	}
	return options;
}

export async function fetchPaginated<T>(
	label: string,
	fetchPage: (from: number, to: number) => QueryResult<T>
): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; from < MAX_ROWS_PER_QUERY; from += PAGE_SIZE) {
		const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
		if (error) throw new Error(`${label}: ${error.code ?? 'query_error'} ${error.message}`);
		const page = data ?? [];
		rows.push(...page);
		if (page.length < PAGE_SIZE) return rows;
	}
	throw new Error(`${label}: exceeded safety bound of ${MAX_ROWS_PER_QUERY} rows`);
}

function chunk<T>(values: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < values.length; index += size) {
		chunks.push(values.slice(index, index + size));
	}
	return chunks;
}

export async function loadReport(
	client: SupabaseClient,
	options: CliOptions
): Promise<ShadowReport> {
	const startDate = new Date(
		new Date(`${options.asOf}T00:00:00Z`).getTime() - (options.days - 1) * 86_400_000
	)
		.toISOString()
		.slice(0, 10);
	const cohorts = await fetchPaginated<CohortRow>(
		'market_index_cohorts',
		(from, to) =>
			client
				.from('market_index_cohorts')
				.select('id,cohort_key,version')
				.eq('cohort_key', options.cohortKey)
				.order('version', { ascending: true })
				.range(from, to) as unknown as QueryResult<CohortRow>
	);
	const cohort = cohorts.find((candidate) => candidate.version === options.cohortVersion);
	if (!cohort) {
		throw new Error(`cohort_not_found: ${options.cohortKey}@${options.cohortVersion}`);
	}

	const allPublications = await fetchPaginated<PublicationRow>(
		'market_publications',
		(from, to) =>
			client
				.from('market_publications')
				.select(
					'id,as_of_date,cohort_id,policy_version,methodology_version,quality_tier,supplier_coverage_ratio,item_coverage_ratio,stale_share,oldest_observed_at,max_observation_age'
				)
				.in(
					'cohort_id',
					cohorts.map((candidate) => candidate.id)
				)
				.eq('status', 'active')
				.gte('as_of_date', startDate)
				.lte('as_of_date', options.asOf)
				.order('as_of_date', { ascending: true })
				.order('cohort_id', { ascending: true })
				.order('id', { ascending: true })
				.range(from, to) as unknown as QueryResult<PublicationRow>
	);
	const publications = allPublications.filter((publication) => publication.cohort_id === cohort.id);
	const cohortVersionById = new Map(cohorts.map((candidate) => [candidate.id, candidate.version]));
	const observedCohortVersions = [
		...new Set(
			allPublications
				.map((publication) => cohortVersionById.get(publication.cohort_id))
				.filter((version): version is number => version !== undefined)
		)
	];

	const publicationSegments: PublicationSegmentRow[] = [];
	for (const ids of chunk(
		publications.map((row) => row.id),
		50
	)) {
		publicationSegments.push(
			...(await fetchPaginated<PublicationSegmentRow>(
				'market_publication_price_indexes',
				(from, to) =>
					client
						.from('market_publication_price_indexes')
						.select(
							'publication_id,origin,process,grade,wholesale_only,supplier_count,price_median'
						)
						.in('publication_id', ids)
						.order('publication_id', { ascending: true })
						.order('id', { ascending: true })
						.range(from, to) as unknown as QueryResult<PublicationSegmentRow>
			))
		);
	}

	const legacySegments = await fetchPaginated<LegacySegmentRow>(
		'price_index_snapshots',
		(from, to) =>
			client
				.from('price_index_snapshots')
				.select(
					'snapshot_date,origin,process,grade,wholesale_only,supplier_count,price_median,synthetic'
				)
				.eq('synthetic', false)
				.gte('snapshot_date', startDate)
				.lte('snapshot_date', options.asOf)
				.order('snapshot_date', { ascending: true })
				.order('id', { ascending: true })
				.range(from, to) as unknown as QueryResult<LegacySegmentRow>
	);

	return buildShadowReport({
		startDate,
		endDate: options.asOf,
		cohort: { key: cohort.cohort_key, version: cohort.version, id: cohort.id },
		publications,
		publicationSegments,
		legacySegments,
		observedCohortVersions
	});
}

function percent(value: number | null): string {
	return value === null ? 'n/a' : `${(value * 100).toFixed(2)}%`;
}

function representativeSegments(values: string[]): string {
	return values.slice(0, 3).join(', ') || 'none';
}

export function humanSummary(report: ShadowReport): string {
	const lines = [
		`Market publication shadow audit — ${report.cohort.key}@${report.cohort.version}`,
		`Window: ${report.window.startDate}..${report.window.endDate} (${report.window.days} days)`,
		`Policy: ${report.policy.version}`,
		'',
		...report.days.map(
			(day) =>
				`${day.date} ${day.qualityTier.padEnd(8)} coverage suppliers=${percent(day.supplierCoverage)} items=${percent(day.itemCoverage)} stale=${percent(day.staleShare)} maxAge=${day.maxObservationAgeDays ?? 'n/a'}d segments new=${day.newSegmentCount} legacy=${day.legacySegmentCount} overlap=${percent(day.exactSegmentOverlapRatio)} medianΔ=${percent(day.priceMedianAbsPctDelta.median)} p95Δ=${percent(day.priceMedianAbsPctDelta.p95)} missingMedian=${day.priceMedianAbsPctDelta.missingMedianPairs} zeroBaseline=${day.priceMedianAbsPctDelta.zeroLegacyMedianMismatches}`
		),
		...report.days.flatMap((day) => {
			const issues = [
				day.missingFromPublication.length
					? `missing-publication=${representativeSegments(day.missingFromPublication)}`
					: null,
				day.missingFromLegacy.length
					? `missing-legacy=${representativeSegments(day.missingFromLegacy)}`
					: null,
				day.priceMedianAbsPctDelta.missingMedianSegments.length
					? `missing-medians=${representativeSegments(day.priceMedianAbsPctDelta.missingMedianSegments)}`
					: null,
				day.priceMedianAbsPctDelta.zeroLegacyMedianMismatchSegments.length
					? `zero-baselines=${representativeSegments(day.priceMedianAbsPctDelta.zeroLegacyMedianMismatchSegments)}`
					: null,
				day.duplicatePublicationSegments.length
					? `duplicate-publication=${representativeSegments(day.duplicatePublicationSegments)}`
					: null,
				day.duplicateLegacySegments.length
					? `duplicate-legacy=${representativeSegments(day.duplicateLegacySegments)}`
					: null,
				day.syntheticLegacySegments.length
					? `synthetic-legacy=${representativeSegments(day.syntheticLegacySegments)}`
					: null
			].filter((issue): issue is string => issue !== null);
			return issues.length ? [`  ${day.date} issues: ${issues.join('; ')}`] : [];
		}),
		'',
		`Comparable days: ${report.summary.comparableDays}; healthy: ${report.summary.healthyDays}; degraded: ${report.summary.degradedDays}`,
		`Missing publication dates: ${report.summary.missingPublicationDates.join(', ') || 'none'}`,
		`Missing legacy dates: ${report.summary.missingLegacyDates.join(', ') || 'none'}`,
		`Compatibility groups: ${report.summary.compatibilityGroups.length}; pooled=${report.summary.pooledCompatibleWindow}`,
		`Observed cohort versions: ${report.summary.observedCohortVersions.join(', ') || 'none'}`,
		`Window median price divergence: ${percent(report.summary.priceMedianAbsPctDelta?.median ?? null)}; p95: ${percent(report.summary.priceMedianAbsPctDelta?.p95 ?? null)}; max: ${percent(report.summary.priceMedianAbsPctDelta?.max ?? null)}`,
		`Window supplier-count divergence median: ${report.summary.supplierCountAbsDivergence?.median ?? 'n/a'}; p95: ${report.summary.supplierCountAbsDivergence?.p95 ?? 'n/a'}`,
		'',
		report.comparisonCaveat,
		'',
		`VERDICT: ${report.verdict.accepted ? 'ACCEPT' : 'REJECT'}`,
		...(report.verdict.reasons.length
			? report.verdict.reasons.map((reason) => `- ${reason}`)
			: ['- all shadow-cutover acceptance gates passed'])
	];
	return lines.join('\n');
}

export function classifyServiceError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	if (/42P01|PGRST205|Could not find the table|schema cache/i.test(message)) {
		return `VALIDATION_BLOCKED_SERVICE: ${COMMAND} — market publication schema is absent or unavailable: ${message}`;
	}
	return `VALIDATION_BLOCKED_SERVICE: ${COMMAND} — read-only Supabase query failed: ${message}`;
}

export type AuditRunResult = { exitCode: 0 | 1 | 2; stdout: string; stderr: string };

export async function runAudit(
	args: string[],
	env: NodeJS.ProcessEnv,
	runtime: {
		now?: Date;
		createClient?: typeof createClient;
		loadReport?: typeof loadReport;
	} = {}
): Promise<AuditRunResult> {
	if (args.includes('--help')) return { exitCode: 0, stdout: `${usage()}\n`, stderr: '' };
	let options: CliOptions;
	try {
		options = parseArgs(args, runtime.now);
	} catch (error) {
		return {
			exitCode: 2,
			stdout: '',
			stderr: `ERROR: ${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`
		};
	}

	const missing = ['PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
		(name) => !env[name]?.trim()
	);
	if (missing.length > 0) {
		return {
			exitCode: 2,
			stdout: '',
			stderr: `VALIDATION_BLOCKED_ENV: ${COMMAND} — missing required ${missing.join(', ')}\n`
		};
	}

	const client = (runtime.createClient ?? createClient)(
		env.PUBLIC_SUPABASE_URL!,
		env.SUPABASE_SERVICE_ROLE_KEY!,
		{ auth: { persistSession: false, autoRefreshToken: false } }
	);
	try {
		const report = await (runtime.loadReport ?? loadReport)(client, options);
		const human = humanSummary(report);
		if (options.json) {
			return {
				exitCode: report.verdict.accepted ? 0 : 1,
				stdout: `${JSON.stringify(report, null, 2)}\n`,
				stderr: `${human}\n`
			};
		}
		return {
			exitCode: report.verdict.accepted ? 0 : 1,
			stdout: `${human}\n`,
			stderr: ''
		};
	} catch (error) {
		return { exitCode: 2, stdout: '', stderr: `${classifyServiceError(error)}\n` };
	}
}

async function main(): Promise<void> {
	loadEnv({ path: ['.env.local', '.env'] });
	const result = await runAudit(process.argv.slice(2), process.env);
	if (result.stdout) process.stdout.write(result.stdout);
	if (result.stderr) process.stderr.write(result.stderr);
	process.exitCode = result.exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	void main();
}
