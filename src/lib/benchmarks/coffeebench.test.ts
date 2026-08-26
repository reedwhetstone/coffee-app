import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import rawFixture from '../../../static/benchmarks/coffeebench-public-export-v2.json';
import rawLegacyPreview from '../../../static/benchmarks/coffeebench-public-export-v3.json';
import rawPreview from '../../../static/benchmarks/coffeebench-public-export-v4.json';
import rawPublished from '../../../static/benchmarks/coffeebench-public-export-v5.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	assertCoffeeBenchV1RouteIdentity,
	coffeeBenchPublicDigest,
	COFFEEBENCH_LEGACY_INDEPENDENT_SCHEMA_VERSION,
	COFFEEBENCH_PUBLISHED_ALIAS_PATH,
	COFFEEBENCH_PREVIEW_ALIAS_PATH,
	COFFEEBENCH_RESULT_PATH,
	COFFEEBENCH_SCHEMA_VERSION,
	COFFEEBENCH_V0_ARTIFACT_SHA256,
	COFFEEBENCH_V0_RESULT_CONTENT_SHA256,
	COFFEEBENCH_V1_ARTIFACT_SHA256,
	COFFEEBENCH_V1_RESULT_CONTENT_SHA256,
	isCoffeeBenchIndependentExport,
	parseCoffeeBenchPublicExport
} from './coffeebench';

function fixtureCopy(): Record<string, unknown> {
	return structuredClone(rawFixture) as Record<string, unknown>;
}

function previewCopy(): Record<string, unknown> {
	return structuredClone(rawPreview) as Record<string, unknown>;
}

function publishedCopy(): Record<string, unknown> {
	return structuredClone(rawPublished) as Record<string, unknown>;
}

function rebindPublishedResult(payload: Record<string, unknown>): void {
	const identities = payload.identities as Record<string, string>;
	const benchmark = payload.benchmark as Record<string, string>;
	const generationId = identities.generation_id;
	const resultIdMarker = `.${generationId}.`;
	const juryId = identities.result_id.slice(0, identities.result_id.indexOf(resultIdMarker));
	const { result_version: _version, identities: rawIdentities, ...material } = payload;
	const {
		result_id: _resultId,
		result_content_sha256: _resultContentSha256,
		...identityMaterial
	} = rawIdentities as Record<string, unknown>;
	const digest = coffeeBenchPublicDigest({ ...material, identities: identityMaterial });
	identities.result_content_sha256 = digest;
	identities.result_id = `${juryId}.${generationId}.${payload.status}.${digest}`;
	payload.result_version = `${benchmark.version}.${generationId}.${payload.status}.${digest.slice(0, 16)}`;
}

