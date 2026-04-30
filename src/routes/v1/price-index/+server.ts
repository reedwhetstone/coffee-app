import type { RequestHandler } from './$types';
import { buildCanonicalPriceIndexResponse } from '$lib/server/priceIndexResource';

export const GET: RequestHandler = async (event) => {
	return buildCanonicalPriceIndexResponse(event, { requestPath: '/v1/price-index' });
};
