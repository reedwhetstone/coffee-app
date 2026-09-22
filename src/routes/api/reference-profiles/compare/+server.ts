import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import type { RequestHandler } from './$types';
import { requireMemberRole, AuthError } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

type Selection = { kind: 'executed_roast' | 'reference_profile'; id: string };
type ProfileComparisonRequest = components['schemas']['ProfileComparisonRequest'];

function validSelection(value: unknown): value is Selection {
	return (
		typeof value === 'object' &&
		value !== null &&
		'kind' in value &&
		(value.kind === 'executed_roast' || value.kind === 'reference_profile') &&
		'id' in value &&
		typeof value.id === 'string' &&
		value.id.length > 0
	);
}

async function immutableInput(
	client: Awaited<ReturnType<typeof createParchmentServerClient>>,
	selection: Selection
): Promise<ProfileComparisonRequest['left']> {
	if (selection.kind === 'reference_profile') {
		const result = await client.referenceProfiles.get(selection.id);
		if (result.error || !result.data)
			throw new Response('Reference profile not found', { status: result.response?.status ?? 404 });
		return { type: 'reference_revision', revisionId: result.data.data.currentRevisionId };
	}
	const roastId = Number(selection.id);
	if (!Number.isSafeInteger(roastId) || roastId <= 0)
		throw new Response('Invalid executed roast ID', { status: 400 });
	const result = await client.roasts.chartData(String(roastId), { target_points: 400 });
	if (result.error || !result.data)
		throw new Response('Executed roast not found', { status: result.response?.status ?? 404 });
	const roastRevision = result.data.data.metadata.revision;
	if (!roastRevision)
		throw new Response('Executed roast has no immutable chart revision', { status: 409 });
	return { type: 'executed_roast', roastId, roastRevision };
}

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const body = (await event.request.json()) as Record<string, unknown>;
		if (!validSelection(body.left) || !validSelection(body.right)) {
			return json({ error: 'Choose two valid profiles to compare' }, { status: 400 });
		}
		const targetUnit = body.targetUnit === 'C' ? 'C' : 'F';
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const [left, right] = await Promise.all([
			immutableInput(client, body.left),
			immutableInput(client, body.right)
		]);
		const result = await client.referenceProfiles.compare({
			left,
			right,
			alignment: 'charge',
			targetUnit,
			targetPoints: 400
		});
		if (result.error || !result.data) {
			return json(
				{ error: result.error?.error?.message ?? 'Unable to compare these profiles' },
				{ status: result.response?.status ?? 500 }
			);
		}
		return json(result.data);
	} catch (error) {
		if (error instanceof Response) {
			return json({ error: await error.text() }, { status: error.status });
		}
		if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
		if (error instanceof ParchmentConfigError)
			return json({ error: 'Profile comparison is temporarily unavailable' }, { status: 503 });
		if (error instanceof SyntaxError)
			return json({ error: 'Invalid comparison request' }, { status: 400 });
		console.error('Profile comparison failed');
		return json({ error: 'Unable to compare these profiles' }, { status: 500 });
	}
};
