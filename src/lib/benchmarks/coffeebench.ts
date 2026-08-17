import { z } from 'zod';

export const COFFEEBENCH_SCHEMA_VERSION = 2 as const;
export const COFFEEBENCH_V0_BENCHMARK_NAME = 'CoffeeBench' as const;
export const COFFEEBENCH_V0_BENCHMARK_VERSION = '1.0.0-dev' as const;
export const COFFEEBENCH_V0_SUITE_ID = 'deepseek-v4-initial' as const;
export const COFFEEBENCH_V0_JURY_ID = 'openclaw-jury-2026-08-16' as const;
export const COFFEEBENCH_V0_RELEASE_DATE = '2026-08-17' as const;
export const COFFEEBENCH_V0_ARTIFACT_SHA256 =
	'9f409d8cf57deda777a1033efcbbab7ad8d968ddc73342e4c3bf8834c1436844' as const;
export const COFFEEBENCH_V0_RESULT_CONTENT_SHA256 =
	'a8bc2608867ba7773c7262eef50049a38819c964c4ade6ce661c2616000bfd23' as const;
export const COFFEEBENCH_V0_RESULT_VERSION =
	'1.0.0-dev.coffeebench-fixture-generation.fixture.a8bc2608867ba777' as const;
export const COFFEEBENCH_RESULT_PATH = `/benchmarks/coffeebench-v0/results/${COFFEEBENCH_V0_RESULT_VERSION}/${COFFEEBENCH_V0_RESULT_CONTENT_SHA256}.json`;
export const COFFEEBENCH_FIXTURE_ALIAS_PATH = '/benchmarks/coffeebench-public-export-v2.json';

const SHA256 = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]*$/;
const RESULT_VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const DECIMAL_USD = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const PUBLIC_CONTRACT = { schema_version: 2, contract: 'coffeebench.public-export' } as const;
const publicDigestKeys = new Set([
	'result_content_sha256',
	'public_contract_sha256',
	'methodology_sha256',
	'subject_cards_sha256',
	'card_sha256'
]);

// SHA-256 is implemented here instead of using node:crypto so the strict reader remains usable in
// both server and browser bundles. It hashes Cherry's UTF-8 canonical JSON bytes exactly.
const SHA256_ROUND_CONSTANTS = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
] as const;

function rotateRight(value: number, amount: number): number {
	return (value >>> amount) | (value << (32 - amount));
}

function sha256Utf8(value: string): string {
	const input = new TextEncoder().encode(value);
	const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
	const bytes = new Uint8Array(paddedLength);
	bytes.set(input);
	bytes[input.length] = 0x80;
	const bitLength = BigInt(input.length) * 8n;
	for (let index = 0; index < 8; index += 1) {
		bytes[paddedLength - 1 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
	}

	const hash = new Uint32Array([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
	]);
	const words = new Uint32Array(64);
	for (let offset = 0; offset < bytes.length; offset += 64) {
		for (let index = 0; index < 16; index += 1) {
			const wordOffset = offset + index * 4;
			words[index] =
				(bytes[wordOffset] << 24) |
				(bytes[wordOffset + 1] << 16) |
				(bytes[wordOffset + 2] << 8) |
				bytes[wordOffset + 3];
		}
		for (let index = 16; index < 64; index += 1) {
			const s0 =
				rotateRight(words[index - 15], 7) ^
				rotateRight(words[index - 15], 18) ^
				(words[index - 15] >>> 3);
			const s1 =
				rotateRight(words[index - 2], 17) ^
				rotateRight(words[index - 2], 19) ^
				(words[index - 2] >>> 10);
			words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
		}

		let [a, b, c, d, e, f, g, h] = hash;
		for (let index = 0; index < 64; index += 1) {
			const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
			const choose = (e & f) ^ (~e & g);
			const temporary1 = (h + sum1 + choose + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0;
			const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
			const majority = (a & b) ^ (a & c) ^ (b & c);
			const temporary2 = (sum0 + majority) >>> 0;
			h = g;
			g = f;
			f = e;
			e = (d + temporary1) >>> 0;
			d = c;
			c = b;
			b = a;
			a = (temporary1 + temporary2) >>> 0;
		}
		hash[0] = (hash[0] + a) >>> 0;
		hash[1] = (hash[1] + b) >>> 0;
		hash[2] = (hash[2] + c) >>> 0;
		hash[3] = (hash[3] + d) >>> 0;
		hash[4] = (hash[4] + e) >>> 0;
		hash[5] = (hash[5] + f) >>> 0;
		hash[6] = (hash[6] + g) >>> 0;
		hash[7] = (hash[7] + h) >>> 0;
	}

	return Array.from(hash, (word) => word.toString(16).padStart(8, '0')).join('');
}

const pythonFloatFields = new Set([
	'agent_majority_agreement_rate',
	'confidence_calibration_pass',
	'critical_error',
	'exact_agreement_rate',
	'lower',
	'per_attempted_task',
	'quality_score',
	'terminal_failure',
	'tie_value',
	'unacceptable_response',
	'upper'
]);

function canonicalJson(value: unknown, key: string | null = null): string {
	if (value === null || typeof value === 'boolean' || typeof value === 'number') {
		if (typeof value === 'number' && Number.isInteger(value) && key && pythonFloatFields.has(key)) {
			return `${value}.0`;
		}
		const serialized = JSON.stringify(value);
		if (serialized === undefined) throw new Error('canonical JSON contains an unsupported value');
		return serialized;
	}
	if (typeof value === 'string') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((child) => canonicalJson(child, key)).join(',')}]`;
	if (typeof value === 'object') {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([childKey, child]) => `${JSON.stringify(childKey)}:${canonicalJson(child, childKey)}`)
			.join(',')}}`;
	}
	throw new Error('canonical JSON contains an unsupported value');
}

