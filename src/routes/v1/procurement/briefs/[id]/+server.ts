import type { RequestHandler } from './$types';
import { proxyBriefGet, runProcurementProxyRoute } from '$lib/server/procurementProxy';

export const GET: RequestHandler = async (event) => {
	const id = event.params.id;
	// SvelteKit has already percent-decoded the path param, so encode it back into
	// the successor URL. An id containing a newline or reserved char (e.g. `%0A`,
	// `%2F`, `%3F`) would otherwise corrupt the `Link` header and make
	// `Headers.set` throw a 500 before the upstream 404/400 can be relayed. The
	// raw decoded id is still forwarded to the SDK, which does its own encoding.
	const successorUrl = `https://api.purveyors.io/v1/procurement/briefs/${encodeURIComponent(id)}`;
	return runProcurementProxyRoute(event, successorUrl, (e) => proxyBriefGet(e, id));
};
