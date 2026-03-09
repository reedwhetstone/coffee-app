import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';

	if (!user) {
		return {
			role,
			user: null,
			formCoffees: null,
			formBatches: null,
			showForm: false
		};
	}

	const wantsForm = url.searchParams.get('modal') === 'new';

	// Fetch form data only when form is requested
	const formCoffeesPromise = wantsForm
		? locals.supabase
				.from('green_coffee_inv')
				.select('*, coffee_catalog!catalog_id(*)')
				.eq('user', user.id)
				.eq('stocked', true)
		: Promise.resolve(null);

	const formBatchesPromise = wantsForm
		? locals.supabase.from('roast_profiles').select('batch_name, coffee_id').eq('user', user.id)
		: Promise.resolve(null);

	const [formCoffeesResult, formBatchesResult] = await Promise.all([
		formCoffeesPromise,
		formBatchesPromise
	]);

	return {
		role,
		user: { id: user.id },
		formCoffees: formCoffeesResult?.data ?? null,
		formBatches: formBatchesResult?.data ?? null,
		showForm: wantsForm
	};
};
