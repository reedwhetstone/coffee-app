import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireMemberRole } from '$lib/server/auth';
import { createParchmentServerClient } from '$lib/server/parchmentClient';
import { parseRoastBatchId, roastBatchRouteFailure } from '$lib/server/parchmentRoastBatches';
import { upstreamFailure } from '$lib/server/referenceGeneration';

/**
 * Delete one batch, by ID, with the roasts in it. No other batch is touched, whatever its
 * name. Sales recorded against the batch are kept.
 */
export const DELETE: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);
		const batchId = parseRoastBatchId(event.params.id);
		if (batchId === null) {
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
		// The batch is already deleted by now. Letter case alone must not turn that into a
		// failure, which a retry would then report as "not found".
		if (
			parseRoastBatchId(deleted.id) !== batchId ||
			deleted.deleted !== true ||
			!Array.isArray(deleted.ids)
		) {
			return json(
				{ error: 'Parchment returned an invalid batch delete response' },
				{ status: 502 }
			);
		}
		return json({ success: true, id: batchId, roastIds: deleted.ids });
	} catch (error) {
		return roastBatchRouteFailure(error, 'Unable to delete this batch');
	}
};
