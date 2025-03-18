import type { PageServerLoad } from './$types';
import { createClient } from '$lib/supabase';

// This runs on the server when the page is loaded
export const load: PageServerLoad = async ({ locals }) => {
	// Get session from locals
	const session = locals.session;

	// If user is logged in, check if they already have a Stripe customer ID
	if (session?.user) {
		const supabase = createClient();

		// Check if user already exists in stripe_customers table
		const { data: customerData, error: customerError } = await supabase
			.from('stripe_customers')
			.select('customer_id')
			.eq('user_id', session.user.id)
			.maybeSingle();

		if (customerError) {
			console.error('Error checking for Stripe customer:', customerError);
		}

		return {
			session,
			stripeCustomerId: customerData?.customer_id || null
		};
	}

	return {
		session
	};
};
