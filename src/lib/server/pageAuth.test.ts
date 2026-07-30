import { describe, expect, it } from 'vitest';
import { getPageAuthState } from './pageAuth';
import type { RequestPrincipal, SessionPrincipal } from './principal';
import type { Session, User } from '@supabase/supabase-js';

const anonymousPrincipal = {
	authKind: 'anonymous',
	isAuthenticated: false
} as RequestPrincipal;

describe('getPageAuthState', () => {
	it('drops elevated page role when there is no page session', () => {
		const authState = getPageAuthState(anonymousPrincipal);

		expect(authState).toEqual({
			session: null,
			user: null,
			role: 'viewer'
		});
	});

	it('preserves the elevated role for real page sessions', () => {
		const session = { access_token: 'cookie-token' } as Session;
		const user = { id: 'cookie-user' } as User;
		const authState = getPageAuthState({
			subjectType: 'user',
			authKind: 'session',
			source: 'cookie-session',
			isAuthenticated: true,
			userId: user.id,
			session,
			user,
			appRoles: ['member'],
			primaryAppRole: 'member',
			apiPlan: 'member',
			ppiAccess: false,
			apiScopes: []
		} satisfies SessionPrincipal);

		expect(authState).toEqual({
			session,
			user,
			role: 'member'
		});
	});
});
