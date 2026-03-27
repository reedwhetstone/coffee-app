import type { RequestHandler } from './$types';
import { buildLegacyAppCatalogResponse } from '$lib/server/catalogResource';

export const GET: RequestHandler = async (event) => {
	return buildLegacyAppCatalogResponse(event, { requestPath: '/api/catalog' });
};
