import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { isRoastBatchId, roastBatchRouteFailure } from '$lib/server/parchmentRoastBatches';
import { upstreamFailure } from '$lib/server/referenceGeneration';

/**
 * Delete one batch, by ID, with the roasts in it. No other batch is touched, whatever its
 * name. Sales recorded against the batch are kept.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const batchId = event.params.id;
		if (!isRoastBatchId(batchId)) {
			return json({ error: 'Invalid roast batch' }, { status: 400 });
		}
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			signal: event.request.signal
		});
		const result = await client.roastBatches.delete(batchId);
		if (result.error || !result.data) {
			return upstreamFailure(result.error, result.response?.status, 'Unable to delete this batch');
		}
		const deleted = result.data.data;
		if (deleted.id !== batchId || deleted.deleted !== true || !Array.isArray(deleted.ids)) {
			return json(
				{ error: 'Parchment returned an invalid batch delete response' },
				{ status: 502 }
			);
		}
		return json({ success: true, id: deleted.id, roastIds: deleted.ids });
	} catch (error) {
		return roastBatchRouteFailure(error, 'Unable to delete this batch');
	}
};
