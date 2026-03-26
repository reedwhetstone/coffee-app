import type { RequestHandler } from './$types';
import { buildCanonicalCatalogResponse } from '$lib/server/catalogResource';

export const GET: RequestHandler = async (event) => {
	return buildCanonicalCatalogResponse(event, { requestPath: '/v1/catalog' });
};
