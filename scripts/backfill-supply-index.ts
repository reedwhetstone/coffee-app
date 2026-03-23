#!/usr/bin/env npx tsx
/**
 * backfill-supply-index.ts
 *
 * Reconstructs 26 weeks of historical supply data by analyzing
 * coffee_catalog stocked_date / unstocked_date fields, then generates
 * synthetic price_index_snapshots rows (one per Saturday per origin).
 *
 * These rows are marked synthetic=true so they're distinguishable from
 * real daily scraper-computed snapshots.
 *
 * Usage:
 *   npx tsx scripts/backfill-supply-index.ts [--dry-run] [--sql-only] [--weeks 26]
 *
 *   --dry-run     Print what would be inserted without touching the DB
 *   --sql-only    Output INSERT SQL to stdout only (no DB writes)
 *   --weeks N     How many weeks back to generate (default: 26)
 *   --min-beans N Minimum beans stocked per origin to include (default: 2)
 *
 * Env vars (reads from .env, .env.local, or environment):
 *   PUBLIC_SUPABASE_URL       — Supabase project URL
 *   PUBLIC_SUPABASE_ANON_KEY  — Anon key (read-only access for catalog fetch)
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (required for inserts)
 *
 * Prerequisites (run SQL migration first):
 *   supabase/migrations/20260322_backfill_supply_index.sql
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Env loading (simple .env parser — no extra deps)
// ---------------------------------------------------------------------------

function loadEnv(): void {
	const __dir = dirname(fileURLToPath(import.meta.url));
	const root = resolve(__dir, '..');
	const candidates = ['.env.local', '.env'];

	for (const name of candidates) {
		const p = resolve(root, name);
		if (!existsSync(p)) continue;
		const content = readFileSync(p, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const val = trimmed
				.slice(eq + 1)
				.trim()
				.replace(/^["']|["']$/g, '');
			if (!(key in process.env)) {
				process.env[key] = val;
			}
		}
		break; // Use first found
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CatalogBean {
	id: number;
	name: string;
	country: string | null;
	source: string | null;
	cost_lb: number | null;
	stocked: boolean;
	stocked_date: string | null; // ISO date string
	unstocked_date: string | null; // ISO date string
	wholesale: boolean;
}

interface WeeklyOriginBucket {
	snapshotDate: Date; // Saturday of the week
	origin: string;
	beans: CatalogBean[];
}

interface PpiRow {
	snapshot_date: string;
	origin: string;
	process: null;
	grade: null;
	supplier_count: number;
	price_min: number | null;
	price_max: number | null;
	price_avg: number | null;
	price_median: number | null;
	sample_size: number;
	wholesale_only: boolean;
	synthetic: boolean;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SQL_ONLY = args.includes('--sql-only');
const WEEKS_IDX = args.indexOf('--weeks');
const WEEKS_BACK = WEEKS_IDX !== -1 ? parseInt(args[WEEKS_IDX + 1], 10) : 26;
const MIN_BEANS_IDX = args.indexOf('--min-beans');
const MIN_BEANS = MIN_BEANS_IDX !== -1 ? parseInt(args[MIN_BEANS_IDX + 1], 10) : 2;

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns the most recent Saturday on or before the given date */
function lastSaturday(d: Date): Date {
	const day = d.getDay(); // 0=Sun … 6=Sat
	const diff = (day + 1) % 7; // days since Saturday
	const sat = new Date(d);
	sat.setDate(sat.getDate() - diff);
	sat.setHours(0, 0, 0, 0);
	return sat;
}

/** Returns array of N Saturdays going back from the most recent Saturday */
function buildWeekSaturdays(weeksBack: number): Date[] {
	const saturdays: Date[] = [];
	const base = lastSaturday(new Date());
	// Exclude the current week (in progress); start from last week
	for (let i = 1; i <= weeksBack; i++) {
		const sat = new Date(base);
		sat.setDate(sat.getDate() - 7 * i);
		saturdays.push(sat);
	}
	return saturdays.reverse(); // oldest first
}

function toISODate(d: Date): string {
	return d.toISOString().split('T')[0];
}

function parseDate(s: string | null): Date | null {
	if (!s) return null;
	const d = new Date(s + 'T00:00:00Z');
	return isNaN(d.getTime()) ? null : d;
}

function startOfWeek(saturday: Date): Date {
	const d = new Date(saturday);
	d.setDate(d.getDate() - 6); // Sunday
	d.setHours(0, 0, 0, 0);
	return d;
}

function endOfWeek(saturday: Date): Date {
	const d = new Date(saturday);
	d.setHours(23, 59, 59, 999);
	return d;
}

/** A bean is stocked during a week if:
 *  stocked_date <= end_of_week  AND  (unstocked_date IS NULL OR unstocked_date >= start_of_week)
 */
