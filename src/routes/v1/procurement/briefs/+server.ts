import type { RequestHandler } from './$types';
import {
	buildSourcingBriefCreateResponse,
	buildSourcingBriefsListResponse
} from '$lib/server/procurement/sourcingBriefs';

export const GET: RequestHandler = async (event) => {
	return buildSourcingBriefsListResponse(event, { requestPath: '/v1/procurement/briefs' });
};

export const POST: RequestHandler = async (event) => {
	return buildSourcingBriefCreateResponse(event, { requestPath: '/v1/procurement/briefs' });
};
