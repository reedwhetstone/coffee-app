import type {
	ParchmentClient,
	TrackedLotMutation as SdkTrackedLotMutation,
	TrackedLotSummary as SdkTrackedLotSummary
} from '@purveyors/sdk';

export type TrackedLotSummary = Omit<SdkTrackedLotSummary, 'unstockedDate'> & {
	unstockedDate: string | null;
};

export type TrackedLotMutation = {
	catalogId: number;
	tracked: boolean;
	trackedAt: string | null;
	priceAtTracking: number | null;
};

type TrackedLotsListResult = {
	data?: {
		data?: {
			catalogIds?: unknown;
			summaries?: unknown;
		};
	};
	error?: unknown;
	response?: Response;
};

type TrackedLotMutationResult = {
	data?: {
		data?: unknown;
	};
	error?: unknown;
	response?: Response;
};

export class ParchmentTrackedLotError extends Error {
	constructor(
		public status: number,
		public body: unknown
	) {
		super(
			typeof body === 'object' &&
				body !== null &&
				'error' in body &&
				typeof body.error === 'object' &&
				body.error !== null &&
				'message' in body.error &&
				typeof body.error.message === 'string'
				? body.error.message
				: 'Parchment tracked-lot request failed'
		);
		this.name = 'ParchmentTrackedLotError';
	}
}

function throwParchmentError(error: unknown, response?: Response): never {
	if (response) {
		throw new ParchmentTrackedLotError(response.status, error);
	}
	throw error instanceof Error
		? error
		: new Error('Parchment tracked-lot request failed', { cause: error });
}

async function listTrackedLots(
	client: ParchmentClient,
	summaryLimit?: number
): Promise<{ catalogIds: number[]; summaries: TrackedLotSummary[] }> {
	const result = (await client.portfolio.trackedLots.list(
		summaryLimit === undefined ? undefined : { summaryLimit }
	)) as TrackedLotsListResult;

	if (result.error) throwParchmentError(result.error, result.response);

	const payload = result.data?.data;
	if (
		!payload ||
		!Array.isArray(payload.catalogIds) ||
		!payload.catalogIds.every(
			(id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
		) ||
		!Array.isArray(payload.summaries)
	) {
		throw new Error('Parchment returned an invalid tracked-lot list response');
	}

	const catalogIds = payload.catalogIds as number[];
	const summaries = (payload.summaries as SdkTrackedLotSummary[]).map((summary) => ({
		...summary,
		unstockedDate: summary.unstockedDate ?? null
	}));

	return { catalogIds, summaries };
}

export async function getTrackedLotIds(client: ParchmentClient): Promise<number[]> {
	return (await listTrackedLots(client, 0)).catalogIds;
}

export async function getTrackedLotSummaries(
	client: ParchmentClient,
	limit = 50
): Promise<TrackedLotSummary[]> {
	return (await listTrackedLots(client, limit)).summaries;
}

function normalizeMutation(data: unknown): TrackedLotMutation {
	const mutation = data as SdkTrackedLotMutation['data'] | undefined;
	if (
		!mutation ||
		typeof mutation.catalogId !== 'number' ||
		typeof mutation.tracked !== 'boolean'
	) {
		throw new Error('Parchment returned an invalid tracked-lot mutation response');
	}

	return {
		catalogId: mutation.catalogId,
		tracked: mutation.tracked,
		trackedAt: mutation.trackedAt ?? null,
		priceAtTracking: mutation.priceAtTracking ?? null
	};
}

async function mutateTrackedLot(
	request: Promise<TrackedLotMutationResult>
): Promise<TrackedLotMutation> {
	const result = await request;
	if (result.error) throwParchmentError(result.error, result.response);
	return normalizeMutation(result.data?.data);
}

export function trackTrackedLot(
	client: ParchmentClient,
	catalogId: number
): Promise<TrackedLotMutation> {
	return mutateTrackedLot(client.portfolio.trackedLots.track(catalogId));
}

export function untrackTrackedLot(
	client: ParchmentClient,
	catalogId: number
): Promise<TrackedLotMutation> {
	return mutateTrackedLot(client.portfolio.trackedLots.untrack(catalogId));
}
