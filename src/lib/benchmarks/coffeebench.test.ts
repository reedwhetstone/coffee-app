import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import rawFixture from '../../../static/benchmarks/coffeebench-public-export-v2.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	coffeeBenchPublicDigest,
	COFFEEBENCH_RESULT_PATH,
	COFFEEBENCH_SCHEMA_VERSION,
	COFFEEBENCH_V0_ARTIFACT_SHA256,
	COFFEEBENCH_V0_RESULT_CONTENT_SHA256,
	parseCoffeeBenchPublicExport
} from './coffeebench';

function fixtureCopy(): Record<string, unknown> {
	return structuredClone(rawFixture) as Record<string, unknown>;
}

function firstSubjectResult(payload: Record<string, unknown>): Record<string, unknown> {
	const slices = payload.slices as Array<{
		track_results: Array<{ subjects: Array<Record<string, unknown>> }>;
	}>;
	return slices[0].track_results[0].subjects[0];
}

function firstSubjectCard(payload: Record<string, unknown>): Record<string, unknown> {
	return (payload.subjects as Array<Record<string, unknown>>)[0];
}

describe('CoffeeBench public export reader', () => {
	it('keeps the public download byte-identical to the final Cherry fixture', () => {
		const aliasBytes = readFileSync('static/benchmarks/coffeebench-public-export-v2.json');
		const immutableBytes = readFileSync(`static${COFFEEBENCH_RESULT_PATH}`);
		expect(aliasBytes.byteLength).toBe(30_831);
		expect(immutableBytes).toEqual(aliasBytes);
		expect(createHash('sha256').update(immutableBytes).digest('hex')).toBe(
			COFFEEBENCH_V0_ARTIFACT_SHA256
		);
	});

	it('accepts the complete sanitized Cherry fixture', () => {
		const parsed = parseCoffeeBenchPublicExport(rawFixture);

		expect(parsed.schema_version).toBe(COFFEEBENCH_SCHEMA_VERSION);
		expect(parsed.identities.result_content_sha256).toBe(COFFEEBENCH_V0_RESULT_CONTENT_SHA256);
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

	it('replays every sanitized Cherry digest instead of accepting well-shaped substitutions', () => {
		const content = fixtureCopy();
		(content.identities as Record<string, unknown>).result_content_sha256 = '0'.repeat(64);
		expect(() => parseCoffeeBenchPublicExport(content)).toThrow(/result content.*replay/i);

		const contract = fixtureCopy();
		(contract.identities as Record<string, unknown>).public_contract_sha256 = '0'.repeat(64);
		expect(() => parseCoffeeBenchPublicExport(contract)).toThrow(/public contract.*replay/i);

		const methodology = fixtureCopy();
		(methodology.methodology as Record<string, unknown>).quality_model = 'unbound model';
		expect(() => parseCoffeeBenchPublicExport(methodology)).toThrow(/methodology.*replay/i);

		const collection = fixtureCopy();
		(collection.subjects as unknown[]).reverse();
		expect(() => parseCoffeeBenchPublicExport(collection)).toThrow(/collection.*replay/i);

		const card = fixtureCopy();
		firstSubjectCard(card).display_name = 'Digest bypass';
		(card.identities as Record<string, unknown>).subject_cards_sha256 = coffeeBenchPublicDigest(
			card.subjects
		);
		expect(() => parseCoffeeBenchPublicExport(card)).toThrow(/subject-card SHA-256.*replay/i);
	});

	it('binds publication status to calibration and immutable result identity', () => {
		const calibration = fixtureCopy();
		(calibration.calibration as Record<string, unknown>).decision_source = 'reed';
		expect(() => parseCoffeeBenchPublicExport(calibration)).toThrow(
			/fixture status requires deterministic_fixture/i
		);

		const version = fixtureCopy();
		version.result_version = '1.0.0-dev.unbound.fixture.v1';
		expect(() => parseCoffeeBenchPublicExport(version)).toThrow(/result version does not bind/i);

		const result = fixtureCopy();
		(result.identities as Record<string, unknown>).result_id = 'unbound-result.fixture';
		expect(() => parseCoffeeBenchPublicExport(result)).toThrow(/result ID does not bind/i);
	});

	it('rejects value-level source URLs and undeclared content digests', () => {
		const sourceUrl = fixtureCopy();
		(sourceUrl.limitations as string[]).push('Hidden source https://example.com/private');
		expect(() => parseCoffeeBenchPublicExport(sourceUrl)).toThrow(/source URL/i);

		const digest = fixtureCopy();
		(digest.limitations as string[]).push('a'.repeat(64));
		expect(() => parseCoffeeBenchPublicExport(digest)).toThrow(/undeclared content digest/i);
	});

	it('rejects partially-null rank, score, or interval values', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		result.rank = null;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/jointly null or populated/i);
	});

	it('rejects a declared rank that disagrees with the published quality scores', () => {
		const payload = fixtureCopy();
		firstSubjectResult(payload).rank = 1;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/quality rank must match/i);
	});

	it('rejects token total/per-task null mismatches', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		const usage = result.token_usage as Record<string, Record<string, unknown>>;
		usage.input_tokens.total = null;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/token total.*nullability/i);
	});

	it('enforces canonical token totals and cache and reasoning subset semantics', () => {
		const total = fixtureCopy();
		const totalUsage = firstSubjectResult(total).token_usage as Record<
			string,
			Record<string, unknown>
		>;
		totalUsage.total_tokens.total = 123_501;
		totalUsage.total_tokens.per_attempted_task = 1235.01;
		expect(() => parseCoffeeBenchPublicExport(total)).toThrow(/total tokens must equal input/i);

		const cached = fixtureCopy();
		const cachedUsage = firstSubjectResult(cached).token_usage as Record<
			string,
			Record<string, unknown>
		>;
		cachedUsage.cached_input_tokens.total = 102_501;
		cachedUsage.cached_input_tokens.per_attempted_task = 1025.01;
		expect(() => parseCoffeeBenchPublicExport(cached)).toThrow(/cached input tokens.*subset/i);

		const reasoning = fixtureCopy();
		const reasoningUsage = firstSubjectResult(reasoning).token_usage as Record<
			string,
			Record<string, unknown>
		>;
		reasoningUsage.reasoning_tokens.total = 21_001;
		reasoningUsage.reasoning_tokens.per_attempted_task = 210.01;
		expect(() => parseCoffeeBenchPublicExport(reasoning)).toThrow(/reasoning tokens.*subset/i);
	});

	it('reconciles per-task token and cost values with totals and attempted trials', () => {
		const tokens = fixtureCopy();
		const usage = firstSubjectResult(tokens).token_usage as Record<string, Record<string, unknown>>;
		usage.input_tokens.per_attempted_task = 1024;
		expect(() => parseCoffeeBenchPublicExport(tokens)).toThrow(
			/token total and per-task.*reconcile/i
		);

		const costs = fixtureCopy();
		const cost = firstSubjectResult(costs).cost as Record<string, Record<string, unknown>>;
		cost.normalized_cost_usd.per_attempted_task = '0.006';
		expect(() => parseCoffeeBenchPublicExport(costs)).toThrow(
			/cost total and per-task.*reconcile/i
		);
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

	it('enforces complete calibration and jury provenance relationships', () => {
		const calibration = fixtureCopy();
		const agreement = (calibration.calibration as Record<string, unknown>).agreement as Record<
			string,
			unknown
		>;
		agreement.compared_agent_ballot_count = 119;
		expect(() => parseCoffeeBenchPublicExport(calibration)).toThrow(/agent-ballot count/i);

		const unresolved = fixtureCopy();
		const unresolvedAgreement = (unresolved.calibration as Record<string, unknown>)
			.agreement as Record<string, unknown>;
		unresolvedAgreement.agent_majority_decision_count = 0;
		unresolvedAgreement.agent_majority_unresolved_count = 40;
		expect(() => parseCoffeeBenchPublicExport(unresolved)).toThrow(
			/rate must be null exactly when no majority decisions/i
		);

		const jury = fixtureCopy();
		(jury.jury as Array<Record<string, unknown>>)[0].provider_call_count = 1;
		expect(() => parseCoffeeBenchPublicExport(jury)).toThrow(/fixture jury cannot claim provider/i);
	});

	it('rejects Pareto labels that contradict the exact same-track public metrics', () => {
		const payload = fixtureCopy();
		const result = firstSubjectResult(payload);
		const secondSubject = (
			(
				payload.slices as Array<{
					track_results: Array<{ subjects: Array<Record<string, unknown>> }>;
				}>
			)[0].track_results[0].subjects[1] as Record<string, unknown>
		).subject_id;
		result.pareto = { classification: 'dominated', dominated_by: [secondSubject] };

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
			/Pareto declaration.*exactly match/i
		);
	});

	it('rejects an artifact from a different benchmark identity on the v0 route', () => {
		const parsed = parseCoffeeBenchPublicExport(rawFixture);
		const wrongRouteArtifact = {
			...parsed,
			benchmark: { ...parsed.benchmark, suite_id: 'another-suite' }
		};

		expect(() => assertCoffeeBenchV0RouteIdentity(wrongRouteArtifact)).toThrow(
			/unexpected benchmark identity/i
		);
	});
});
