import { json } from '@sveltejs/kit';
import { AuthError, requireParchmentAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	ParchmentTrackedLotError,
	trackTrackedLot,
	untrackTrackedLot
} from '$lib/server/trackedLots';
import type { RequestEvent } from '@sveltejs/kit';

const POSTGRES_INT4_MAX = 2_147_483_647;

function parseCatalogId(rawId: string | undefined): number | null {
	if (!rawId || !/^\d+$/.test(rawId)) return null;
	const value = Number(rawId);
	return Number.isSafeInteger(value) && value > 0 && value <= POSTGRES_INT4_MAX ? value : null;
}

async function parseDesiredState(request: Request): Promise<boolean | null> {
	try {
		const body = (await request.json()) as unknown;
		if (
			typeof body !== 'object' ||
			body === null ||
			!('tracked' in body) ||
			typeof body.tracked !== 'boolean'
		) {
			return null;
		}
		return body.tracked;
	} catch {
		return null;
	}
}

export const PUT = async (event: RequestEvent) => {
	try {
		await requireParchmentAccess(event);

		const catalogId = parseCatalogId(event.params.id);
		if (catalogId === null) {
			return json({ error: 'Invalid catalog ID' }, { status: 400 });
		}

		const tracked = await parseDesiredState(event.request);
		if (tracked === null) {
			return json(
				{ error: 'Invalid request body', message: 'Expected JSON { "tracked": boolean }' },
				{ status: 400 }
			);
		}

		const client = await createParchmentServerClient(event, { mode: 'session' });
		const result = tracked
			? await trackTrackedLot(client, catalogId)
			: await untrackTrackedLot(client, catalogId);
		return json(result);
	} catch (error) {
		if (error instanceof AuthError) {
			return json({ error: error.message }, { status: error.status });
		}
		if (error instanceof ParchmentTrackedLotError) {
			return json(error.body, { status: error.status });
		}
		if (error instanceof ParchmentConfigError) {
			return json(
				{ error: 'Parchment service unavailable', message: error.message },
				{ status: 503 }
			);
		}
		console.error('Failed to update tracked-lot state:', error);
		return json({ error: 'Failed to update tracking' }, { status: 502 });
	}
};
