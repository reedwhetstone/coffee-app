import type { ParchmentClient, components } from '@purveyors/sdk';

export type ParchmentRoastProfile = components['schemas']['RoastDetailResource'];
type RoastCreateRequest = components['schemas']['RoastCreateRequest'];
type RoastBatchCreateRequest = components['schemas']['RoastBatchCreateRequest'];
type RoastUpdateRequest = components['schemas']['RoastUpdateRequest'];
type RoastLiveCurveRequest = components['schemas']['RoastLiveCurveRequest'];

type ParchmentMutationResult<T> = {
	data?: { data?: T };
	error?: unknown;
	response?: Response;
};

export type LegacyRoastCreateInput = Record<string, unknown> & {
	batch_beans?: Record<string, unknown>[];
};

export type ParchmentRoastCreateResult = {
	isBatch: boolean;
	profiles: ParchmentRoastProfile[];
};

export class ParchmentRoastMutationError extends Error {
	constructor(
		public status: number,
		public body: unknown
	) {
		super(extractParchmentMessage(body));
		this.name = 'ParchmentRoastMutationError';
	}
}

function extractParchmentMessage(body: unknown): string {
	if (typeof body !== 'object' || body === null) return 'Parchment roast request failed';

	if (
		'error' in body &&
		typeof body.error === 'object' &&
		body.error !== null &&
		'message' in body.error &&
		typeof body.error.message === 'string'
	) {
		return body.error.message;
	}

	if ('message' in body && typeof body.message === 'string') return body.message;
	return 'Parchment roast request failed';
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
	return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isRoastProfile(value: unknown): value is ParchmentRoastProfile {
	if (typeof value !== 'object' || value === null) return false;
	const profile = value as Record<string, unknown>;
	return (
		Number.isInteger(profile.roast_id) &&
		(profile.roast_id as number) > 0 &&
		isNullableNumber(profile.coffee_id) &&
		isNullableString(profile.batch_name) &&
		isNullableString(profile.coffee_name) &&
		typeof profile.last_updated === 'string' &&
		typeof profile.user === 'string'
	);
}

function unwrapMutation<T>(
	result: ParchmentMutationResult<T>,
	isValid: (data: T) => boolean,
	message: string
): T {
	if (result.error) {
		if (result.response) {
			throw new ParchmentRoastMutationError(result.response.status, result.error);
		}
		throw result.error instanceof Error
			? result.error
			: new Error('Parchment roast request failed', { cause: result.error });
	}

	const data = result.data?.data;
	if (data === undefined || !isValid(data)) {
		throw new ParchmentRoastMutationError(502, {
			error: { code: 'invalid_response', message }
		});
	}
	return data;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function assignString(target: Record<string, unknown>, key: string, value: unknown): void {
	if (typeof value === 'string') target[key] = value;
}

function assignNumber(target: Record<string, unknown>, key: string, value: unknown): void {
	if (typeof value === 'number' && Number.isFinite(value)) target[key] = value;
}

function toSingleCreateRequest(raw: LegacyRoastCreateInput): RoastCreateRequest {
	const request: Record<string, unknown> = { coffeeId: raw.coffee_id as number };
	assignString(request, 'coffeeName', raw.coffee_name);
	assignString(request, 'batchName', raw.batch_name);
	assignString(request, 'roastDate', raw.roast_date);
	assignNumber(request, 'ozIn', raw.oz_in);
	assignNumber(request, 'ozOut', raw.oz_out);
	assignNumber(request, 'weightLossPercent', raw.weight_loss_percent);
	assignString(request, 'notes', raw.roast_notes);
	assignString(request, 'targets', raw.roast_targets);
	assignString(request, 'roasterType', raw.roaster_type);
	assignString(request, 'roasterSize', raw.roaster_size);
	assignString(request, 'temperatureUnit', raw.temperature_unit);
	assignNumber(request, 'totalRoastTime', raw.total_roast_time);
	assignNumber(request, 'developmentPercent', raw.development_percent);
	assignString(request, 'dataSource', raw.data_source);
	assignString(request, 'roastUuid', raw.roast_uuid);
	assignNumber(request, 'fcStartTime', raw.fc_start_time);
	assignNumber(request, 'fcStartTemp', raw.fc_start_temp);
	assignNumber(request, 'fcEndTime', raw.fc_end_time);
	assignNumber(request, 'fcEndTemp', raw.fc_end_temp);
	assignNumber(request, 'dropTime', raw.drop_time);
	assignNumber(request, 'dropTemp', raw.drop_temp);
	assignNumber(request, 'chargeTime', raw.charge_time);
	assignNumber(request, 'chargeTemp', raw.charge_temp);
	assignNumber(request, 'tpTime', raw.tp_time);
	assignNumber(request, 'tpTemp', raw.tp_temp);
	assignNumber(request, 'totalRor', raw.total_ror);
	assignNumber(request, 'dryPercent', raw.dry_percent);
	assignNumber(request, 'maillardPercent', raw.maillard_percent);
	assignNumber(request, 'auc', raw.auc);
	assignNumber(request, 'dryPhaseRor', raw.dry_phase_ror);
	assignNumber(request, 'midPhaseRor', raw.mid_phase_ror);
	assignNumber(request, 'finishPhaseRor', raw.finish_phase_ror);
	assignNumber(request, 'dryPhaseDeltaTemp', raw.dry_phase_delta_temp);
	return request as RoastCreateRequest;
}

function toBatchCreateRequest(raw: LegacyRoastCreateInput): RoastBatchCreateRequest {
	return {
		batchName: optionalString(raw.batch_name) ?? '',
		...(optionalString(raw.roast_date) ? { roastDate: optionalString(raw.roast_date) } : {}),
		...(optionalString(raw.roast_notes) ? { notes: optionalString(raw.roast_notes) } : {}),
		...(optionalString(raw.roast_targets) ? { targets: optionalString(raw.roast_targets) } : {}),
		items: (raw.batch_beans ?? []).map((item) => ({
			coffeeId: item.coffee_id as number,
			...(optionalString(item.coffee_name) ? { coffeeName: item.coffee_name as string } : {}),
			...(optionalNumber(item.oz_in) !== undefined ? { ozIn: item.oz_in as number } : {}),
			...(optionalNumber(item.oz_out) !== undefined ? { ozOut: item.oz_out as number } : {})
		}))
	};
}

function toUpdateRequest(raw: Record<string, unknown>): RoastUpdateRequest {
	const request: Record<string, unknown> = {};
	// The active editor owns only these four inputs. Derived metrics, ownership,
	// timestamps, and milestone fields in its legacy row-shaped payload are
	// deliberately not forwarded as write authority.
	if ('oz_in' in raw && isNullableNumber(raw.oz_in)) request.ozIn = raw.oz_in;
	if ('oz_out' in raw && isNullableNumber(raw.oz_out)) request.ozOut = raw.oz_out;
	if ('roast_notes' in raw && isNullableString(raw.roast_notes)) request.notes = raw.roast_notes;
	if ('roast_targets' in raw && isNullableString(raw.roast_targets)) {
		request.targets = raw.roast_targets;
	}

	return request as RoastUpdateRequest;
}

function toLiveCurveRequest(raw: Record<string, unknown>): RoastLiveCurveRequest {
	const temperatureEntries = Array.isArray(raw.temperatureEntries) ? raw.temperatureEntries : [];
	const eventEntries = Array.isArray(raw.eventEntries) ? raw.eventEntries : [];

	return {
		temperatures: temperatureEntries.map((entry) => {
			const row = entry as Record<string, unknown>;
			return {
				timeSeconds: row.time_seconds as number,
				...(isNullableNumber(row.bean_temp) ? { beanTemp: row.bean_temp } : {}),
				...(isNullableNumber(row.environmental_temp)
					? { environmentalTemp: row.environmental_temp }
					: {}),
				...(isNullableNumber(row.ambient_temp) ? { ambientTemp: row.ambient_temp } : {}),
				...(isNullableNumber(row.ror_bean_temp) ? { rorBeanTemp: row.ror_bean_temp } : {}),
				dataSource: 'live' as const
			};
		}),
		events: eventEntries.map((entry) => {
			const row = entry as Record<string, unknown>;
			return {
				timeSeconds: row.time_seconds as number,
				...(isNullableNumber(row.event_type) ? { eventType: row.event_type } : {}),
				...(isNullableString(row.event_value) ? { eventValue: row.event_value } : {}),
				...(isNullableString(row.event_string) ? { eventString: row.event_string } : {}),
				...(isNullableString(row.category) ? { category: row.category } : {}),
				...(isNullableString(row.subcategory) ? { subcategory: row.subcategory } : {}),
				...(typeof row.user_generated === 'boolean' ? { userGenerated: row.user_generated } : {}),
				...(typeof row.automatic === 'boolean' ? { automatic: row.automatic } : {}),
				...(isNullableString(row.notes) ? { notes: row.notes } : {})
			};
		})
	};
}

/** Create one roast or one named roast batch through Parchment. */
export async function createParchmentRoasts(
	client: ParchmentClient,
	raw: LegacyRoastCreateInput,
	idempotencyKey?: string
): Promise<ParchmentRoastCreateResult> {
	if (Array.isArray(raw.batch_beans)) {
		if (!idempotencyKey) {
			throw new ParchmentRoastMutationError(400, {
				error: {
					code: 'missing_idempotency_key',
					message: 'Idempotency-Key is required for roast batch creation'
				}
			});
		}
		const request = toBatchCreateRequest(raw);
		const data = unwrapMutation(
			(await client.roasts.createBatch(request, idempotencyKey)) as ParchmentMutationResult<{
				batchName: string;
				profiles: ParchmentRoastProfile[];
			}>,
			(value) =>
				typeof value === 'object' &&
				value !== null &&
				value.batchName === request.batchName &&
				Array.isArray(value.profiles) &&
				value.profiles.length === request.items.length &&
				value.profiles.every(
					(profile, index) =>
						isRoastProfile(profile) && profile.coffee_id === request.items[index]?.coffeeId
				),
			'Parchment returned an invalid roast batch response'
		);
		return { isBatch: true, profiles: data.profiles };
	}

	const request = toSingleCreateRequest(raw);
	const data = unwrapMutation(
		(await client.roasts.create(
			request,
			idempotencyKey ? { idempotencyKey } : undefined
		)) as ParchmentMutationResult<ParchmentRoastProfile>,
		(value) => isRoastProfile(value) && value.coffee_id === request.coffeeId,
		'Parchment returned an invalid roast create response'
	);
	return { isBatch: false, profiles: [data] };
}

/** Update profile metadata or replace the active live curve through Parchment. */
export async function updateParchmentRoast(
	client: ParchmentClient,
	id: number,
	raw: Record<string, unknown>,
	ifMatch?: string
): Promise<ParchmentRoastProfile> {
	const hasLiveCurve = Array.isArray(raw.temperatureEntries) || Array.isArray(raw.eventEntries);
	const update = toUpdateRequest(raw);
	if (hasLiveCurve && Object.keys(update).length > 0) {
		throw new ParchmentRoastMutationError(400, {
			error: {
				code: 'mixed_roast_update',
				message: 'Profile metadata and live curve data must be saved separately'
			}
		});
	}

	const result = hasLiveCurve
		? await client.roasts.replaceLiveCurve(
				id,
				toLiveCurveRequest(raw),
				ifMatch ? { ifMatch } : undefined
			)
		: await client.roasts.update(id, update, ifMatch ? { ifMatch } : undefined);

	return unwrapMutation(
		result as ParchmentMutationResult<ParchmentRoastProfile>,
		(value) => isRoastProfile(value) && value.roast_id === id,
		'Parchment returned an invalid roast update response'
	);
}

/** Delete one owner-scoped roast through Parchment. */
export async function deleteParchmentRoast(client: ParchmentClient, id: number): Promise<void> {
	unwrapMutation(
		(await client.roasts.delete(id)) as ParchmentMutationResult<{ id: number; deleted: true }>,
		(data) => data.id === id && data.deleted === true,
		'Parchment returned an invalid roast delete response'
	);
}

/** Delete one exact owner batch through Parchment's session-only command. */
export async function deleteParchmentRoastBatch(
	client: ParchmentClient,
	batchName: string
): Promise<void> {
	unwrapMutation(
		(await client.roasts.deleteBatch(batchName)) as ParchmentMutationResult<{
			batchName: string;
			ids: number[];
			deleted: true;
		}>,
		(data) =>
			data.batchName === batchName &&
			data.deleted === true &&
			Array.isArray(data.ids) &&
			data.ids.every((id) => Number.isInteger(id) && id > 0),
		'Parchment returned an invalid roast batch delete response'
	);
}