export function coffeeBenchPublicDigest(value: unknown): string {
	return sha256Utf8(`${canonicalJson(value)}\n`);
}

function resultContentMaterial(value: unknown): Record<string, unknown> {
	const artifact = value as Record<string, unknown>;
	const { result_version: _version, identities: rawIdentities, ...material } = artifact;
	const identities = rawIdentities as Record<string, unknown>;
	const {
		result_id: _resultId,
		result_content_sha256: _resultContentDigest,
		...identityMaterial
	} = identities;
	return { ...material, identities: identityMaterial };
}

const forbiddenPublicKeys = new Set([
	'artifact_sha256',
	'calibration_record_sha256',
	'case_id',
	'case_ids',
	'criterion',
	'critical_errors',
	'evaluation_atom_id',
	'evaluation_atoms',
	'evaluator_guardrails',
	'evidence',
	'judge_id',
	'must_not_miss_signals',
	'private_provider_payload',
	'private_request_mapping',
	'prompt',
	'raw_judge_prompt',
	'raw_output',
	'rationale',
	'response',
	'generation_manifest_sha256',
	'source_family',
	'source_family_id',
	'source_locator',
	'source_targets'
]);

const trackIdSchema = z.enum(['model', 'system']);
const sliceIdSchema = z.enum(['overall', 'historical_control', 'live_web']);
const juryFamilySchema = z.enum(['openai', 'google', 'anthropic']);
const sha256Schema = z.string().regex(SHA256, 'must be a lowercase SHA-256 digest');
const nullableCountSchema = z.number().int().nonnegative().nullable();
const nullableMetricSchema = z.number().finite().nonnegative().nullable();
const decimalUsdSchema = z
	.string()
	.regex(DECIMAL_USD, 'must be a non-negative decimal string')
	.nullable();

const intervalSchema = z
	.object({
		lower: z.number().finite().nullable(),
		upper: z.number().finite().nullable()
	})
	.strict()
	.superRefine((interval, context) => {
		if ((interval.lower === null) !== (interval.upper === null)) {
			context.addIssue({
				code: 'custom',
				message: 'quality interval bounds must both be null or both be populated'
			});
		}
		if (interval.lower !== null && interval.upper !== null && interval.lower > interval.upper) {
			context.addIssue({ code: 'custom', message: 'quality interval lower exceeds upper' });
		}
	});

const totalAndPerTaskSchema = z
	.object({
		total: nullableCountSchema,
		per_attempted_task: nullableMetricSchema
	})
	.strict()
	.superRefine((metric, context) => {
		if ((metric.total === null) !== (metric.per_attempted_task === null)) {
			context.addIssue({
				code: 'custom',
				message: 'token total and per-attempted-task value must share nullability'
			});
		}
	});

const costMetricSchema = z
	.object({
		total: decimalUsdSchema,
		per_attempted_task: decimalUsdSchema
	})
	.strict()
	.superRefine((metric, context) => {
		if ((metric.total === null) !== (metric.per_attempted_task === null)) {
			context.addIssue({
				code: 'custom',
				message: 'cost total and per-attempted-task value must share nullability'
			});
		}
	});

const percentileSchema = z
	.object({
		p50: nullableCountSchema,
		p95: nullableCountSchema
	})
	.strict()
	.superRefine((metric, context) => {
		if ((metric.p50 === null) !== (metric.p95 === null)) {
			context.addIssue({
				code: 'custom',
				message: 'p50 and p95 must share nullability'
			});
		}
		if (metric.p50 !== null && metric.p95 !== null && metric.p50 > metric.p95) {
			context.addIssue({ code: 'custom', message: 'p50 cannot exceed p95' });
		}
	});

