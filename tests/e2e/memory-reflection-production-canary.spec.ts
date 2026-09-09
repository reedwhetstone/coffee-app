import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

interface MemoryDocument {
	content: string;
	version: number;
	updated_at?: string;
	updated_by?: string;
}

interface ReflectionSuccess extends MemoryDocument {
	ok: true;
}

interface ReflectionSkipped {
	skipped: true;
	reason: 'cooldown' | 'empty-response';
}

type ReflectionResult = ReflectionSuccess | ReflectionSkipped;

function sanitizedRequest(request: APIRequestContext) {
	async function call(operation: () => Promise<APIResponse>): Promise<APIResponse> {
		try {
			return await operation();
		} catch {
			throw new Error('[memory-reflection-canary] production request failed');
		}
	}

	return {
		get: (...args: Parameters<APIRequestContext['get']>) => call(() => request.get(...args)),
		post: (...args: Parameters<APIRequestContext['post']>) => call(() => request.post(...args)),
		put: (...args: Parameters<APIRequestContext['put']>) => call(() => request.put(...args))
	};
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe.serial('Phase 5C memory-reflection production canary', () => {
	let initialMemory: MemoryDocument | null = null;
	let restored = false;

	async function json<T>(response: APIResponse): Promise<T> {
		return (await response.json()) as T;
	}

	test.beforeAll(async ({ request: rawRequest }) => {
		const request = sanitizedRequest(rawRequest);
		const response = await request.get('/api/memory');
		expect(response.status()).toBe(200);
		initialMemory = await json<MemoryDocument>(response);
	});

	test.afterAll(async ({ request: rawRequest }) => {
		if (!initialMemory || restored) return;
		const request = sanitizedRequest(rawRequest);
		const currentResponse = await request.get('/api/memory');
		expect(currentResponse.status()).toBe(200);
		const current = await json<MemoryDocument>(currentResponse);
		const restoreResponse = await request.put('/api/memory', {
			data: { content: initialMemory.content, expected_version: current.version }
		});
		expect(restoreResponse.status()).toBe(200);
		const restoredMemory = await json<MemoryDocument & { ok: boolean }>(restoreResponse);
		expect(restoredMemory.ok).toBe(true);
		expect(restoredMemory.content).toBe(initialMemory.content);
		console.log('[memory-reflection-canary] cleanup and restoration verified');
	});

	test('reflects once, cools down concurrent delivery, fences stale CAS, and restores state', async ({
		request: rawRequest
	}) => {
		if (!initialMemory) throw new Error('[memory-reflection-canary] initial state unavailable');
		const request = sanitizedRequest(rawRequest);
		const messages = [
			{ role: 'user', content: 'I prefer washed Ethiopian coffees with floral aromatics.' },
			{ role: 'assistant', content: 'I will keep that coffee preference in mind.' },
			{ role: 'user', content: 'I usually brew those coffees with a V60.' },
			{ role: 'assistant', content: 'I will account for your V60 brewing preference.' }
		];

		const [first, second] = await Promise.all([
			request.post('/api/memory/dream', { data: { messages } }),
			request.post('/api/memory/dream', { data: { messages } })
		]);
		expect(first.status()).toBe(200);
		expect(second.status()).toBe(200);
		const results = await Promise.all([
			json<ReflectionResult>(first),
			json<ReflectionResult>(second)
		]);
		const cooldowns = results.filter(
			(result): result is ReflectionSkipped => 'skipped' in result && result.reason === 'cooldown'
		);
		const successes = results.filter(
			(result): result is ReflectionSuccess => 'ok' in result && result.ok === true
		);
		expect(cooldowns).toHaveLength(1);
		expect(successes).toHaveLength(1);
		expect(successes[0].content.length).toBeGreaterThan(0);
		expect(successes[0].updated_by).toBe('agent');

		const currentResponse = await request.get('/api/memory');
		expect(currentResponse.status()).toBe(200);
		const current = await json<MemoryDocument>(currentResponse);
		expect(current).toMatchObject({
			content: successes[0].content,
			version: successes[0].version,
			updated_by: 'agent'
		});
		expect(current.version).toBe(initialMemory.version + 2);

		const staleWrite = await request.put('/api/memory', {
			data: { content: 'stale canary write', expected_version: initialMemory.version }
		});
		expect(staleWrite.status()).toBe(409);

		const restoreResponse = await request.put('/api/memory', {
			data: { content: initialMemory.content, expected_version: current.version }
		});
		expect(restoreResponse.status()).toBe(200);
		const restoredMemory = await json<MemoryDocument & { ok: boolean }>(restoreResponse);
		expect(restoredMemory.ok).toBe(true);
		expect(restoredMemory.content).toBe(initialMemory.content);
		restored = true;
		console.log('[memory-reflection-canary] reflection, cooldown, CAS, and restoration verified');
	});
});
