import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/types/database.types';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';
import { requireRole } from '$lib/server/auth';
import {
	getLegacyAuthState,
	getPrimaryUserRole,
	getUserRoles,
	resolvePrincipal,
	type SessionContext
} from '$lib/server/principal';
import type { CookieSerializeOptions } from 'cookie';

const handleStripeRedirects: Handle = async ({ event, resolve }) => {
	const url = event.url;

	if (url.searchParams.has('checkout_session_id') && url.pathname === '/subscription') {
		console.log('Detected Stripe checkout success, redirecting to success page');
		throw redirect(303, '/subscription/success');
	}

	return resolve(event);
};

const handleSupabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (
					cookiesToSet: Array<{ name: string; value: string; options: CookieSerializeOptions }>
				) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	) as unknown as App.Locals['supabase'];

	let sessionContextPromise: Promise<SessionContext> | null = null;
	event.locals.safeGetSession = async () => {
		if (sessionContextPromise) {
			return sessionContextPromise;
		}

		sessionContextPromise = (async () => {
			const {
				data: { session }
			} = await event.locals.supabase.auth.getSession();

			if (!session) {
				return {
					session: null,
					user: null,
					role: 'viewer' as const,
					roles: ['viewer']
				};
			}

			const {
				data: { user },
				error: userError
			} = await event.locals.supabase.auth.getUser();

			if (userError || !user) {
				return {
					session: null,
					user: null,
					role: 'viewer' as const,
					roles: ['viewer']
				};
			}

			const roles = await getUserRoles(event.locals.supabase, user.id);

			return {
				session,
				user,
				role: getPrimaryUserRole(roles),
				roles
			};
		})();

		return sessionContextPromise;
	};

	// Resolve the normalized principal first, then derive legacy locals from that
	// authoritative auth state so bearer/API-key requests cannot diverge from
	// event.locals.session/user/role.
	const principal = await resolvePrincipal(event);
	const legacyAuthState = getLegacyAuthState(principal);

	event.locals.principal = principal;
	event.locals.session = legacyAuthState.session;
	event.locals.user = legacyAuthState.user;
	event.locals.role = legacyAuthState.role;
	event.locals.data = {
		session: event.locals.session,
		user: event.locals.user,
		role: event.locals.role
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const protectedRoutes = ['/roast', '/profit', '/beans', '/chat'];
	const adminRoutes = ['/admin'];
	const apiRoutes = ['/api-dashboard'];
	const dashboardRoutes = ['/dashboard'];
	const currentPath = event.url.pathname;
	const requiresProtection = protectedRoutes.some((route) => currentPath.startsWith(route));
	const requiresAdminAccess = adminRoutes.some((route) => currentPath.startsWith(route));
	const requiresApiAccess = apiRoutes.some((route) => currentPath.startsWith(route));
	const requiresDashboardAccess = dashboardRoutes.some((route) => currentPath.startsWith(route));

	const { session } = await event.locals.safeGetSession();

	if (requiresDashboardAccess && !session) {
		throw redirect(303, '/auth');
	}

	if (requiresProtection && !requireRole(event.locals.role, 'member')) {
		throw redirect(303, session ? '/dashboard' : '/catalog');
	}

	if (requiresAdminAccess && !requireRole(event.locals.role, 'admin')) {
		throw redirect(303, session ? '/dashboard' : '/catalog');
	}

	if (requiresApiAccess && !session) {
		throw redirect(303, '/catalog');
	}

	return resolve(event);
};

export const handle = sequence(handleStripeRedirects, handleCookieCheck, handleSupabase, authGuard);