const paretoSchema = z
	.object({
		classification: z.enum(['frontier', 'dominated', 'unavailable']),
		dominated_by: z.array(z.string().regex(IDENTIFIER)).max(100)
	})
	.strict()
	.superRefine((pareto, context) => {
		if (pareto.classification === 'dominated' && pareto.dominated_by.length === 0) {
			context.addIssue({ code: 'custom', message: 'dominated subjects must name a dominator' });
		}
		if (pareto.classification !== 'dominated' && pareto.dominated_by.length !== 0) {
			context.addIssue({
				code: 'custom',
				message: 'only dominated subjects may name a dominator'
			});
		}
	});

const subjectResultSchema = z
	.object({
		subject_id: z.string().regex(IDENTIFIER),
		rank: z.number().int().positive().nullable(),
		quality_score: z.number().finite().nullable(),
		quality_interval_95: intervalSchema,
		trial_count: z.number().int().nonnegative(),
		token_usage: z
			.object({
				provenance: z.enum(['exact', 'provider_derived', 'estimated', 'mixed']),
				input_tokens: totalAndPerTaskSchema,
				cached_input_tokens: totalAndPerTaskSchema,
				reasoning_tokens: totalAndPerTaskSchema,
				output_tokens: totalAndPerTaskSchema,
				total_tokens: totalAndPerTaskSchema
			})
			.strict(),
		cost: z
			.object({
				provider_billed_usd: costMetricSchema,
				normalized_cost_usd: costMetricSchema
			})
			.strict(),
		latency: z
			.object({
				end_to_end_ms: percentileSchema,
				tool_ms: percentileSchema
			})
			.strict(),
		rates: z
			.object({
				terminal_failure: z.number().finite().min(0).max(1),
				unacceptable_response: z.number().finite().min(0).max(1),
				critical_error: z.number().finite().min(0).max(1),
				confidence_calibration_pass: z.number().finite().min(0).max(1)
			})
			.strict(),
		pareto: paretoSchema
	})
	.strict()
	.superRefine((result, context) => {
		const intervalAvailable = result.quality_interval_95.lower !== null;
		const qualityFields = [result.rank !== null, result.quality_score !== null, intervalAvailable];
		if (!qualityFields.every(Boolean) && qualityFields.some(Boolean)) {
			context.addIssue({
				code: 'custom',
				message: 'rank, quality score, and quality interval must be jointly null or populated'
			});
		}
		if (
			result.quality_score !== null &&
			result.quality_interval_95.lower !== null &&
			result.quality_interval_95.upper !== null &&
			(result.quality_score < result.quality_interval_95.lower ||
				result.quality_score > result.quality_interval_95.upper)
		) {
			context.addIssue({ code: 'custom', message: 'quality score must fall within its interval' });
		}
	});

