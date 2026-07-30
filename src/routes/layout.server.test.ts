import { describe, expect, it, vi } from 'vitest';
import { anonymousPrincipal } from '$lib/server/principal.test-utils';

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

		const result = await route.load({
			locals: { principal: anonymousPrincipal() },
			cookies
		} as never);

		expect(cookies.getAll).not.toHaveBeenCalled();
		expect(result).not.toHaveProperty('cookies');
		expect(result).toEqual({
			auth: {
				isSignedIn: false,
				user: null,
				role: 'viewer',
				ppiAccess: false
			}
		});
		expect(JSON.stringify(result)).not.toContain('signed-request-secret');
		expect(JSON.stringify(result)).not.toContain('access_token');
		expect(JSON.stringify(result)).not.toContain('refresh_token');
	});

	it('serializes a sanitized auth view without Supabase session credentials', async () => {
		mockGetPageAuthState.mockReturnValue({
			session: {
				access_token: 'access-secret',
				refresh_token: 'refresh-secret',
				expires_in: 3600,
				expires_at: 123456,
				user: { id: 'user-1', email: 'user@example.com' }
			},
			user: { id: 'user-1', email: 'user@example.com' },
			role: 'member'
		});

		const result = await route.load({
			locals: { principal: { isAuthenticated: true, ppiAccess: true } }
		} as never);

		expect(result).toEqual({
			auth: {
				isSignedIn: true,
				user: { id: 'user-1', email: 'user@example.com' },
				role: 'member',
				ppiAccess: true
			}
		});
		expect(JSON.stringify(result)).not.toContain('access-secret');
		expect(JSON.stringify(result)).not.toContain('refresh-secret');
		expect(result).not.toHaveProperty('session');
	});
});
