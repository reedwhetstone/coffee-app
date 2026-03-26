import type { RequestHandler } from './$types';
import { buildLegacyExternalCatalogResponse } from '$lib/server/catalogResource';

export const GET: RequestHandler = async (event) => {
	return buildLegacyExternalCatalogResponse(event, { requestPath: '/api/catalog-api' });
};
