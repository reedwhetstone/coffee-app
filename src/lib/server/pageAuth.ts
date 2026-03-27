import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '$lib/types/auth.types';

export function getPageAuthState(locals: Pick<App.Locals, 'session' | 'user' | 'role'>): {
	session: Session | null;
	user: User | null;
	role: UserRole;
} {
	const session = locals.session ?? null;

	return {
		session,
		user: session ? (locals.user ?? null) : null,
		role: session ? (locals.role ?? 'viewer') : 'viewer'
	};
}
