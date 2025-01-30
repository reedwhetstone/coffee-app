import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerSupabaseClient } from '$lib/supabase';
import type { Database } from '$lib/types/database.types';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/i18n';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';

const handleParaglide = i18n.handle();

const handleSupabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerSupabaseClient({
		cookies: {
			get: (key) => event.cookies.get(key),
			set: (key, value, options) => event.cookies.set(key, value, { ...options, path: '/' }),
			remove: (key, options) => {
				event.cookies.delete(key, { ...options, path: '/' });
				return true;
			}
		}
	});

	event.locals.getSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		return session;
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range';
		}
	});
};

const authGuard: Handle = async ({ event, resolve }) => {
	const session = await event.locals.getSession();
	event.locals.session = session;
	event.locals.user = session?.user ?? null;

	if (!event.locals.session && event.url.pathname.startsWith('/private')) {
		throw redirect(303, '/auth');
	}

	if (event.locals.session && event.url.pathname === '/auth') {
		throw redirect(303, '/private');
	}

	return resolve(event);
};

export const handle = sequence(handleCookieCheck, handleParaglide, handleSupabase, authGuard);
