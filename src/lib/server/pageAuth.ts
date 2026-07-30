import type { Session, User } from '@supabase/supabase-js';
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