const publicExportSchema = z
	.object({
		schema_version: z.literal(COFFEEBENCH_SCHEMA_VERSION),
		result_version: z.string().regex(RESULT_VERSION),
		benchmark: z
			.object({
				name: z.string().min(1),
				version: z.string().regex(RESULT_VERSION),
				suite_id: z.string().regex(IDENTIFIER)
			})
			.strict(),
		status: z.enum(['fixture', 'provisional']),
		identities: z
			.object({
				result_id: z.string().regex(IDENTIFIER),
				generation_id: z.string().regex(IDENTIFIER),
				result_content_sha256: sha256Schema,
				public_contract_sha256: sha256Schema,
				methodology_sha256: sha256Schema,
				subject_cards_sha256: sha256Schema
			})
			.strict(),
		methodology: z
			.object({
				case_count: z.number().int().positive(),
				subject_trial_count: z.number().int().positive(),
				jury_family_count: z.number().int().positive(),
				absolute_evaluation_count: z.number().int().positive(),
				pairwise_ballot_count: z.number().int().positive(),
				quality_model: z.string().min(1),
				tie_value: z.number().finite().min(0).max(1),
				uncertainty: z.string().min(1),
				unacceptable_response_rule: z.string().min(1),
				critical_error_rule: z.string().min(1),
				confidence_calibration_rule: z.string().min(1),
				pareto_rule: z.string().min(1),
				null_semantics: z.string().min(1)
			})
			.strict(),
		tracks: z
			.array(
				z
					.object({
						track_id: trackIdSchema,
						label: z.string().min(1),
						description: z.string().min(1)
					})
					.strict()
			)
			.min(1)
			.max(2),
		subjects: z
			.array(
				z
					.object({
						subject_id: z.string().regex(IDENTIFIER),
						display_name: z.string().min(1),
						track: trackIdSchema,
						evaluator_track: trackIdSchema,
						harness_family: z.enum(['controlled_raw', 'pi', 'purveyors']),
						capabilities: z.array(z.string().min(1)).max(100),
						model: z
							.object({
								provider: z.string().min(1),
								model: z.string().min(1),
								revision: z.string().min(1),
								quantization: z.string().min(1).nullable()
							})
							.strict(),
						card_sha256: sha256Schema
					})
					.strict()
			)
			.min(1),
		slices: z
			.array(
				z
					.object({
						slice_id: sliceIdSchema,
						label: z.string().min(1),
						track_results: z
							.array(
								z
									.object({
										track: trackIdSchema,
										subjects: z.array(subjectResultSchema)
									})
									.strict()
							)
							.min(1)
							.max(2)
					})
					.strict()
			)
			.length(3),
		jury: z
			.array(
				z
					.object({
						family: juryFamilySchema,
						call_count: z.number().int().nonnegative(),
						provider_call_count: z.number().int().nonnegative(),
						latency_ms: percentileSchema,
						provider_billed_usd_total: decimalUsdSchema,
						normalized_cost_usd_total: decimalUsdSchema
					})
					.strict()
			)
			.length(3),
		calibration: z
			.object({
				sample_pair_count: z.literal(40),
				decision_source: z.enum(['reed', 'deterministic_fixture']),
				agreement: z
					.object({
						compared_pair_count: z.number().int().nonnegative(),
						compared_agent_ballot_count: z.number().int().nonnegative(),
						exact_agreement_rate: z.number().finite().min(0).max(1),
						agent_majority_decision_count: z.number().int().nonnegative(),
						agent_majority_unresolved_count: z.number().int().nonnegative(),
						agent_majority_agreement_rate: z.number().finite().min(0).max(1).nullable(),
						per_family: z
							.array(
								z
									.object({
										family: juryFamilySchema,
										compared_ballot_count: z.number().int().nonnegative(),
										exact_agreement_rate: z.number().finite().min(0).max(1)
									})
									.strict()
							)
							.length(3)
					})
					.strict()
			})
			.strict(),
		limitations: z.array(z.string().min(1)).min(1)
	})
	.strict()
	.superRefine((artifact, context) => {
		function issue(path: (string | number)[], message: string) {
			context.addIssue({ code: 'custom', path, message });
		}

		function requireExactSet(values: string[], expected: string[], path: (string | number)[]) {
			if (
				values.length !== expected.length ||
				new Set(values).size !== values.length ||
				values.some((value) => !expected.includes(value))
			) {
				context.addIssue({
					code: 'custom',
					path,
					message: `must contain ${expected.join(', ')} once`
				});
			}
		}

		function approximatelyEqual(left: number, right: number, tolerance = 1e-7): boolean {
			return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance;
		}

		function rateRepresentsCount(rate: number, count: number): boolean {
			return approximatelyEqual(rate * count, Math.round(rate * count), 0.000_01);
		}

		function compareDecimal(left: string, right: string): number {
			function parts(value: string): [string, string] {
				const [integer, fraction = ''] = value.split('.');
				return [integer.replace(/^0+(?=\d)/, ''), fraction.replace(/0+$/, '')];
			}
			const [leftInteger, leftFraction] = parts(left);
			const [rightInteger, rightFraction] = parts(right);
			if (leftInteger.length !== rightInteger.length) {
				return leftInteger.length < rightInteger.length ? -1 : 1;
			}
			if (leftInteger !== rightInteger) return leftInteger < rightInteger ? -1 : 1;
			const length = Math.max(leftFraction.length, rightFraction.length);
			const normalizedLeft = leftFraction.padEnd(length, '0');
			const normalizedRight = rightFraction.padEnd(length, '0');
			if (normalizedLeft === normalizedRight) return 0;
			return normalizedLeft < normalizedRight ? -1 : 1;
		}

		if (artifact.identities.public_contract_sha256 !== coffeeBenchPublicDigest(PUBLIC_CONTRACT)) {
			issue(['identities', 'public_contract_sha256'], 'public contract SHA-256 does not replay');
		}
		if (artifact.identities.methodology_sha256 !== coffeeBenchPublicDigest(artifact.methodology)) {
			issue(['identities', 'methodology_sha256'], 'methodology SHA-256 does not replay');
		}
		if (artifact.identities.subject_cards_sha256 !== coffeeBenchPublicDigest(artifact.subjects)) {
			issue(
				['identities', 'subject_cards_sha256'],
				'subject-card collection SHA-256 does not replay'
			);
		}
		artifact.subjects.forEach((subject, index) => {
			const { card_sha256: _digest, ...card } = subject;
			if (subject.card_sha256 !== coffeeBenchPublicDigest(card)) {
				issue(['subjects', index, 'card_sha256'], 'subject-card SHA-256 does not replay');
			}
		});

		const resultContentDigest = coffeeBenchPublicDigest(resultContentMaterial(artifact));
		if (artifact.identities.result_content_sha256 !== resultContentDigest) {
			issue(
				['identities', 'result_content_sha256'],
				'public result content SHA-256 does not replay'
			);
		}
		const expectedResultVersion = `${artifact.benchmark.version}.${artifact.identities.generation_id}.${artifact.status}.${resultContentDigest.slice(0, 16)}`;
		if (artifact.result_version !== expectedResultVersion) {
			issue(
				['result_version'],
				'result version does not bind benchmark, generation, status, and content'
			);
		}
		if (
			!artifact.identities.result_id.endsWith(
				`.${artifact.identities.generation_id}.${artifact.status}.${resultContentDigest}`
			)
		) {
			issue(['identities', 'result_id'], 'result ID does not bind generation, status, and content');
		}
		const expectedDecisionSource = artifact.status === 'fixture' ? 'deterministic_fixture' : 'reed';
		if (artifact.calibration.decision_source !== expectedDecisionSource) {
			issue(
				['calibration', 'decision_source'],
				`${artifact.status} status requires ${expectedDecisionSource} calibration provenance`
			);
		}

		const publishedTracks = artifact.tracks.map((track) => track.track_id);
		if (new Set(publishedTracks).size !== publishedTracks.length) {
			context.addIssue({ code: 'custom', path: ['tracks'], message: 'track IDs must be unique' });
		}
		requireExactSet(
			artifact.slices.map((slice) => slice.slice_id),
			['overall', 'historical_control', 'live_web'],
			['slices']
		);
		requireExactSet(
			artifact.jury.map((judge) => judge.family),
			['openai', 'google', 'anthropic'],
			['jury']
		);
		requireExactSet(
			artifact.calibration.agreement.per_family.map((family) => family.family),
			['openai', 'google', 'anthropic'],
			['calibration', 'agreement', 'per_family']
		);

		const subjectById = new Map(artifact.subjects.map((subject) => [subject.subject_id, subject]));
		if (subjectById.size !== artifact.subjects.length) {
			context.addIssue({
				code: 'custom',
				path: ['subjects'],
				message: 'subject IDs must be unique'
			});
		}
		artifact.subjects.forEach((subject, index) => {
			if (!publishedTracks.includes(subject.track)) {
				context.addIssue({
					code: 'custom',
					path: ['subjects', index, 'track'],
					message: 'subject comparison track must be published'
				});
			}
		});

		if (artifact.methodology.jury_family_count !== artifact.jury.length) {
			issue(
				['methodology', 'jury_family_count'],
				'jury family count must match the published jury rows'
			);
		}
		artifact.jury.forEach((judge, index) => {
			if (judge.provider_call_count > judge.call_count) {
				issue(['jury', index, 'provider_call_count'], 'provider calls cannot exceed judge calls');
			}
			if (judge.call_count > 0 !== (judge.latency_ms.p50 !== null)) {
				issue(['jury', index, 'latency_ms'], 'judge latency availability must match call count');
			}
			if (artifact.status === 'fixture') {
				if (judge.provider_call_count !== 0) {
					issue(['jury', index, 'provider_call_count'], 'fixture jury cannot claim provider calls');
				}
				if (judge.provider_billed_usd_total !== null || judge.normalized_cost_usd_total !== null) {
					issue(['jury', index], 'fixture jury cannot claim measured provider costs');
				}
			} else if (judge.call_count === 0 || judge.provider_call_count !== judge.call_count) {
				issue(
					['jury', index, 'provider_call_count'],
					'provisional jury calls must all bind live provider calls'
				);
			}
		});

		const agreement = artifact.calibration.agreement;
		if (agreement.compared_pair_count !== artifact.calibration.sample_pair_count) {
			issue(
				['calibration', 'agreement', 'compared_pair_count'],
				'calibration agreement must cover the complete sample'
			);
		}
		if (
			agreement.agent_majority_decision_count + agreement.agent_majority_unresolved_count !==
			agreement.compared_pair_count
		) {
			issue(
				['calibration', 'agreement'],
				'calibration majority decision and unresolved counts must cover every compared pair'
			);
		}
		if (
			(agreement.agent_majority_decision_count === 0) !==
			(agreement.agent_majority_agreement_rate === null)
		) {
			issue(
				['calibration', 'agreement', 'agent_majority_agreement_rate'],
				'majority agreement rate must be null exactly when no majority decisions exist'
			);
		}
		const familyBallotCount = agreement.per_family.reduce(
			(total, family) => total + family.compared_ballot_count,
			0
		);
		if (
			agreement.compared_agent_ballot_count !== familyBallotCount ||
			familyBallotCount !== artifact.calibration.sample_pair_count * artifact.jury.length
		) {
			issue(
				['calibration', 'agreement', 'compared_agent_ballot_count'],
				'calibration agent-ballot count must equal the complete sample across every jury family'
			);
		}
		for (const [index, family] of agreement.per_family.entries()) {
			if (family.compared_ballot_count !== artifact.calibration.sample_pair_count) {
				issue(
					['calibration', 'agreement', 'per_family', index, 'compared_ballot_count'],
					'each jury family must cover the complete calibration sample'
				);
			}
			if (!rateRepresentsCount(family.exact_agreement_rate, family.compared_ballot_count)) {
				issue(
					['calibration', 'agreement', 'per_family', index, 'exact_agreement_rate'],
					'family agreement rate must represent a whole ballot count'
				);
			}
		}
		if (!rateRepresentsCount(agreement.exact_agreement_rate, familyBallotCount)) {
			issue(
				['calibration', 'agreement', 'exact_agreement_rate'],
				'exact agreement rate must represent a whole agent-ballot count'
			);
		}
		if (
			agreement.agent_majority_agreement_rate !== null &&
			!rateRepresentsCount(
				agreement.agent_majority_agreement_rate,
				agreement.agent_majority_decision_count
			)
		) {
			issue(
				['calibration', 'agreement', 'agent_majority_agreement_rate'],
				'majority agreement rate must represent a whole sampled-pair count'
			);
		}
		if (familyBallotCount > 0) {
			const weightedFamilyAgreement =
				agreement.per_family.reduce(
					(total, family) => total + family.exact_agreement_rate * family.compared_ballot_count,
					0
				) / familyBallotCount;
			if (!approximatelyEqual(agreement.exact_agreement_rate, weightedFamilyAgreement)) {
				issue(
					['calibration', 'agreement', 'exact_agreement_rate'],
					'exact agreement rate must reconcile with the jury-family rows'
				);
			}
		}

		artifact.slices.forEach((slice, sliceIndex) => {
			requireExactSet(
				slice.track_results.map((track) => track.track),
				publishedTracks,
				['slices', sliceIndex, 'track_results']
			);
			slice.track_results.forEach((trackResult, trackIndex) => {
				const expectedSubjects = artifact.subjects
					.filter((subject) => subject.track === trackResult.track)
					.map((subject) => subject.subject_id)
					.sort();
				const actualSubjects = trackResult.subjects.map((subject) => subject.subject_id).sort();
				if (
					new Set(actualSubjects).size !== actualSubjects.length ||
					JSON.stringify(expectedSubjects) !== JSON.stringify(actualSubjects)
				) {
					context.addIssue({
						code: 'custom',
						path: ['slices', sliceIndex, 'track_results', trackIndex, 'subjects'],
						message: 'track results must contain every subject from that track exactly once'
					});
				}
				trackResult.subjects.forEach((result, resultIndex) => {
					if (
						result.pareto.classification === 'dominated' &&
						result.pareto.dominated_by.includes(result.subject_id)
					) {
						context.addIssue({
							code: 'custom',
							path: [
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'pareto',
								'dominated_by'
							],
							message: 'a subject cannot Pareto-dominate itself'
						});
					}
					for (const dominator of result.pareto.dominated_by) {
						const dominatorCard = subjectById.get(dominator);
						if (!dominatorCard || dominatorCard.track !== trackResult.track) {
							context.addIssue({
								code: 'custom',
								path: [
									'slices',
									sliceIndex,
									'track_results',
									trackIndex,
									'subjects',
									resultIndex,
									'pareto',
									'dominated_by'
								],
								message: 'Pareto dominators must exist in the same track'
							});
						}
					}
				});

				const rankedScores = [
					...new Set(
						trackResult.subjects
							.map((row) => row.quality_score)
							.filter((score): score is number => score !== null)
					)
				].sort((left, right) => right - left);
				const scoreRanks = new Map(rankedScores.map((score, index) => [score, index + 1]));
				for (const [resultIndex, result] of trackResult.subjects.entries()) {
					if (
						result.quality_score !== null &&
						result.rank !== scoreRanks.get(result.quality_score)
					) {
						issue(
							['slices', sliceIndex, 'track_results', trackIndex, 'subjects', resultIndex, 'rank'],
							'quality rank must match the declared quality scores'
						);
					}

					const usage = result.token_usage;
					if (artifact.status === 'fixture' && result.cost.provider_billed_usd.total !== null) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'cost',
								'provider_billed_usd'
							],
							'fixture subject results cannot claim provider-billed execution cost'
						);
					}
					const inputAvailable = usage.input_tokens.total !== null;
					const outputAvailable = usage.output_tokens.total !== null;
					const totalAvailable = usage.total_tokens.total !== null;
					if (inputAvailable !== outputAvailable || inputAvailable !== totalAvailable) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'token_usage'
							],
							'canonical input, output, and total token availability must remain joint'
						);
					}
					if (
						usage.input_tokens.total !== null &&
						usage.output_tokens.total !== null &&
						usage.total_tokens.total !== usage.input_tokens.total + usage.output_tokens.total
					) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'token_usage',
								'total_tokens'
							],
							'canonical total tokens must equal input plus output tokens'
						);
					}
					if (
						usage.input_tokens.per_attempted_task !== null &&
						usage.output_tokens.per_attempted_task !== null &&
						usage.total_tokens.per_attempted_task !== null &&
						!approximatelyEqual(
							usage.total_tokens.per_attempted_task,
							usage.input_tokens.per_attempted_task + usage.output_tokens.per_attempted_task
						)
					) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'token_usage',
								'total_tokens'
							],
							'canonical per-task total tokens must equal input plus output tokens'
						);
					}
					if (
						usage.cached_input_tokens.total !== null &&
						(usage.input_tokens.total === null ||
							usage.cached_input_tokens.total > usage.input_tokens.total)
					) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'token_usage',
								'cached_input_tokens'
							],
							'cached input tokens must be a subset of canonical input tokens'
						);
					}
					if (
						usage.reasoning_tokens.total !== null &&
						(usage.output_tokens.total === null ||
							usage.reasoning_tokens.total > usage.output_tokens.total)
					) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'token_usage',
								'reasoning_tokens'
							],
							'reasoning tokens must be a subset of canonical output tokens'
						);
					}
					for (const [metricName, metric] of Object.entries(usage)) {
						if (metricName === 'provenance' || typeof metric === 'string') continue;
						if (
							metric.total !== null &&
							metric.per_attempted_task !== null &&
							(result.trial_count === 0 ||
								!approximatelyEqual(metric.per_attempted_task, metric.total / result.trial_count))
						) {
							issue(
								[
									'slices',
									sliceIndex,
									'track_results',
									trackIndex,
									'subjects',
									resultIndex,
									'token_usage',
									metricName
								],
								'token total and per-task value must reconcile with attempted trials'
							);
						}
					}
					for (const [metricName, metric] of Object.entries(result.cost)) {
						if (
							metric.total !== null &&
							metric.per_attempted_task !== null &&
							(result.trial_count === 0 ||
								!approximatelyEqual(
									Number(metric.per_attempted_task),
									Number(metric.total) / result.trial_count
								))
						) {
							issue(
								[
									'slices',
									sliceIndex,
									'track_results',
									trackIndex,
									'subjects',
									resultIndex,
									'cost',
									metricName
								],
								'cost total and per-task value must reconcile with attempted trials'
							);
						}
					}
				}

				const availablePareto = new Map<
					string,
					{ quality: number; cost: string; latency: number }
				>();
				for (const result of trackResult.subjects) {
					const cost = result.cost.normalized_cost_usd.per_attempted_task;
					const latency = result.latency.end_to_end_ms.p50;
					if (result.quality_score !== null && cost !== null && latency !== null) {
						availablePareto.set(result.subject_id, {
							quality: result.quality_score,
							cost,
							latency
						});
					}
				}
				for (const [resultIndex, result] of trackResult.subjects.entries()) {
					const point = availablePareto.get(result.subject_id);
					const expectedDominators = point
						? [...availablePareto.entries()]
								.filter(
									([otherId, other]) =>
										otherId !== result.subject_id &&
										other.quality >= point.quality &&
										compareDecimal(other.cost, point.cost) <= 0 &&
										other.latency <= point.latency &&
										(other.quality > point.quality ||
											compareDecimal(other.cost, point.cost) < 0 ||
											other.latency < point.latency)
								)
								.map(([subjectId]) => subjectId)
								.sort()
						: [];
					const expectedClassification = !point
						? 'unavailable'
						: expectedDominators.length
							? 'dominated'
							: 'frontier';
					if (
						result.pareto.classification !== expectedClassification ||
						JSON.stringify(result.pareto.dominated_by) !== JSON.stringify(expectedDominators)
					) {
						issue(
							[
								'slices',
								sliceIndex,
								'track_results',
								trackIndex,
								'subjects',
								resultIndex,
								'pareto'
							],
							'Pareto declaration must exactly match the available same-track metrics'
						);
					}
				}
			});
		});

		const overall = artifact.slices.find((slice) => slice.slice_id === 'overall');
		if (overall) {
			const overallRows = overall.track_results.flatMap((track) => track.subjects);
			const overallTrials = overallRows.reduce((total, result) => total + result.trial_count, 0);
			if (artifact.methodology.subject_trial_count !== overallTrials) {
				issue(
					['methodology', 'subject_trial_count'],
					'subject trial count must reconcile with the overall result rows'
				);
			}
			if (artifact.methodology.absolute_evaluation_count !== overallTrials * artifact.jury.length) {
				issue(
					['methodology', 'absolute_evaluation_count'],
					'absolute evaluation count must equal overall trials across every jury family'
				);
			}
			const pairwisePerFamily = overall.track_results.reduce(
				(total, track) =>
					total +
					track.subjects.reduce(
						(trackTotal, result) =>
							trackTotal + (result.trial_count * (track.subjects.length - 1)) / 2,
						0
					),
				0
			);
			if (artifact.methodology.pairwise_ballot_count !== pairwisePerFamily * artifact.jury.length) {
				issue(
					['methodology', 'pairwise_ballot_count'],
					'pairwise ballot count must reconcile with matched same-track trials and jury families'
				);
			}
			for (const result of overallRows) {
				const cohortTrialCount = artifact.slices
					.filter((slice) => slice.slice_id !== 'overall')
					.flatMap((slice) => slice.track_results)
					.flatMap((track) => track.subjects)
					.filter((candidate) => candidate.subject_id === result.subject_id)
					.reduce((total, candidate) => total + candidate.trial_count, 0);
				if (cohortTrialCount !== result.trial_count) {
					issue(
						['slices'],
						`cohort trial counts must reconcile with overall trials for ${result.subject_id}`
					);
				}
			}
		}
	});

