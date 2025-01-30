import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerSupabaseClient } from '$lib/auth/supabase.server';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/i18n';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';

const handleParaglide = i18n.handle();

const handleSupabase: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerSupabaseClient({
		get: (key) => event.cookies.get(key),
		set: (key, value, options) => {
			event.cookies.set(key, value, {
				...options,
				path: '/',
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				domain: event.url.hostname === 'localhost' ? 'localhost' : event.url.hostname
			});
		},
		remove: (key, options) => {
			event.cookies.delete(key, {
				...options,
				path: '/',
				domain: event.url.hostname === 'localhost' ? 'localhost' : event.url.hostname
			});
		}
	});

	event.locals.getSession = async () => {
		const {
			data: { session },
			error
		} = await event.locals.supabase.auth.getSession();
		if (error) {
			console.error('Session retrieval error:', error);
			return null;
		}
		return session;
	};

	return resolve(event);
};

export const handle = sequence(handleCookieCheck, handleParaglide, handleSupabase);
