import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	const sessionData = await locals.safeGetSession();
	// sessionData is already typed from safeGetSession, so we can destructure directly or use type assertion if needed but avoid any
	const { session, user } = sessionData;
	const role = locals.role || 'viewer';

	// Require authentication
	if (!session || !user) {
		throw redirect(303, '/auth');
	}

	// Require admin role for access to admin dashboard
	if (!requireRole(role, 'admin')) {
		throw redirect(303, '/');
	}

	return {
		user,
		role,
		meta: {
			title: 'Admin Dashboard - Purveyors',
			description: 'Administrative dashboard for managing users, roles, and system monitoring'
		}
	};
};