export type CoffeeBenchPublicExport = z.infer<typeof publicExportSchema>;
export type CoffeeBenchSubjectResult = z.infer<typeof subjectResultSchema>;
export type CoffeeBenchSubject = CoffeeBenchPublicExport['subjects'][number];
export type CoffeeBenchSlice = CoffeeBenchPublicExport['slices'][number];
export type CoffeeBenchTrackResult =
	CoffeeBenchPublicExport['slices'][number]['track_results'][number];

type PublicLeak = { kind: 'field' | 'source URL' | 'undeclared content digest'; path: string };

function findPublicLeak(value: unknown, path = '$', key: string | null = null): PublicLeak | null {
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			const found = findPublicLeak(item, `${path}[${index}]`, key);
			if (found) return found;
		}
		return null;
	}
	if (typeof value === 'string') {
		const normalized = value.toLowerCase();
		if (normalized.includes('http://') || normalized.includes('https://')) {
			return { kind: 'source URL', path };
		}
		if (/^[a-f0-9]{64}$/i.test(value) && (!key || !publicDigestKeys.has(key))) {
			return { kind: 'undeclared content digest', path };
		}
		return null;
	}
	if (value === null || typeof value !== 'object') return null;

	for (const [childKey, item] of Object.entries(value)) {
		if (forbiddenPublicKeys.has(childKey.toLowerCase())) {
			return { kind: 'field', path: `${path}.${childKey}` };
		}
		const found = findPublicLeak(item, `${path}.${childKey}`, childKey);
		if (found) return found;
	}
	return null;
}

