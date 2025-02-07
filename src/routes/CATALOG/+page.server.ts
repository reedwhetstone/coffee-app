import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { user } }) => {
	if (user?.email !== 'rwhetstone0934@gmail.com') {
		throw redirect(303, '/');
	}

	return {
		user
	};
};
