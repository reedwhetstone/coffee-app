import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';

	if (!user) {
		return {
			role,
			user: null,
			formCatalog: null,
			showForm: false
		};
	}

	const wantsForm = url.searchParams.get('modal') === 'new';

	// Fetch catalog data for the form dropdown (only when form is requested)
	const formCatalogPromise = wantsForm
		? locals.supabase.from('coffee_catalog').select('*').order('name', { ascending: true })
		: Promise.resolve(null);

	const [formCatalogResult] = await Promise.all([formCatalogPromise]);

	return {
		role,
		user: { id: user.id },
		formCatalog: formCatalogResult?.data ?? null,
		showForm: wantsForm
	};
};
