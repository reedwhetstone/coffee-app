import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';

export const load = async ({ locals: { safeGetSession } }) => {
	const { role } = await safeGetSession();

	if (role !== 'admin') {
		throw redirect(303, '/');
	}

	return {
		role
	};
};
