import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/server/auth';
import { getPageAuthState } from '$lib/server/pageAuth';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user, role } = getPageAuthState(locals.principal);

	// Require authentication
	if (!session || !user) {
		throw redirect(303, '/auth');
	}

	// Require admin role for access to admin dashboard
	if (!requireRole(role, 'admin')) {
		throw redirect(303, '/');
	}

	return {
		meta: {
			title: 'Admin Dashboard - Purveyors',
			description: 'Administrative dashboard for managing users, roles, and system monitoring'
		}
	};
};
