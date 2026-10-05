import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveRoastAsReference } from './save-reference';

const roast = { roast_id: 4531, batch_name: 'Wednesday roast', coffee_name: 'Ethiopia' };

function stubFetch(response: () => Response) {
	const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => response());
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

const idempotencyKey = (fetchMock: ReturnType<typeof stubFetch>, call = 0) =>
	new Headers(fetchMock.mock.calls[call][1]?.headers).get('Idempotency-Key');

afterEach(() => {
	vi.unstubAllGlobals();
	sessionStorage.clear();
});

describe('saving a roast as a reference', () => {
	it('sends the roast and a title built from its batch, and returns the saved title', async () => {
		const fetchMock = stubFetch(
			() => new Response(JSON.stringify({ data: { title: 'Wednesday roast reference' } }))
		);

		await expect(saveRoastAsReference(roast, 'member-1', sessionStorage)).resolves.toBe(
			'Wednesday roast reference'
		);

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('/api/reference-profiles');
		expect(init?.method).toBe('POST');
		expect(JSON.parse(String(init?.body))).toEqual({
			source: 'executed_roast',
			roastId: 4531,
			title: 'Wednesday roast reference'
		});
		expect(idempotencyKey(fetchMock)).toBeTruthy();
	});

	it('falls back to the coffee, then the roast number, for the title', async () => {
		const fetchMock = stubFetch(() => new Response(JSON.stringify({ data: { title: 'saved' } })));

		await saveRoastAsReference({ roast_id: 7, coffee_name: 'Colombia' }, null, null);
		await saveRoastAsReference({ roast_id: 8 }, null, null);

		expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).title)).toEqual([
			'Colombia reference',
			'Roast #8 reference'
		]);
	});

	it('repeats with the same key when the first answer was lost, and a new one after a refusal', async () => {
		let status = 503;
		const fetchMock = stubFetch(
			() => new Response(JSON.stringify({ error: 'Parchment said no' }), { status })
		);

		await expect(saveRoastAsReference(roast, 'member-1', sessionStorage)).rejects.toThrow(
			'Parchment said no'
		);
		status = 400;
		await expect(saveRoastAsReference(roast, 'member-1', sessionStorage)).rejects.toThrow(
			'Parchment said no'
		);
		await expect(saveRoastAsReference(roast, 'member-1', sessionStorage)).rejects.toThrow();

		// The lost answer is retried under its own key; the refused request is not.
		expect(idempotencyKey(fetchMock, 1)).toBe(idempotencyKey(fetchMock, 0));
		expect(idempotencyKey(fetchMock, 2)).not.toBe(idempotencyKey(fetchMock, 1));
	});

	it('does not report success for an answer without a saved reference in it', async () => {
		stubFetch(() => new Response(JSON.stringify({ data: {} })));

		await expect(saveRoastAsReference(roast, null, null)).rejects.toThrow(
			'Unable to save this roast as a reference'
		);
	});
});
