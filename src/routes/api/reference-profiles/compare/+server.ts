import { json } from '@sveltejs/kit';
import type { components } from '@purveyors/sdk';
import type { RequestHandler } from './$types';
import { requireMemberRole, AuthError } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';

type Selection = { kind: 'executed_roast' | 'reference_profile'; id: string };
type ProfileComparisonRequest = components['schemas']['ProfileComparisonRequest'];
type SideMilestone = { name: string; milliseconds: number };
type ComparisonInput = {
	input: ProfileComparisonRequest['left'];
	/** What this side recorded, timed from its charge; null when it could not be read. */
	milestones: SideMilestone[] | null;
};

/**
 * Parchment's comparison lists only the milestones both sides recorded. Each side's own
 * milestones, timed from its charge as the comparison is, let the page name one that only
 * the other side has.
 */
function milestonesFromCharge(
	events: Array<{ name: string; category: string; milliseconds: number }>,
	chargeMilliseconds: number | null
): SideMilestone[] | null {
	if (chargeMilliseconds == null) return null;
	return events
		.filter((event) => event.category === 'milestone')
		.map((event) => ({
			name: event.name.trim().toLowerCase(),
			milliseconds: event.milliseconds - chargeMilliseconds
		}));
}

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

function isJsonObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The comparison does not depend on this read, so a failure only leaves the side unknown. */
async function referenceMilestones(
	client: Awaited<ReturnType<typeof createParchmentServerClient>>,
	profileId: string,
	revisionId: string
): Promise<SideMilestone[] | null> {
	try {
		const result = await client.referenceProfiles.chart(profileId, revisionId);
		const chart = result.data?.data.chart;
		if (result.error || !chart) return null;
		return milestonesFromCharge(
			chart.events.map((event) => ({
				name: event.name,
				category: event.category,
				milliseconds: event.timeMilliseconds
			})),
			chart.chargeTimeMilliseconds
		);
	} catch {
		return null;
	}
}

async function comparisonInput(
	client: Awaited<ReturnType<typeof createParchmentServerClient>>,
	selection: Selection
): Promise<ComparisonInput> {
	if (selection.kind === 'reference_profile') {
		const result = await client.referenceProfiles.get(selection.id);
		if (result.error || !result.data)
			throw new Response('That saved reference could not be found', {
				status: result.response?.status ?? 404
			});
		const revisionId = result.data.data.currentRevisionId;
		return {
			input: { type: 'reference_revision', revisionId },
			milestones: await referenceMilestones(client, selection.id, revisionId)
		};
	}
	const roastId = Number(selection.id);
	if (!Number.isSafeInteger(roastId) || roastId <= 0)
		throw new Response('Invalid executed roast ID', { status: 400 });
	const result = await client.roasts.chartData(String(roastId), { target_points: 400 });
	if (result.error || !result.data)
		throw new Response('That roast could not be found', { status: result.response?.status ?? 404 });
	const roastRevision = result.data.data.metadata.revision;
	if (!roastRevision)
		throw new Response('That roast has no recorded curve to compare', { status: 409 });
	return {
		input: { type: 'executed_roast', roastId, roastRevision },
		milestones: milestonesFromCharge(
			result.data.data.events.map((event) => ({
				name: event.name,
				category: event.category,
				milliseconds: event.time_milliseconds
			})),
			result.data.data.metadata.charge_time_ms
		)
	};
}

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const parsedBody = await event.request.json();
		if (!isJsonObject(parsedBody))
			return json({ error: 'Invalid comparison request' }, { status: 400 });
		const body = parsedBody;
		if (!validSelection(body.left) || !validSelection(body.right)) {
			return json({ error: 'Choose two valid profiles to compare' }, { status: 400 });
		}
		const targetUnit = body.targetUnit === 'C' ? 'C' : 'F';
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const [left, right] = await Promise.all([
			comparisonInput(client, body.left),
			comparisonInput(client, body.right)
		]);
		const result = await client.referenceProfiles.compare({
			left: left.input,
			right: right.input,
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
		return json({
			...result.data,
			sideMilestones: { left: left.milestones, right: right.milestones }
		});
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
