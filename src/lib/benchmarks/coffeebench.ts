import { z } from 'zod';

export const COFFEEBENCH_SCHEMA_VERSION = 2 as const;
export const COFFEEBENCH_RESULT_PATH = '/benchmarks/coffeebench-public-export-v2.json';

const SHA256 = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]*$/;
const RESULT_VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const DECIMAL_USD = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const forbiddenPublicKeys = new Set([
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
	'response',
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
						agent_majority_agreement_rate: z.number().finite().min(0).max(1),
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
			});
		});
	});

export type CoffeeBenchPublicExport = z.infer<typeof publicExportSchema>;
export type CoffeeBenchSubjectResult = z.infer<typeof subjectResultSchema>;
export type CoffeeBenchSubject = CoffeeBenchPublicExport['subjects'][number];
export type CoffeeBenchSlice = CoffeeBenchPublicExport['slices'][number];
export type CoffeeBenchTrackResult =
	CoffeeBenchPublicExport['slices'][number]['track_results'][number];

function findForbiddenKey(value: unknown, path = '$'): string | null {
	if (Array.isArray(value)) {
		for (const [index, item] of value.entries()) {
			const found = findForbiddenKey(item, `${path}[${index}]`);
			if (found) return found;
		}
		return null;
	}
	if (value === null || typeof value !== 'object') return null;

	for (const [key, item] of Object.entries(value)) {
		if (forbiddenPublicKeys.has(key.toLowerCase())) return `${path}.${key}`;
		const found = findForbiddenKey(item, `${path}.${key}`);
		if (found) return found;
	}
	return null;
}

export function parseCoffeeBenchPublicExport(value: unknown): CoffeeBenchPublicExport {
	const forbiddenPath = findForbiddenKey(value);
	if (forbiddenPath) {
		throw new Error(
			`CoffeeBench public export contains sealed or evaluator-only field at ${forbiddenPath}`
		);
	}

	const parsed = publicExportSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(`Invalid CoffeeBench public export: ${z.prettifyError(parsed.error)}`);
	}
	return parsed.data;
}
