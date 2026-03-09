import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';

	if (!user) {
		return {
			role,
			user: null,
			profiles: [],
			formCoffees: null,
			showForm: false,
			preSelectedBean: null
		};
	}

	const wantsForm = url.searchParams.get('modal') === 'new';
	const beanId = url.searchParams.get('beanId');
	const beanName = url.searchParams.get('beanName');

	// Pre-selected bean from URL (e.g. navigating from bean detail page)
	const preSelectedBean =
		beanId && beanName ? { id: parseInt(beanId), name: decodeURIComponent(beanName) } : null;

	// Fetch roast profiles (always needed for the page)
	const profilesPromise = locals.supabase
		.from('roast_profiles')
		.select('*')
		.eq('user', user.id)
		.order('roast_date', { ascending: false });

	// Fetch stocked coffees for form dropdown (only the fields the form needs)
	// The form needs: id, name (via coffee_catalog), stocked flag
	const formCoffeesPromise = wantsForm
		? locals.supabase
				.from('green_coffee_inv')
				.select(
					`
				id,
				stocked,
				coffee_catalog!catalog_id (
					name
				)
			`
				)
				.eq('user', user.id)
				.eq('stocked', true)
		: Promise.resolve(null);

	const [profilesResult, formCoffeesResult] = await Promise.all([
		profilesPromise,
		formCoffeesPromise
	]);

	return {
		role,
		user: { id: user.id },
		profiles: profilesResult.data ?? [],
		formCoffees: formCoffeesResult?.data ?? null,
		showForm: wantsForm,
		preSelectedBean
	};
};
