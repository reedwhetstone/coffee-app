import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/types/database.types';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/i18n';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';

const handleParaglide = i18n.handle();

const handleSupabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient<Database>(
		PUBLIC_SUPABASE_URL,
		PUBLIC_SUPABASE_ANON_KEY,
		{
			cookies: {
				get: (key) => event.cookies.get(key),
				set: (key, value, options) => event.cookies.set(key, value, { ...options, path: '/' }),
				remove: (key, options) => event.cookies.delete(key, { ...options, path: '/' })
			}
		}
	);

	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		//console.log('Session:', session);

		if (!session) {
			return { session: null, user: null, role: undefined };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		//	console.log('User:', user);

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

		//console.log('Role data:', roleData, 'Role error:', roleError);

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
	event.locals.session = session;
	event.locals.user = user;
	event.locals.role = role;

	// Update case for other route checks
	if (event.url.pathname.startsWith('/roast') && role !== 'admin') {
		throw redirect(303, '/');
	}
	if (event.url.pathname.startsWith('/profit') && role !== 'admin') {
		throw redirect(303, '/');
	}

	if (!event.locals.session && event.url.pathname.startsWith('/private')) {
		throw redirect(303, '/auth');
	}

	if (event.locals.session && event.url.pathname === '/auth') {
		throw redirect(303, '/private');
	}

	return resolve(event);
};

export const handle = sequence(handleCookieCheck, handleParaglide, handleSupabase, authGuard);
