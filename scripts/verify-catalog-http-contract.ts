const [, , baseUrlArg] = process.argv;

if (!baseUrlArg) {
	console.error('Usage: pnpm tsx scripts/verify-catalog-http-contract.ts <deploy-host>');
	process.exit(1);
}

const apiKey = process.env.PURVEYORS_API_KEY;

if (!apiKey) {
	console.error('PURVEYORS_API_KEY is required to verify the catalog HTTP contract.');
	process.exit(1);
}

const baseUrl = new URL(baseUrlArg);

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

async function fetchCheck(path: string, init?: RequestInit) {
	const url = new URL(path, baseUrl);
	return fetch(url, init);
}

async function main() {
	const invalidKeyResponse = await fetchCheck('/v1/catalog', {
		headers: {
			Authorization: 'Bearer definitely_invalid'
		}
	});
	assert(
		invalidKeyResponse.status === 401,
		`Expected /v1/catalog invalid key status 401, got ${invalidKeyResponse.status}`
	);
	const invalidKeyBody = await invalidKeyResponse.json();
	assert(
		invalidKeyBody?.error === 'Authentication required',
		`Expected invalid key body error to be Authentication required, got ${JSON.stringify(invalidKeyBody)}`
	);

	const canonicalResponse = await fetchCheck('/v1/catalog', {
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});
	assert(
		canonicalResponse.status === 200,
		`Expected /v1/catalog status 200, got ${canonicalResponse.status}`
	);
	assert(
		canonicalResponse.headers.has('X-RateLimit-Limit'),
		'Expected /v1/catalog to include X-RateLimit-Limit'
	);
	assert(
		canonicalResponse.headers.has('X-RateLimit-Remaining'),
		'Expected /v1/catalog to include X-RateLimit-Remaining'
	);
	assert(
		canonicalResponse.headers.has('X-RateLimit-Reset'),
		'Expected /v1/catalog to include X-RateLimit-Reset'
	);

	const legacyInvalidKeyResponse = await fetchCheck('/api/catalog-api', {
		headers: {
			Authorization: 'Bearer definitely_invalid'
		}
	});
	assert(
		legacyInvalidKeyResponse.status === 401,
		`Expected /api/catalog-api invalid key status 401, got ${legacyInvalidKeyResponse.status}`
	);
	assert(
		legacyInvalidKeyResponse.headers.get('Deprecation') === 'true',
		`Expected legacy invalid-key response to include Deprecation=true, got ${legacyInvalidKeyResponse.headers.get('Deprecation')}`
	);

	const legacyResponse = await fetchCheck('/api/catalog-api', {
		headers: {
			Authorization: `Bearer ${apiKey}`
		}
	});
	assert(
		legacyResponse.status === 200,
		`Expected /api/catalog-api status 200, got ${legacyResponse.status}`
	);
	assert(
		legacyResponse.headers.get('Deprecation') === 'true',
		`Expected Deprecation=true, got ${legacyResponse.headers.get('Deprecation')}`
	);
	assert(
		legacyResponse.headers.get('Link') === '</v1/catalog>; rel="successor-version"',
		`Expected legacy Link header to point at /v1/catalog, got ${legacyResponse.headers.get('Link')}`
	);
	assert(
		legacyResponse.headers.has('X-RateLimit-Limit'),
		'Expected /api/catalog-api to include X-RateLimit-Limit'
	);
	assert(
		legacyResponse.headers.has('X-RateLimit-Remaining'),
		'Expected /api/catalog-api to include X-RateLimit-Remaining'
	);
	assert(
		legacyResponse.headers.has('X-RateLimit-Reset'),
		'Expected /api/catalog-api to include X-RateLimit-Reset'
	);
	assert(
		legacyResponse.headers.get('Sunset') === 'Thu, 31 Dec 2026 23:59:59 GMT',
		`Expected Sunset header to be Thu, 31 Dec 2026 23:59:59 GMT, got ${legacyResponse.headers.get('Sunset')}`
	);

	console.log(`Catalog HTTP contract verified for ${baseUrl.origin}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
