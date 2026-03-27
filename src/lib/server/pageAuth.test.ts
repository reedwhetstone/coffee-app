import { describe, expect, it } from 'vitest';
import { getPageAuthState } from './pageAuth';

describe('getPageAuthState', () => {
	it('drops elevated page role when there is no page session', () => {
		const authState = getPageAuthState({
			session: null,
			user: { id: 'bearer-user' } as App.Locals['user'],
			role: 'member'
		});

		expect(authState).toEqual({
			session: null,
			user: null,
			role: 'viewer'
		});
	});

	it('preserves the elevated role for real page sessions', () => {
		const session = { access_token: 'cookie-token' } as App.Locals['session'];
		const user = { id: 'cookie-user' } as App.Locals['user'];
		const authState = getPageAuthState({
			session,
			user,
			role: 'member'
		});

		expect(authState).toEqual({
			session,
			user,
			role: 'member'
		});
	});
});
