import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/types/database.types';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import {
	isCookieSessionPrincipal,
	principalHasRole,
	resolvePrincipal,
	type SessionIdentity
} from '$lib/server/principal';
import type { CookieSerializeOptions } from 'cookie';

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

	let identityPromise: Promise<SessionIdentity> | null = null;
	event.locals.safeGetIdentity = async () => {
		if (!identityPromise) {
			identityPromise = (async () => {
				const {
					data: { session }
				} = await event.locals.supabase.auth.getSession();

				if (!session) {
					return {
						session: null,
						user: null
					};
				}

				const {
					data: { user },
					error: userError
				} = await event.locals.supabase.auth.getUser();

				return userError || !user
					? {
							session: null,
							user: null
						}
					: { session, user };
			})();
		}

		return identityPromise;
	};

	const principal = await resolvePrincipal(event);
	event.locals.principal = principal;

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

	if (currentPath === '/api-dashboard/docs') {
		throw redirect(307, '/docs/api/overview');
	}

	const principal = event.locals.principal;
	const hasBrowserSession = isCookieSessionPrincipal(principal);

	if (requiresDashboardAccess && !hasBrowserSession) {
		throw redirect(303, '/auth');
	}

	if (requiresProtection) {
		if (!hasBrowserSession) {
			throw redirect(303, '/catalog');
		}

		const isChatRoute = currentPath.startsWith('/chat');
		const isPortfolioRoute = currentPath.startsWith('/beans');
		const hasParchmentAccess = principal.ppiAccess || principalHasRole(principal, 'member');

		if (isChatRoute || isPortfolioRoute) {
			if (!hasParchmentAccess) {
				throw redirect(303, '/dashboard');
			}
		} else if (!principalHasRole(principal, 'member')) {
			throw redirect(303, '/dashboard');
		}
	}

	if (requiresAdminAccess) {
		if (!hasBrowserSession) {
			throw redirect(303, '/catalog');
		}

		if (!principalHasRole(principal, 'admin')) {
			throw redirect(303, '/dashboard');
		}
	}

	if (requiresApiAccess && !hasBrowserSession) {
		throw redirect(303, '/catalog');
	}

	return resolve(event);
};

export const handle = sequence(handleSupabase, authGuard);
