import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { i18n } from '$lib/i18n';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';

const handleParaglide = i18n.handle();

const handleSupabase: Handle = async ({ event, resolve }) => {
	try {
		event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
			cookies: {
				get: (key) => event.cookies.get(key),
				set: (key, value, options) => {
					event.cookies.set(key, value, {
						...options,
						path: '/',
						secure: true,
						sameSite: 'lax'
					});
				},
				remove: (key, options) => {
					event.cookies.delete(key, {
						...options,
						path: '/'
					});
				}
			}
		});

		event.locals.getSession = async () => {
			try {
				const {
					data: { session },
					error
				} = await event.locals.supabase.auth.getSession();
				if (error) throw error;
				return session;
			} catch (error) {
				console.error('Session retrieval error:', error);
				return null;
			}
		};

		return resolve(event);
	} catch (error) {
		console.error('Supabase server client error:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const handle = sequence(handleCookieCheck, handleParaglide, handleSupabase);
