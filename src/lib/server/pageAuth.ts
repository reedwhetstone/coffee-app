import type { Session, User } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';
import type { UserRole } from '$lib/types/auth.types';
import { isCookieSessionPrincipal, type RequestPrincipal } from '$lib/server/principal';

export function getPageAuthState(principal: RequestPrincipal): {
	session: Session | null;
	user: User | null;
	role: UserRole;
} {
	if (!isCookieSessionPrincipal(principal)) {
		return {
			session: null,
			user: null,
			role: 'viewer'
		};
	}

	return {
		session: principal.session,
		user: principal.user,
		role: principal.primaryAppRole
	};
}

/** Require a browser session for authenticated page loads. */
export function requirePageSession(principal: RequestPrincipal, redirectTo = '/') {
	const authState = getPageAuthState(principal);

	if (!authState.session || !authState.user) {
		throw redirect(303, redirectTo);
	}

	return {
		...authState,
		session: authState.session,
		user: authState.user
	};
}
