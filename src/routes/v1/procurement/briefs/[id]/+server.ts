import type { RequestHandler } from './$types';
import { buildSourcingBriefGetResponse } from '$lib/server/procurement/sourcingBriefs';

export const GET: RequestHandler = async (event) => {
	return buildSourcingBriefGetResponse(event, event.params.id, {
		requestPath: '/v1/procurement/briefs/:id'
	});
};
