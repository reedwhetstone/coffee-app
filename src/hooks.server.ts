import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/types/database.types';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';

const handleSupabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		//console.log('Session in safeGetSession:', session);

		if (!session) {
			return { session: null, user: null, role: undefined };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error || !user) {
			console.error('Auth error:', error);
			return { session: null, user: null, role: undefined };
		}

		// Fetch user role
		const { data: roleData, error: roleError } = await event.locals.supabase
			.from('user_roles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (roleError) {
			console.error('Role fetch error:', roleError);
		}

		//console.log('Role data:', roleData);

		return {
			session,
			user,
			role: roleData?.role || 'viewer'
		};
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	// Define protected routes first
	const protectedRoutes = ['/roast', '/profit'];
	const currentPath = event.url.pathname;
	const requiresProtection = protectedRoutes.some((route) => currentPath.startsWith(route));

	// Get session
	const {
		data: { session },
		error: sessionError
	} = await event.locals.supabase.auth.getSession();

	if (sessionError) {
		console.error('Session error:', sessionError);
		// If this is a protected route, redirect
		if (requiresProtection) {
			throw redirect(303, '/');
		}
		return resolve(event);
	}

	// Set default values
	event.locals.session = session;
	event.locals.user = null;
	event.locals.role = 'viewer';

	if (session) {
		// Validate the user with getUser()
		const {
			data: { user },
			error: userError
		} = await event.locals.supabase.auth.getUser();

		if (!userError && user) {
			// Fetch user role
			const { data: roleData } = await event.locals.supabase
				.from('user_roles')
				.select('role')
				.eq('id', user.id)
				.single();

			event.locals.user = user;
			event.locals.role = roleData?.role || 'viewer';
		}
	}

	// Check protected routes - do this after setting up locals but before resolving
	if (requiresProtection && (!session || event.locals.role !== 'admin')) {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle = sequence(handleCookieCheck, handleSupabase, authGuard);
