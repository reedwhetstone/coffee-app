import type { RequestHandler } from './$types';
import { buildCatalogProofCoverageResponse } from '$lib/server/catalogResource';

export const GET: RequestHandler = async (event) => {
	return buildCatalogProofCoverageResponse(event, { requestPath: '/v1/catalog/proof-coverage' });
};
