import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
	fetchPaginated,
	humanSummary,
	loadReport,
	runAudit,
	type CliOptions
} from '../../../scripts/audit-market-publication-shadow';
import {
	buildShadowReport,
	SHADOW_ACCEPTANCE_POLICIES,
	type LegacySegmentRow,
	type PublicationRow,
	type PublicationSegmentRow,
	type ShadowReport
} from './marketPublicationShadow';

type QueryCall = { table: string; method: string; args: unknown[] };

class FakeQuery {
	constructor(
		private table: string,
		private rows: Record<string, unknown>[],
		private calls: QueryCall[]
	) {}

	private record(method: string, args: unknown[]): this {
		this.calls.push({ table: this.table, method, args });
		return this;
	}

	select(...args: unknown[]): this {
		return this.record('select', args);
	}

	eq(...args: unknown[]): this {
		return this.record('eq', args);
	}

	in(...args: unknown[]): this {
		return this.record('in', args);
	}

	gte(...args: unknown[]): this {
		return this.record('gte', args);
	}

	lte(...args: unknown[]): this {
		return this.record('lte', args);
	}

	order(...args: unknown[]): this {
		return this.record('order', args);
	}

	range(from: number, to: number) {
		this.record('range', [from, to]);
		return Promise.resolve({ data: this.rows.slice(from, to + 1), error: null });
	}
}

function fakeClient(
	rowsByTable: Record<string, Record<string, unknown>[]>,
	calls: QueryCall[]
): SupabaseClient {
	return {
		from(table: string) {
			calls.push({ table, method: 'from', args: [] });
			return new FakeQuery(table, rowsByTable[table] ?? [], calls);
		}
	} as unknown as SupabaseClient;
}

const cohort = { key: 'production', version: 1, id: 'cohort-1' };

function publication(date: string): PublicationRow {
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
		max_observation_age: '1 day'
	};
}

function segment(publicationId: string, origin = 'Colombia'): PublicationSegmentRow {
	return {
		publication_id: publicationId,
		origin,
		process: null,
		grade: null,
		wholesale_only: false,
		supplier_count: 4,
		price_median: 10
	};
}

function legacy(date: string, origin = 'Colombia'): LegacySegmentRow {
	return {
		snapshot_date: date,
		origin,
		process: null,
		grade: null,
		wholesale_only: false,
		supplier_count: 4,
		price_median: 10,
		synthetic: false
	};
}

function acceptedReport(): ShadowReport {
	const dates = Array.from({ length: 7 }, (_, index) => `2026-07-0${index + 1}`);
	const publications = dates.map(publication);
	return buildShadowReport({
		startDate: dates[0],
		endDate: dates.at(-1)!,
		cohort,
		publications,
		publicationSegments: publications.map((row) => segment(row.id)),
		legacySegments: dates.map((date) => legacy(date)),
		generatedAt: '2026-07-13T00:00:00Z'
	});
}

describe('market publication shadow loader and CLI', () => {
	it('paginates until a short page using non-overlapping inclusive ranges', async () => {
		const ranges: Array<[number, number]> = [];
		const firstPage = Array.from({ length: 1_000 }, (_, index) => index);
		const rows = await fetchPaginated('fixture', async (from, to) => {
			ranges.push([from, to]);
			return { data: from === 0 ? firstPage : [1_000], error: null };
		});

		expect(rows).toHaveLength(1_001);
		expect(ranges).toEqual([
			[0, 999],
			[1_000, 1_999]
		]);
	});

	it('uses only read query methods and explicitly excludes synthetic legacy rows', async () => {
		const calls: QueryCall[] = [];
		const date = '2026-07-13';
		const client = fakeClient(
			{
				market_index_cohorts: [{ id: cohort.id, cohort_key: cohort.key, version: 1 }],
				market_publications: [publication(date)],
				market_publication_price_indexes: [segment(`publication-${date}`)],
				price_index_snapshots: [legacy(date)]
			},
			calls
		);
		const options: CliOptions = {
			days: 7,
			asOf: date,
			json: false,
			cohortKey: 'production',
			cohortVersion: 1
		};

		const report = await loadReport(client, options);
		const legacyCalls = calls.filter((call) => call.table === 'price_index_snapshots');

		expect(report.days.at(-1)?.legacySegmentCount).toBe(1);
		expect(legacyCalls).toContainEqual({
			table: 'price_index_snapshots',
			method: 'eq',
			args: ['synthetic', false]
		});
		expect(legacyCalls.find((call) => call.method === 'select')?.args[0]).toContain('synthetic');
		for (const forbidden of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
			expect(calls.map((call) => call.method)).not.toContain(forbidden);
		}
	});

	it('returns machine-usable JSON and human output with acceptance exit zero', async () => {
		const report = acceptedReport();
		const load = vi.fn(async () => report);
		const result = await runAudit(
			['--days', '7', '--as-of', '2026-07-07', '--json'],
			{ PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test' },
			{
				createClient: (() => ({}) as SupabaseClient) as never,
				loadReport: load
			}
		);

		expect(result.exitCode).toBe(0);
		expect(JSON.parse(result.stdout).verdict.accepted).toBe(true);
		expect(result.stderr).toContain('VERDICT: ACCEPT');
		expect(result.stderr).toContain('Missing publication dates: none');
		expect(load).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				days: 7,
				asOf: '2026-07-07',
				cohortKey: 'production',
				cohortVersion: 1,
				json: true
			})
		);
	});

	it('returns exit one for a completed rejection and exit two for env/service blockers', async () => {
		const rejected = {
			...acceptedReport(),
			verdict: {
				accepted: false,
				policyVersion: 'shadow-cutover-v1',
				reasons: ['fixture rejection']
			}
		};
		const env = {
			PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
			SUPABASE_SERVICE_ROLE_KEY: 'test'
		};
		const runtime = {
			createClient: (() => ({}) as SupabaseClient) as never,
			loadReport: vi.fn(async () => rejected)
		};

		expect((await runAudit(['--days', '7'], env, runtime)).exitCode).toBe(1);
		const blocked = await runAudit(['--days', '7'], {});
		expect(blocked.exitCode).toBe(2);
		expect(blocked.stderr).toContain('VALIDATION_BLOCKED_ENV');
		const service = await runAudit(['--days', '7'], env, {
			...runtime,
			loadReport: vi.fn(async () => {
				throw new Error('PGRST205 schema cache miss');
			})
		});
		expect(service.exitCode).toBe(2);
		expect(service.stderr).toContain('VALIDATION_BLOCKED_SERVICE');
	});

	it('surfaces missing dates, median failures, and offending segment identities in human output', () => {
		const date = '2026-07-01';
		const current = publication(date);
		const report = buildShadowReport({
			startDate: date,
			endDate: '2026-07-02',
			cohort,
			publications: [current],
			publicationSegments: [
				{ ...segment(current.id), price_median: 1 },
				{ ...segment(current.id, 'Kenya'), price_median: null }
			],
			legacySegments: [
				{ ...legacy(date), price_median: 0 },
				legacy(date, 'Kenya'),
				legacy(date, 'Ethiopia')
			],
			policy: {
				...SHADOW_ACCEPTANCE_POLICIES['shadow-cutover-v1'],
				version: 'human-fixture',
				minComparableDays: 1
			}
		});
		const human = humanSummary(report);

		expect(human).toContain('Missing publication dates: 2026-07-02');
		expect(human).toContain('missingMedian=1 zeroBaseline=1');
		expect(human).toContain('missing-publication=');
		expect(human).toContain('missing-medians=');
		expect(human).toContain('zero-baselines=');
		expect(human).toContain('Ethiopia');
	});
});
