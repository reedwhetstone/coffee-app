import { describe, expect, it } from 'vitest';

import { jsonResponse } from './http';

describe('jsonResponse', () => {
	it('preserves custom headers while setting a JSON content type', async () => {
		const response = jsonResponse(
			{ ok: true },
			{
				status: 202,
				headers: {
					'X-Test-Header': 'preserved',
					'X-Another-Header': 'also-preserved'
				}
			}
		);

		expect(response.status).toBe(202);
		expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
		expect(response.headers.get('X-Test-Header')).toBe('preserved');
		expect(response.headers.get('X-Another-Header')).toBe('also-preserved');
		expect(await response.json()).toEqual({ ok: true });
	});
});
