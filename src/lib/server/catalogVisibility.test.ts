import { describe, expect, it } from 'vitest';
import { resolveCatalogVisibility } from './catalogVisibility';
import type { RequestPrincipal, SessionPrincipal } from './principal';
import type { Session, User } from '@supabase/supabase-js';

const anonymousPrincipal = {
	authKind: 'anonymous',
	isAuthenticated: false
} as RequestPrincipal;

const memberPrincipal = {
	subjectType: 'user',
	authKind: 'session',
	source: 'cookie-session',
	isAuthenticated: true,
	userId: 'member-1',
	user: { id: 'member-1' } as User,
	session: { access_token: 'member-token' } as Session,
	appRoles: ['member'],
	primaryAppRole: 'member',
	apiPlan: 'member',
	ppiAccess: false,
	apiScopes: []
} satisfies SessionPrincipal;

describe('resolveCatalogVisibility', () => {
	it('includes wholesale by default for public and member sessions', () => {
		expect(resolveCatalogVisibility({ principal: anonymousPrincipal }).showWholesale).toBe(true);
		expect(resolveCatalogVisibility({ principal: memberPrincipal }).showWholesale).toBe(true);
	});

	it('allows every visitor to narrow to hobbyist suppliers only', () => {
		expect(
			resolveCatalogVisibility({
				principal: anonymousPrincipal,
				showWholesaleRequested: false
			})
		).toMatchObject({ publicOnly: true, showWholesale: false, wholesaleOnly: false });
	});

	it('keeps wholesale-only scope restricted to member sessions', () => {
		expect(
			resolveCatalogVisibility({
				principal: anonymousPrincipal,
				wholesaleOnlyRequested: true
			}).wholesaleOnly
		).toBe(false);
	});
});
