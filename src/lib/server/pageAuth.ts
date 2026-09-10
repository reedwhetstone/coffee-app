import type { Session } from '@supabase/supabase-js';
import type { UserRole } from '$lib/types/auth.types';
import {
	isCookieSessionPrincipal,
	type RequestPrincipal,
	type PrincipalUser
} from '$lib/server/principal';

export function getPageAuthState(principal: RequestPrincipal): {
	session: Session | null;
	user: PrincipalUser | null;
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
