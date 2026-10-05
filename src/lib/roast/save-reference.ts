import {
	clearIdempotencyKey,
	reserveIdempotencyKey,
	shouldRetainIdempotencyKey
} from '$lib/idempotency';

const SCOPE = 'profile-studio-snapshot';
const FAILURE = 'Unable to save this roast as a reference';

export interface ReferenceSourceRoast {
	roast_id: number;
	batch_name?: string | null;
	coffee_name?: string | null;
}

/**
 * Keep a roast as a saved reference. The roast itself is not changed. Resolves to the
 * saved reference's title, and repeats safely if the first attempt's answer was lost.
 */
export async function saveRoastAsReference(
	roast: ReferenceSourceRoast,
	ownerId: string | null,
	storage: Storage | null
): Promise<string> {
	const roastId = roast.roast_id;
	const title = `${roast.batch_name || roast.coffee_name || `Roast #${roastId}`} reference`;
	const payload = JSON.stringify({ source: 'executed_roast', roastId, title });
	const idempotencyKey = reserveIdempotencyKey(storage, ownerId, SCOPE, payload);
	const response = await fetch('/api/reference-profiles', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
		body: payload
	});
	const body = (await response.json().catch(() => null)) as {
		data?: { title?: string };
		error?: string;
	} | null;
	if (!response.ok) {
		if (!shouldRetainIdempotencyKey(response.status))
			clearIdempotencyKey(storage, ownerId, SCOPE, payload);
		throw new Error(body?.error || FAILURE);
	}
	if (!body?.data?.title) throw new Error(FAILURE);
	clearIdempotencyKey(storage, ownerId, SCOPE, payload);
	return body.data.title;
}
