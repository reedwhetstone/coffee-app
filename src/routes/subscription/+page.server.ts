import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Get session from locals
	const session = locals.session;

	return {
		session
	};
};
