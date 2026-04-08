export function jsonResponse(
	body: unknown,
	options: {
		status?: number;
		headers?: HeadersInit;
	} = {}
): Response {
	const headers = new Headers(options.headers);

	if (!headers.has('content-type')) {
		headers.set('content-type', 'application/json; charset=utf-8');
	}

	return new Response(JSON.stringify(body), {
		status: options.status ?? 200,
		headers
	});
}
