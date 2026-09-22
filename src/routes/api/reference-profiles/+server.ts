import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole, AuthError } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

const MAX_ARTISAN_BYTES = 10_000_000;

function upstreamFailure(error: unknown, status: number | undefined, fallback: string) {
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

function routeFailure(error: unknown, fallback: string) {
	if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
	if (error instanceof ParchmentConfigError)
		return json({ error: 'Profile Studio is temporarily unavailable' }, { status: 503 });
	if (error instanceof SyntaxError) return json({ error: 'Invalid request' }, { status: 400 });
	console.error(fallback);
	return json({ error: fallback }, { status: 500 });
}

export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const { data, error, response } = await client.referenceProfiles.list(false);
		if (error || !data) return upstreamFailure(error, response?.status, 'Unable to load profiles');
		return json(data);
	} catch (error) {
		return routeFailure(error, 'Unable to load reference profiles');
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const idempotencyKey = event.request.headers.get('idempotency-key')?.trim();
		if (!idempotencyKey) {
			return json({ error: 'Idempotency-Key is required' }, { status: 400 });
		}

		if (event.request.headers.get('content-type')?.includes('multipart/form-data')) {
			const form = await event.request.formData();
			const file = form.get('file');
			if (!(file instanceof File))
				return json({ error: 'Artisan file is required' }, { status: 400 });
			const lowerName = file.name.toLowerCase();
			if (!['.alog', '.alog.json', '.json'].some((extension) => lowerName.endsWith(extension))) {
				return json({ error: 'Use an Artisan .alog, .alog.json, or .json file' }, { status: 400 });
			}
			if (file.size <= 0 || file.size > MAX_ARTISAN_BYTES) {
				return json({ error: 'Artisan files must be between 1 byte and 10 MB' }, { status: 400 });
			}
			const title = String(form.get('title') ?? '').trim() || 'Artisan reference';
			const notes = String(form.get('notes') ?? '').trim() || undefined;
			const { data, error, response } = await client.referenceProfiles.import(
				{
					fileName: file.name,
					fileContent: await file.text(),
					fileSize: file.size,
					title,
					...(notes ? { notes } : {})
				},
				idempotencyKey
			);
			if (error || !data)
				return upstreamFailure(error, response?.status, 'Unable to save this Artisan profile');
			return json(data, { status: response.status });
		}

		const body = (await event.request.json()) as {
			source?: unknown;
			roastId?: unknown;
			title?: unknown;
			notes?: unknown;
		};
		if (
			body.source !== 'executed_roast' ||
			!Number.isSafeInteger(body.roastId) ||
			Number(body.roastId) <= 0
		) {
			return json({ error: 'A positive executed roast ID is required' }, { status: 400 });
		}
		const roastId = Number(body.roastId);
		const chartResult = await client.roasts.chartData(String(roastId), { target_points: 400 });
		if (chartResult.error || !chartResult.data)
			return upstreamFailure(
				chartResult.error,
				chartResult.response?.status,
				'Unable to read that roast'
			);
		const roastRevision = chartResult.data.data.metadata.revision;
		if (!roastRevision) {
			return json({ error: 'This roast has no immutable chart revision to save' }, { status: 409 });
		}
		const { data, error, response } = await client.referenceProfiles.fromRoast(
			{
				roastId,
				roastRevision,
				...(typeof body.title === 'string' && body.title.trim()
					? { title: body.title.trim() }
					: {}),
				...(typeof body.notes === 'string' && body.notes.trim() ? { notes: body.notes.trim() } : {})
			},
			idempotencyKey
		);
		if (error || !data)
			return upstreamFailure(error, response?.status, 'Unable to save this roast as a reference');
		return json(data, { status: response.status });
	} catch (error) {
		return routeFailure(error, 'Unable to save reference profile');
	}
};