export function parseCoffeeBenchPublicExport(value: unknown): CoffeeBenchPublicExport {
	const leak = findPublicLeak(value);
	if (leak) {
		throw new Error(
			`CoffeeBench public export contains sealed or evaluator-only ${leak.kind} at ${leak.path}`
		);
	}

	const parsed = publicExportSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(`Invalid CoffeeBench public export: ${z.prettifyError(parsed.error)}`);
	}
	return parsed.data;
}

export function assertCoffeeBenchV0RouteIdentity(artifact: CoffeeBenchPublicExport): void {
	if (
		artifact.benchmark.name !== COFFEEBENCH_V0_BENCHMARK_NAME ||
		artifact.benchmark.version !== COFFEEBENCH_V0_BENCHMARK_VERSION ||
		artifact.benchmark.suite_id !== COFFEEBENCH_V0_SUITE_ID
	) {
		throw new Error('CoffeeBench v0 route artifact has an unexpected benchmark identity');
	}
	if (artifact.result_version !== COFFEEBENCH_V0_RESULT_VERSION) {
		throw new Error('CoffeeBench v0 route artifact has an unexpected immutable result version');
	}
	if (artifact.identities.result_content_sha256 !== COFFEEBENCH_V0_RESULT_CONTENT_SHA256) {
		throw new Error('CoffeeBench v0 route artifact has an unexpected result content identity');
	}
	if (
		artifact.identities.result_id !==
		`${COFFEEBENCH_V0_JURY_ID}.${artifact.identities.generation_id}.${artifact.status}.${artifact.identities.result_content_sha256}`
	) {
		throw new Error('CoffeeBench v0 route artifact has an unexpected jury result identity');
	}
}
