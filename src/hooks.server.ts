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
		//console.log('Session check:', { hasSession: !!session });

		if (!session) {
			return { session: null, user: null, role: undefined };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		//console.log('User check:', { hasUser: !!user, error });

		if (error) {
			console.error('Auth error:', error);
			return { session: null, user: null, role: undefined };
		}

		// Fetch user role
		const { data: roleData, error: roleError } = await event.locals.supabase
			.from('user_roles')
			.select('role')
			.eq('id', user?.id || '')
			.single();

		//console.log('Role check:', { roleData, roleError });

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
	const { session, user, role } = await event.locals.safeGetSession();
	console.log('Auth Check:', {
		path: event.url.pathname,
		hasSession: !!session,
		hasUser: !!user,
		role
	});

	event.locals.session = session;
	event.locals.user = user;
	event.locals.role = role;

	// Update case for other route checks
	if (!session && event.url.pathname.startsWith('/roast')) {
		throw redirect(303, '/');
	}

	if (session && event.url.pathname.startsWith('/roast') && role !== 'admin') {
		//console.log('Redirecting from /roast - Not admin');
		throw redirect(303, '/');
	}

	if (event.url.pathname.startsWith('/profit') && role !== 'admin') {
		//console.log('Redirecting from /profit - Not admin');
		throw redirect(303, '/');
	}

	if (!event.locals.session && event.url.pathname.startsWith('/private')) {
		throw redirect(303, '/');
	}

	if (event.locals.session && event.url.pathname === '/auth') {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle = sequence(handleCookieCheck, handleSupabase, authGuard);
