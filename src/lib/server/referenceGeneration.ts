import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import { AuthError } from '$lib/server/auth';
import { ParchmentConfigError } from '$lib/server/parchmentClient';

export type GenerationRequest = components['schemas']['ReferenceProfileGenerationRequest'];

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

export function routeFailure(error: unknown, fallback: string) {
	if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
	if (error instanceof ParchmentConfigError)
		return json({ error: 'Profile Studio is temporarily unavailable' }, { status: 503 });
	if (error instanceof SyntaxError) return json({ error: 'Invalid request' }, { status: 400 });
	console.error(fallback);
	return json({ error: fallback }, { status: 500 });
}