function firstIndependentSubject(payload: Record<string, unknown>): Record<string, unknown> {
	const slices = payload.slices as Array<{
		slice_id: string;
		track_results: Array<{ subjects: Array<Record<string, unknown>> }>;
	}>;
	const overall = slices.find((slice) => slice.slice_id === 'overall');
	if (!overall) throw new Error('preview is missing the overall slice');
	return overall.track_results[0].subjects[0];
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
	it('keeps the public download byte-identical to the published Cherry V1 export', () => {
		const aliasBytes = readFileSync(`static${COFFEEBENCH_PUBLISHED_ALIAS_PATH}`);
		const immutableBytes = readFileSync(`static${COFFEEBENCH_RESULT_PATH}`);
		expect(aliasBytes.byteLength).toBe(40_585);
		expect(immutableBytes).toEqual(aliasBytes);
		expect(createHash('sha256').update(immutableBytes).digest('hex')).toBe(
			COFFEEBENCH_V1_ARTIFACT_SHA256
		);
	});

	it('keeps the schema-v4 preview artifact available at its historical alias', () => {
		const aliasBytes = readFileSync(`static${COFFEEBENCH_PREVIEW_ALIAS_PATH}`);
		expect(aliasBytes.byteLength).toBe(26_340);
		expect(createHash('sha256').update(aliasBytes).digest('hex')).toBe(
			COFFEEBENCH_V0_ARTIFACT_SHA256
		);
	});

	it('continues to accept the complete sanitized schema-v2 Cherry fixture', () => {
		const parsed = parseCoffeeBenchPublicExport(rawFixture);

		expect(parsed.schema_version).toBe(2);
		expect(parsed.status).toBe('fixture');
		expect(parsed.calibration.agreement).not.toBeNull();
		expect(parsed.tracks.map((track) => track.track_id)).toEqual(['system']);
		expect(parsed.slices.map((slice) => slice.slice_id)).toEqual([
			'overall',
			'historical_control',
			'live_web'
		]);
	});

	it('accepts the complete sanitized schema-v3 Cherry preview', () => {
		const parsed = parseCoffeeBenchPublicExport(rawLegacyPreview);
		if (isCoffeeBenchIndependentExport(parsed)) throw new Error('expected the schema-v3 branch');

		expect(parsed.schema_version).toBe(3);
		expect(parsed.status).toBe('preview');
		expect(parsed.jury).toHaveLength(1);
		expect(parsed.calibration).toEqual({
			status: 'not_run',
			sample_pair_count: 0,
			decision_source: null,
			agreement: null
		});
		expect(
			parsed.slices.flatMap((slice) =>
				slice.track_results.flatMap((track) => track.subjects.map((result) => result.quality_score))
			)
		).toEqual(Array(12).fill(null));
	});

	it('accepts the complete schema-v4 independent-track agent-jury preview', () => {
		const parsed = parseCoffeeBenchPublicExport(rawPreview);
		if (!isCoffeeBenchIndependentExport(parsed)) throw new Error('expected the schema-v4 branch');

		expect(parsed.schema_version).toBe(COFFEEBENCH_LEGACY_INDEPENDENT_SCHEMA_VERSION);
		expect(parsed.identities.result_content_sha256).toBe(COFFEEBENCH_V0_RESULT_CONTENT_SHA256);
		expect(parsed.jury.map((judge) => judge.family).sort()).toEqual([
			'anthropic',
			'google',
			'openai'
		]);
		expect(parsed.methodology.composite_score).toBeNull();
		expect(parsed.methodology.pairwise_ballot_count).toBe(1800);
		const overall = parsed.slices.find((slice) => slice.slice_id === 'overall');
		expect(
			overall?.track_results[0].subjects.map((subject) => subject.pairwise_quality.rank)
		).toEqual([3, 2, 1, 4]);
	});

	it('accepts the published schema-v5 result and complete pairwise matrices', () => {
		const parsed = parseCoffeeBenchPublicExport(rawPublished);
		if (!isCoffeeBenchIndependentExport(parsed)) throw new Error('expected the schema-v5 branch');

		expect(parsed.schema_version).toBe(COFFEEBENCH_SCHEMA_VERSION);
		expect(parsed.status).toBe('published');
		expect(parsed.identities.result_content_sha256).toBe(COFFEEBENCH_V1_RESULT_CONTENT_SHA256);
		expect(
			parsed.slices.every((slice) => slice.track_results[0].pairwise_matchups?.length === 6)
		).toBe(true);
		expect(
			parsed.slices
				.find((slice) => slice.slice_id === 'overall')
				?.track_results[0].pairwise_matchups?.reduce(
					(total, matchup) => total + matchup.ballot_count,
					0
				)
		).toBe(1800);
		assertCoffeeBenchV1RouteIdentity(parsed);
	});

	it('rejects incomplete or internally inconsistent schema-v5 matchup data', () => {
		const missing = publishedCopy();
		const track = (
			missing.slices as Array<{
				track_results: Array<{ pairwise_matchups: Array<Record<string, unknown>> }>;
			}>
		)[0].track_results[0];
		track.pairwise_matchups.pop();
		expect(() => parseCoffeeBenchPublicExport(missing)).toThrow(
			/pairwise_matchups|matchup matrix/i
		);

		const inconsistent = publishedCopy();
		const matchup = (
			inconsistent.slices as Array<{
				track_results: Array<{ pairwise_matchups: Array<Record<string, unknown>> }>;
			}>
		)[0].track_results[0].pairwise_matchups[0];
		matchup.tie_count = (matchup.tie_count as number) + 1;
		expect(() => parseCoffeeBenchPublicExport(inconsistent)).toThrow(/counts.*reconcile/i);
	});

	it('reconciles schema-v5 overall matchup and jury-family counts with both cohorts', () => {
		const payload = publishedCopy();
		const overallMatchup = (
			payload.slices as Array<{
				track_results: Array<{ pairwise_matchups: Array<Record<string, unknown>> }>;
			}>
		)[0].track_results[0].pairwise_matchups[0];
		overallMatchup.subject_a_win_count = 106;
		overallMatchup.subject_b_win_count = 116;
		overallMatchup.subject_a_preference_share = 0.48333333;
		overallMatchup.subject_b_preference_share = 0.51666667;
		const family = (overallMatchup.jury_families as Array<Record<string, unknown>>)[0];
		family.subject_a_win_count = 38;
		family.subject_b_win_count = 48;
		family.subject_a_preference_share = 0.45;
		family.subject_b_preference_share = 0.55;
		rebindPublishedResult(payload);

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(/cohort matchup.*reconcile/i);
	});

	it('reconciles schema-v5 matchup ballots with subject quality summaries', () => {
		const payload = publishedCopy();
		const methodology = payload.methodology as { pairwise_ballot_count: number };
		methodology.pairwise_ballot_count -= 3;
		for (const sliceId of ['overall', 'historical_control'] as const) {
			const rows = (
				payload.slices as Array<{
					slice_id: string;
					track_results: Array<{
						subjects: Array<{ pairwise_quality: Record<string, number> }>;
					}>;
				}>
			).find((slice) => slice.slice_id === sliceId)?.track_results[0].subjects;
			if (!rows) throw new Error(`missing ${sliceId} rows`);
			for (const row of rows.slice(0, 3)) {
				row.pairwise_quality.model_backed_ballot_count -= 2;
				row.pairwise_quality.ballot_coverage_rate =
					row.pairwise_quality.model_backed_ballot_count /
					row.pairwise_quality.possible_ballot_count;
			}
		}
		(payload.identities as Record<string, unknown>).methodology_sha256 =
			coffeeBenchPublicDigest(methodology);
		rebindPublishedResult(payload);

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
			/pairwise matchup ballots must reconcile with the subject quality summary/i
		);
	});

	it('requires schema-v4 preview calibration state and mandatory disclosures', () => {
		const calibration = previewCopy();
		(calibration.calibration as Record<string, unknown>).status = 'complete';
		expect(() => parseCoffeeBenchPublicExport(calibration)).toThrow(/calibration/i);

		const disclosures = previewCopy();
		disclosures.limitations = (disclosures.limitations as string[]).filter(
			(limitation) => !limitation.toLowerCase().includes('independent human agreement')
		);
		expect(() => parseCoffeeBenchPublicExport(disclosures)).toThrow(/uncalibrated judging/i);
	});

	it('enforces schema-v4 matched-design coverage, ranks, and Pareto declarations', () => {
		const ranks = previewCopy();
		(firstIndependentSubject(ranks).pairwise_quality as Record<string, unknown>).rank = 1;
		expect(() => parseCoffeeBenchPublicExport(ranks)).toThrow(/pairwise quality rank must match/i);

		const trials = previewCopy();
		const trialRows = firstIndependentSubject(trials);
		(trialRows.operational as Record<string, unknown>).trial_count = 99;
		expect(() => parseCoffeeBenchPublicExport(trials)).toThrow(
			/same-track trial counts must match before deriving pairwise ballots/i
		);

		const ballots = previewCopy();
		(
			firstIndependentSubject(ballots).pairwise_quality as Record<string, unknown>
		).possible_ballot_count = 1;
		expect(() => parseCoffeeBenchPublicExport(ballots)).toThrow(
			/pairwise coverage counts and rate do not reconcile/i
		);

		const pareto = previewCopy();
		(firstIndependentSubject(pareto).pareto as Record<string, unknown>).classification =
			'dominated';
		(firstIndependentSubject(pareto).pareto as Record<string, unknown>).dominated_by = [
			'deepseek-v4-raw'
		];
		expect(() => parseCoffeeBenchPublicExport(pareto)).toThrow(
			/Pareto declaration must exactly match the available same-track metrics/i
		);
	});

	it('reconciles schema-v4 operational, rubric, token, cost, and cohort evidence', () => {
		const rubric = previewCopy();
		(
			firstIndependentSubject(rubric).absolute_rubric as Record<string, unknown>
		).unacceptable_response_rate = 0.011;
		expect(() => parseCoffeeBenchPublicExport(rubric)).toThrow(
			/unacceptable_response_rate must represent a whole attempted-trial count/i
		);

		const tokens = previewCopy();
		const tokenUsage = (firstIndependentSubject(tokens).operational as Record<string, unknown>)
			.token_usage as Record<string, Record<string, unknown>>;
		tokenUsage.total_tokens.total = (tokenUsage.total_tokens.total as number) + 1;
		expect(() => parseCoffeeBenchPublicExport(tokens)).toThrow(
			/total tokens must equal input plus output/i
		);

		const cohorts = previewCopy();
		const cohortOperational = firstIndependentSubject(cohorts).operational as Record<
			string,
			unknown
		>;
		cohortOperational.judgeable_response_count =
			(cohortOperational.judgeable_response_count as number) - 1;
		cohortOperational.judgeable_response_rate = 0.99;
		expect(() => parseCoffeeBenchPublicExport(cohorts)).toThrow(
			/cohort judgeable_response_count must reconcile with the overall operational row/i
		);

		const cohortRates = previewCopy();
		(
			firstIndependentSubject(cohortRates).absolute_rubric as Record<string, unknown>
		).unacceptable_response_rate = 0.31;
		expect(() => parseCoffeeBenchPublicExport(cohortRates)).toThrow(
			/cohort-weighted unacceptable_response_rate must reconcile with the overall rubric/i
		);
	});

	it('reconciles schema-v4 jury workload provenance', () => {
		const payload = previewCopy();
		(payload.jury as Array<Record<string, unknown>>)[0].call_count = 999;
		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
			/jury call count must cover the family share/i
		);

		const providerCalls = previewCopy();
		const judge = (providerCalls.jury as Array<Record<string, unknown>>)[0];
		judge.provider_call_count = (judge.call_count as number) + 1;
		expect(() => parseCoffeeBenchPublicExport(providerCalls)).toThrow(
			/provider calls cannot exceed judge calls/i
		);
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

	it("matches Cherry's exponent spelling for public float digests", () => {
		const digest = (value: string) => createHash('sha256').update(`${value}\n`).digest('hex');

		expect(coffeeBenchPublicDigest({ quality_score: 1e-7 })).toBe(
			digest('{"quality_score":1e-07}')
		);
		expect(coffeeBenchPublicDigest({ quality_score: 1e-6 })).toBe(
			digest('{"quality_score":1e-06}')
		);
		expect(coffeeBenchPublicDigest({ quality_score: 1e16 })).toBe(
			digest('{"quality_score":1e+16}')
		);
		expect(coffeeBenchPublicDigest({ quality_score: -0 })).toBe(digest('{"quality_score":-0.0}'));
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

		const embeddedDigest = fixtureCopy();
		(embeddedDigest.limitations as string[]).push(`calibration record sha256: ${'b'.repeat(64)}`);
		expect(() => parseCoffeeBenchPublicExport(embeddedDigest)).toThrow(
			/undeclared content digest/i
		);
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
		cachedUsage.cached_input_tokens.total = 106_001;
		cachedUsage.cached_input_tokens.per_attempted_task = 1060.01;
		expect(() => parseCoffeeBenchPublicExport(cached)).toThrow(/cached input tokens.*subset/i);

		const reasoning = fixtureCopy();
		const reasoningUsage = firstSubjectResult(reasoning).token_usage as Record<
			string,
			Record<string, unknown>
		>;
		reasoningUsage.reasoning_tokens.total = 22_401;
		reasoningUsage.reasoning_tokens.per_attempted_task = 224.01;
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

	it('reconciles every jury call count with its absolute and pairwise workload share', () => {
		const payload = fixtureCopy();
		(payload.jury as Array<Record<string, unknown>>)[0].call_count = 999;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
			/jury call count must reconcile with the family share/i
		);
	});

	it('requires matched same-track trials before deriving pairwise ballots', () => {
		const payload = fixtureCopy();
		const slices = payload.slices as Array<{
			slice_id: string;
			track_results: Array<{ subjects: Array<Record<string, unknown>> }>;
		}>;
		const overall = slices.find((slice) => slice.slice_id === 'overall');
		if (!overall) throw new Error('fixture is missing the overall slice');
		overall.track_results[0].subjects[1].trial_count = 99;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
			/same-track trial counts must match before deriving pairwise ballots/i
		);
	});

	it('reconciles overall operational totals and rates with cohort slices', () => {
		const totals = fixtureCopy();
		const totalResult = firstSubjectResult(totals);
		const totalUsage = totalResult.token_usage as Record<string, Record<string, unknown>>;
		totalUsage.total_tokens.total = 123_500;
		totalUsage.total_tokens.per_attempted_task = 1235;
		expect(() => parseCoffeeBenchPublicExport(totals)).toThrow(
			/cohort total_tokens totals must reconcile with overall subject metrics/i
		);

		const rates = fixtureCopy();
		(firstSubjectResult(rates).rates as Record<string, unknown>).unacceptable_response = 0.04;
		expect(() => parseCoffeeBenchPublicExport(rates)).toThrow(
			/cohort-weighted unacceptable_response rate must reconcile/i
		);
	});

	it.each([
		'terminal_failure',
		'unacceptable_response',
		'critical_error',
		'confidence_calibration_pass'
	] as const)('rejects %s rates that cannot represent whole trials', (rateName) => {
		const payload = fixtureCopy();
		(firstSubjectResult(payload).rates as Record<string, unknown>)[rateName] = 0.001;

		expect(() => parseCoffeeBenchPublicExport(payload)).toThrow(
			new RegExp(`${rateName} rate must represent a whole attempted-trial count`, 'i')
		);
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
		const parsed = parseCoffeeBenchPublicExport(rawPreview);
		const wrongRouteArtifact = {
			...parsed,
			benchmark: { ...parsed.benchmark, suite_id: 'another-suite' }
		};

		expect(() => assertCoffeeBenchV0RouteIdentity(wrongRouteArtifact)).toThrow(
			/unexpected benchmark identity/i
		);
	});
});
