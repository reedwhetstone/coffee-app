import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { routeFailure, upstreamFailure } from '$lib/server/referenceGeneration';

const MAX_ARTISAN_BYTES = 10_000_000;

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const GET: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
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
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
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
				return upstreamFailure(error, response?.status, 'Unable to save this Artisan file');
			return json(data, { status: response.status });
		}

		const parsedBody = await event.request.json();
		if (!isJsonObject(parsedBody)) return json({ error: 'Invalid request' }, { status: 400 });
		const body = parsedBody as {
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
				// Comparison-only chart. Parchment defaults to this basis; the SDK type requires it.
				basis: 'chart_snapshot',
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