function isStockedDuringWeek(bean: CatalogBean, saturday: Date): boolean {
	const weekStart = startOfWeek(saturday);
	const weekEnd = endOfWeek(saturday);

	const stockedAt = parseDate(bean.stocked_date);
	if (!stockedAt) return false; // No stocked_date → can't determine

	if (stockedAt > weekEnd) return false; // Stocked after this week ended

	const unstockedAt = parseDate(bean.unstocked_date);
	if (unstockedAt && unstockedAt < weekStart) return false; // Unstocked before this week started

	return true;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round2(n: number | null): number | null {
	return n === null ? null : Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

function rowToSql(row: PpiRow): string {
	const v = (x: string | number | boolean | null) => {
		if (x === null || x === undefined) return 'NULL';
		if (typeof x === 'boolean') return x ? 'TRUE' : 'FALSE';
		if (typeof x === 'number') return String(x);
		return `'${x.replace(/'/g, "''")}'`;
	};

	return (
		`INSERT INTO public.price_index_snapshots ` +
		`(snapshot_date, origin, process, grade, supplier_count, ` +
		`price_min, price_max, price_avg, price_median, sample_size, ` +
		`wholesale_only, synthetic) VALUES (` +
		`${v(row.snapshot_date)}, ${v(row.origin)}, ${v(row.process)}, ${v(row.grade)}, ` +
		`${v(row.supplier_count)}, ${v(row.price_min)}, ${v(row.price_max)}, ` +
		`${v(row.price_avg)}, ${v(row.price_median)}, ${v(row.sample_size)}, ` +
		`${v(row.wholesale_only)}, ${v(row.synthetic)}` +
		`) ON CONFLICT (snapshot_date, origin, COALESCE(process, ''), COALESCE(grade, ''), wholesale_only, synthetic) ` +
		`DO NOTHING;`
	);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	loadEnv();

	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl) {
		console.error('ERROR: PUBLIC_SUPABASE_URL is not set. Check your .env file.');
		process.exit(1);
	}

	// Use service role for inserts, anon for read-only dry-runs
	const apiKey =
		!SQL_ONLY && !DRY_RUN && serviceKey && serviceKey !== 'dummy' ? serviceKey : (anonKey ?? '');

	if (!SQL_ONLY && !DRY_RUN && (!serviceKey || serviceKey === 'dummy')) {
		console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required for DB inserts.');
		console.error('       Run with --sql-only to generate INSERT SQL instead.');
		process.exit(1);
	}

	const supabase = createClient(supabaseUrl, apiKey);

	// ------------------------------------------------------------------
	// Step 1: Fetch ALL coffee_catalog beans
	// ------------------------------------------------------------------
	console.error('Fetching coffee_catalog...');

	let allBeans: CatalogBean[] = [];
	let page = 0;
	const pageSize = 1000;

	while (true) {
		const { data, error } = await supabase
			.from('coffee_catalog')
			.select(
				'id, name, country, source, cost_lb, stocked, stocked_date, unstocked_date, wholesale'
			)
			.not('stocked_date', 'is', null) // Only beans we have timing data for
			.not('country', 'is', null) // Only beans with known origin
			.range(page * pageSize, (page + 1) * pageSize - 1);

		if (error) {
			console.error('ERROR fetching catalog:', error.message);
			process.exit(1);
		}

		if (!data || data.length === 0) break;
		allBeans = allBeans.concat(data as CatalogBean[]);
		if (data.length < pageSize) break;
		page++;
	}

	console.error(`Fetched ${allBeans.length} catalog beans with stocked_date.`);

	// ------------------------------------------------------------------
	// Step 2: Build week × origin buckets
	// ------------------------------------------------------------------
	const saturdays = buildWeekSaturdays(WEEKS_BACK);
	console.error(
		`Generating supply index for ${saturdays.length} weeks (${toISODate(saturdays[0])} → ${toISODate(saturdays[saturdays.length - 1])})...`
	);

	// Build rows: for each Saturday × origin, collect matching beans
	const rowMap = new Map<string, WeeklyOriginBucket>();

	for (const saturday of saturdays) {
		for (const bean of allBeans) {
			if (!bean.country) continue;
			if (!isStockedDuringWeek(bean, saturday)) continue;

			const key = `${toISODate(saturday)}::${bean.country}`;
			if (!rowMap.has(key)) {
				rowMap.set(key, { snapshotDate: saturday, origin: bean.country, beans: [] });
			}
			rowMap.get(key)!.beans.push(bean);
		}
	}

	// ------------------------------------------------------------------
	// Step 3: Convert buckets → PPI rows (retail only, process=NULL)
	// ------------------------------------------------------------------
	const ppiRows: PpiRow[] = [];

	for (const bucket of rowMap.values()) {
		const retailBeans = bucket.beans.filter((b) => !b.wholesale);
		const wholesaleBeans = bucket.beans.filter((b) => b.wholesale);

		// Retail row (wholesale_only: false)
		if (retailBeans.length >= MIN_BEANS) {
			const prices = retailBeans
				.map((b) => b.cost_lb)
				.filter((p): p is number => p !== null && p > 0);
			const suppliers = new Set(retailBeans.map((b) => b.source).filter(Boolean)).size;

			ppiRows.push({
				snapshot_date: toISODate(bucket.snapshotDate),
				origin: bucket.origin,
				process: null,
				grade: null,
				supplier_count: suppliers,
				price_min: round2(prices.length ? Math.min(...prices) : null),
				price_max: round2(prices.length ? Math.max(...prices) : null),
				price_avg: round2(prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null),
				price_median: round2(median(prices)),
				sample_size: retailBeans.length,
				wholesale_only: false,
				synthetic: true
			});
		}

		// Wholesale row (wholesale_only: true) — only if enough wholesale beans
		if (wholesaleBeans.length >= MIN_BEANS) {
			const prices = wholesaleBeans
				.map((b) => b.cost_lb)
				.filter((p): p is number => p !== null && p > 0);
			const suppliers = new Set(wholesaleBeans.map((b) => b.source).filter(Boolean)).size;

			ppiRows.push({
				snapshot_date: toISODate(bucket.snapshotDate),
				origin: bucket.origin,
				process: null,
				grade: null,
				supplier_count: suppliers,
				price_min: round2(prices.length ? Math.min(...prices) : null),
				price_max: round2(prices.length ? Math.max(...prices) : null),
				price_avg: round2(prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null),
				price_median: round2(median(prices)),
				sample_size: wholesaleBeans.length,
				wholesale_only: true,
				synthetic: true
			});
		}
	}

	// ------------------------------------------------------------------
	// Step 4: Summary
	// ------------------------------------------------------------------
	const origins = new Set(ppiRows.map((r) => r.origin));
	const weeks = new Set(ppiRows.map((r) => r.snapshot_date));

	console.error(`\nSummary:`);
	console.error(`  Total rows generated: ${ppiRows.length}`);
	console.error(`  Origins: ${origins.size} (${[...origins].sort().join(', ')})`);
	console.error(
		`  Weeks covered: ${weeks.size} (${[...weeks].sort()[0]} → ${[...weeks].sort().at(-1)})`
	);
	console.error(`  Retail rows: ${ppiRows.filter((r) => !r.wholesale_only).length}`);
	console.error(`  Wholesale rows: ${ppiRows.filter((r) => r.wholesale_only).length}`);

	// ------------------------------------------------------------------
	// Step 5: Output SQL and/or insert
	// ------------------------------------------------------------------

	if (SQL_ONLY || DRY_RUN) {
		console.log('-- =============================================================================');
		console.log('-- Supply Index Backfill: Synthetic price_index_snapshots');
		console.log(`-- Generated: ${new Date().toISOString()}`);
		console.log(`-- Rows: ${ppiRows.length} across ${origins.size} origins, ${weeks.size} weeks`);
		console.log('-- Run AFTER: supabase/migrations/20260322_backfill_supply_index.sql');
		console.log('-- =============================================================================');
		console.log('');
		console.log('BEGIN;');
		console.log('');
		for (const row of ppiRows) {
			console.log(rowToSql(row));
		}
		console.log('');
		console.log('COMMIT;');
		console.log('');
		console.log(
			`-- ${ppiRows.length} rows generated across ${origins.size} origins for ${weeks.size} weeks.`
		);

		if (DRY_RUN) {
			console.error('\nDRY RUN complete. No DB writes performed.');
		}
		return;
	}

	// ------------------------------------------------------------------
	// Step 6: Insert into DB (batched)
	// ------------------------------------------------------------------
	console.error('\nInserting into price_index_snapshots...');

	const BATCH_SIZE = 100;
	let inserted = 0;
	const skipped = 0;

	for (let i = 0; i < ppiRows.length; i += BATCH_SIZE) {
		const batch = ppiRows.slice(i, i + BATCH_SIZE);

		const { error } = await supabase.from('price_index_snapshots').upsert(batch, {
			onConflict: 'snapshot_date,origin,process,grade,wholesale_only,synthetic',
			ignoreDuplicates: true
		});

		if (error) {
			console.error(`ERROR inserting batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
			console.error('Falling back to SQL output for remaining rows...');

			// Output remaining as SQL so no data is lost
			for (const row of ppiRows.slice(i)) {
				console.log(rowToSql(row));
			}
			process.exit(1);
		}

		inserted += batch.length;
		process.stderr.write(`\r  Progress: ${inserted}/${ppiRows.length} rows`);

		// Rate-limit: 200ms pause between batches to avoid overwhelming Supabase
		if (i + BATCH_SIZE < ppiRows.length) {
			await new Promise((r) => setTimeout(r, 200));
		}
	}

	console.error(
		`\n\nDone! Inserted ${inserted} synthetic rows (${skipped} skipped as duplicates).`
	);
	console.error(
		`Generated ${ppiRows.length} rows across ${origins.size} origins for ${weeks.size} weeks.`
	);

	// Also output the SQL so Reed can review what was inserted
	console.log('\n-- SQL equivalent of what was just inserted:');
	console.log('-- (Rows already in DB; this is for your records)');
	console.log('');
	for (const row of ppiRows) {
		console.log(rowToSql(row));
	}
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
