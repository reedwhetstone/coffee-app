import type { PageServerLoad } from './$types';
import { createClient } from '$lib/supabase';

export const load: PageServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	const role = locals.role || 'viewer';

	// If user is logged in, check if they already have a Stripe customer ID
	if (user) {
		const supabase = createClient();

		// Check if user already exists in stripe_customers table
		const { data: customerData, error: customerError } = await supabase
			.from('stripe_customers')
			.select('customer_id')
			.eq('user_id', user.id)
			.maybeSingle();

		if (customerError) {
			console.error('Error checking for Stripe customer:', customerError);
		}

		return {
			session,
			role,
			stripeCustomerId: customerData?.customer_id || null
		};
	}

	return {
		session,
		role
	};
};
