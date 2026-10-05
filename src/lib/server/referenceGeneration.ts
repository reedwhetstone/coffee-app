import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import { AuthError } from '$lib/server/auth';
import { ParchmentConfigError } from '$lib/server/parchmentClient';

export type GenerationRequest = components['schemas']['ReferenceProfileGenerationRequest'];
export type RoastGenerationRequest =
	components['schemas']['ReferenceProfileRoastGenerationRequest'];
type RoastSourceError = components['schemas']['RoastSourceErrorResponse']['error'];

export function parseGenerationRequest(value: unknown): GenerationRequest | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	const body = value as Record<string, unknown>;
	if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) return null;
	if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 4000))
		return null;
	const changes = body.changes;
	if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) return null;
	const adjustments = (changes as Record<string, unknown>).temperatureAdjustments;
	if (!Array.isArray(adjustments) || adjustments.length < 1 || adjustments.length > 12) return null;
	for (const adjustment of adjustments) {
		if (typeof adjustment !== 'object' || adjustment === null || Array.isArray(adjustment))
			return null;
		const entry = adjustment as Record<string, unknown>;
		if (entry.kind !== 'bean_temperature' && entry.kind !== 'environmental_temperature')
			return null;
		if (
			!Number.isFinite(entry.startMilliseconds) ||
			!Number.isFinite(entry.endMilliseconds) ||
			!Number.isFinite(entry.delta)
		)
			return null;
	}
	return body as GenerationRequest;
}

/** The roast a plan is built on: its ID and the revision token the page read it at. */
export function parseRoastRevision(
	value: unknown
): { roastId: number; roastRevision: string } | null {
	if (typeof value !== 'object' || value === null) return null;
	const roastId = 'roastId' in value ? value.roastId : null;
	const roastRevision = 'roastRevision' in value ? value.roastRevision : null;
	if (typeof roastId !== 'number' || !Number.isSafeInteger(roastId) || roastId <= 0) return null;
	if (typeof roastRevision !== 'string' || !roastRevision.trim()) return null;
	return { roastId, roastRevision };
}

const REFERENCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value is a saved reference's or a revision's ID. */
export function isReferenceId(value: unknown): value is string {
	return typeof value === 'string' && REFERENCE_ID.test(value);
}

/** The name a saved reference is given, when the request carries one. */
export function parseReferenceTitle(value: unknown): string | null {
	if (typeof value !== 'object' || value === null || !('title' in value)) return null;
	const title = typeof value.title === 'string' ? value.title.trim() : '';
	return title ? title.slice(0, 200) : null;
}

export function parseRoastGenerationRequest(value: unknown): RoastGenerationRequest | null {
	const roast = parseRoastRevision(value);
	const generation = parseGenerationRequest(value);
	if (!roast || !generation) return null;
	return {
		title: generation.title,
		...(generation.notes === undefined ? {} : { notes: generation.notes }),
		changes: generation.changes,
		...roast
	};
}

function isRoastSourceReason(value: unknown): value is NonNullable<RoastSourceError['reason']> {
	return (
		value === 'no_artisan_import' ||
		value === 'artisan_file_not_retained' ||
		value === 'artisan_file_too_large'
	);
}

/**
 * A failure from a call that builds on a roast's Artisan file. Parchment's code and, for a
 * roast with no usable file, its reason are passed on so the page can say what to do next.
 */
export function roastSourceFailure(error: unknown, status: number | undefined, fallback: string) {
	const detail =
		typeof error === 'object' &&
		error !== null &&
		'error' in error &&
		typeof error.error === 'object' &&
		error.error !== null
			? error.error
			: null;
	const message = detail && 'message' in detail ? detail.message : null;
	const code = detail && 'code' in detail ? detail.code : null;
	const reason = detail && 'reason' in detail ? detail.reason : null;
	return json(
		{
			error: typeof message === 'string' ? message : fallback,
			...(typeof code === 'string' ? { code } : {}),
			...(isRoastSourceReason(reason) ? { reason } : {})
		},
		{ status: status ?? 500 }
	);
}

export function upstreamFailure(error: unknown, status: number | undefined, fallback: string) {
	const message =
		typeof error === 'object' &&
		error !== null &&
		'error' in error &&
		typeof error.error === 'object' &&
		error.error !== null &&
		'message' in error.error &&
		typeof error.error.message === 'string'
			? error.error.message
			: fallback;
	return json({ error: message }, { status: status ?? 500 });
}

/** What a page shows when Parchment cannot be reached for saved references or plans. */
export const SERVICE_UNAVAILABLE = 'Saved references and plans are temporarily unavailable';

export function routeFailure(error: unknown, fallback: string) {
	if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
	if (error instanceof ParchmentConfigError)
		return json({ error: SERVICE_UNAVAILABLE }, { status: 503 });
	if (error instanceof SyntaxError) return json({ error: 'Invalid request' }, { status: 400 });
	console.error(fallback);
	return json({ error: fallback }, { status: 500 });
}
