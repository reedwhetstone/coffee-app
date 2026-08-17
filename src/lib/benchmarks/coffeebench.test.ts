import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import rawFixture from '../../../static/benchmarks/coffeebench-public-export-v2.json';
import { COFFEEBENCH_SCHEMA_VERSION, parseCoffeeBenchPublicExport } from './coffeebench';

function fixtureCopy(): Record<string, unknown> {
	return structuredClone(rawFixture) as Record<string, unknown>;
}

function firstSubjectResult(payload: Record<string, unknown>): Record<string, unknown> {
	const slices = payload.slices as Array<{
		track_results: Array<{ subjects: Array<Record<string, unknown>> }>;
	}>;
	return slices[0].track_results[0].subjects[0];
}

describe('CoffeeBench public export reader', () => {
	it('keeps the public download byte-identical to the final Cherry fixture', () => {
		const bytes = readFileSync('static/benchmarks/coffeebench-public-export-v2.json');
		expect(bytes.byteLength).toBe(30_568);
		expect(createHash('sha256').update(bytes).digest('hex')).toBe(
			'58d167a58e20c5fed17e6c299c6c872f19fcba39ccbf6c3893c5bc45b833416f'
		);
	});

	it('accepts the complete sanitized Cherry fixture', () => {
		const parsed = parseCoffeeBenchPublicExport(rawFixture);

		expect(parsed.schema_version).toBe(COFFEEBENCH_SCHEMA_VERSION);
		expect(parsed.tracks.map((track) => track.track_id)).toEqual(['system']);
		expect(parsed.slices.map((slice) => slice.slice_id)).toEqual([
			'overall',
			'historical_control',
			'live_web'
		]);
	});

	it('rejects unknown schema versions', () => {
		const payload = fixtureCopy();
		payload.schema_version = COFFEEBENCH_SCHEMA_VERSION + 1;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/schema_version/i);
	});

	it.each(['evaluator_guardrails', 'prompt', 'source_locator', 'private_provider_payload'])(
		'rejects sealed or evaluator-only %s fields before rendering',
		(field) => {
			const payload = fixtureCopy();
			(payload.subjects as Array<Record<string, unknown>>)[0][field] = 'must never publish';

			expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
				/sealed or evaluator-only field/i
			);
		}
	);

	it('rejects malformed and uppercase digests', () => {
		const malformed = fixtureCopy();
		(malformed.identities as Record<string, unknown>).methodology_sha256 = 'abc123';
		expect(() => parseCoffeeBenchPublicExport(malformed)).toThrow(/sha-256/i);

		const uppercase = fixtureCopy();
		(uppercase.identities as Record<string, unknown>).methodology_sha256 = 'A'.repeat(64);
		expect(() => parseCoffeeBenchPublicExport(uppercase)).toThrow(/sha-256/i);
	});

	it('rejects partially-null rank, score, or interval values', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		result.rank = null;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/jointly null or populated/i);
	});

	it('rejects token total/per-task null mismatches', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		const usage = result.token_usage as Record<string, Record<string, unknown>>;
		usage.input_tokens.total = null;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/token total.*nullability/i);
	});

	it('rejects cost total/per-task null mismatches instead of substituting zero', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		const cost = result.cost as Record<string, Record<string, unknown>>;
		cost.provider_billed_usd.total = null;
		cost.provider_billed_usd.per_attempted_task = '0';

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/cost total.*nullability/i);
	});

	it('rejects partially-null latency percentiles', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		const latency = result.latency as Record<string, Record<string, unknown>>;
		latency.end_to_end_ms.p95 = null;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/p50 and p95.*nullability/i);
	});
});
