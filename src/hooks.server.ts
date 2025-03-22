import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '$lib/types/database.types';
import { type Handle, redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { handleCookieCheck } from '$lib/middleware/cookieCheck';
import { getUserRole } from '$lib/server/auth';
import { requireRole } from '$lib/server/auth';

// Handle Stripe checkout success redirects
const handleStripeRedirects: Handle = async ({ event, resolve }) => {
	const url = event.url;

	// Check for Stripe checkout success
	if (url.searchParams.has('checkout_session_id') && url.pathname === '/subscription') {
		// Stripe has redirected with checkout_session_id which means successful payment
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
				setAll: (cookiesToSet) => {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
				}
			}
		}
	);

	// Implement safeGetSession function that properly validates the JWT
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();

		if (!session) {
			return { session: null, user: null };
		}

		// Always validate the user with getUser() to ensure the JWT is valid
		const {
			data: { user },
			error: userError
		} = await event.locals.supabase.auth.getUser();

		if (userError) {
			// JWT validation has failed
			return { session: null, user: null };
		}

		return { session, user };
	};

	// Get validated session and user data
	const { session, user } = await event.locals.safeGetSession();

	// Set initial state
	event.locals.session = session;
	event.locals.user = user;
	event.locals.role = 'viewer'; // default role

	if (user) {
		// Use the getUserRole utility function instead of duplicating the logic
		event.locals.role = await getUserRole(event.locals.supabase, user.id);
	}

	// Make data available to the frontend
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
		// Use the getUserRole utility here as well
		event.locals.role = await getUserRole(event.locals.supabase, user.id);
	}

	// Make sure these values are available to the frontend
	event.locals.data = {
		session: event.locals.session,
		user: event.locals.user,
		role: event.locals.role
	};

	// Use requireRole for protected route checks
	if (requiresProtection && !requireRole(event.locals.role, 'member')) {
		throw redirect(303, '/');
	}

	return resolve(event);
};

// Add handleStripeRedirects to the sequence, before the other handlers
export const handle = sequence(handleStripeRedirects, handleCookieCheck, handleSupabase, authGuard);
