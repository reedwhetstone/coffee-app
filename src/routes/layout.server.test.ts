import { describe, expect, it, vi } from 'vitest';

const mockGetPageAuthState = vi.fn();

vi.mock('$lib/server/pageAuth', () => ({
	getPageAuthState: mockGetPageAuthState
}));

const route = await import('./+layout.server');

describe('root layout server load', () => {
	it('does not serialize request cookies into page data', async () => {
		mockGetPageAuthState.mockReturnValue({
			session: null,
			user: null,
			role: 'viewer'
		});
		const cookies = {
			getAll: vi.fn(() => [{ name: 'purveyors_cli_auth_request', value: 'signed-request-secret' }])
		};

		const result = await route.load({ locals: {}, cookies } as never);

		expect(cookies.getAll).not.toHaveBeenCalled();
		expect(result).not.toHaveProperty('cookies');
		expect(JSON.stringify(result)).not.toContain('signed-request-secret');
	});
});
