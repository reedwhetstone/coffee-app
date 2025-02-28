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

	// Implement safeGetSession function
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		const {
			data: { user },
			error: userError
		} = await event.locals.supabase.auth.getUser();

		if (userError) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	// First get the session
	const {
		data: { session }
	} = await event.locals.supabase.auth.getSession();

	// Then validate the user with getUser
	const {
		data: { user },
		error: userError
	} = await event.locals.supabase.auth.getUser();

	if (userError || !user) {
		// Reset all auth state if validation fails
		event.locals.session = null;
		event.locals.user = null;
		event.locals.role = 'viewer';
	} else {
		// Set validated user data
		event.locals.session = session;
		event.locals.user = user;

		// Fetch user role from database
		const { data: roleData } = await event.locals.supabase
			.from('user_roles')
			.select('role')
			.eq('id', user.id)
			.single();

		event.locals.role = (roleData?.role as 'viewer' | 'member' | 'admin') || 'viewer';
	}

	// Make data available to the frontend
	event.locals.data = {
		session: event.locals.session,
		user: event.locals.user,
		role: event.locals.role
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const protectedRoutes = ['/roast', '/profit'];
	const currentPath = event.url.pathname;
	const requiresProtection = protectedRoutes.some((route) => currentPath.startsWith(route));

	// Get session and verified user data
	const { session, user } = await event.locals.safeGetSession();

	// Set default values
	event.locals.session = session;
	event.locals.user = user;
	event.locals.role = 'viewer'; // default role

	if (user) {
		// Fetch user role from database
		const { data: roleData } = await event.locals.supabase
			.from('user_roles')
			.select('role')
			.eq('id', user.id)
			.single();

		// This is the important part - make sure role is one of the expected values
		event.locals.role = (roleData?.role as 'viewer' | 'member' | 'admin') || 'viewer';
	}

	// Make sure these values are available to the frontend
	event.locals.data = {
		session: event.locals.session,
		user: event.locals.user,
		role: event.locals.role
	};

	// Check protected routes
	if (
		requiresProtection &&
		(!session || !event.locals.role || !['admin', 'member'].includes(event.locals.role))
	) {
		throw redirect(303, '/');
	}

	return resolve(event);
};

export const handle = sequence(handleCookieCheck, handleSupabase, authGuard);
