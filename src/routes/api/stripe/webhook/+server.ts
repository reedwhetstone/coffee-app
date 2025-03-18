import { json } from '@sveltejs/kit';
import { createClient } from '$lib/supabase';
import { STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY } from '$env/static/private';
import Stripe from 'stripe';
import type { RequestEvent } from '@sveltejs/kit';

export async function POST({ request }: RequestEvent) {
	console.log('🔔 Webhook endpoint called');

	// Create Supabase admin client with server-side privileges
	const supabase = createClient();

	// Get the signature from the headers
	const signature = request.headers.get('stripe-signature');
	console.log('🔑 Stripe signature present:', !!signature);

	if (!signature) {
		console.error('❌ No Stripe signature found in request');
		return json({ error: 'No signature' }, { status: 400 });
	}

	try {
		// Get the raw body as text
		const body = await request.text();
		console.log('📦 Webhook body length:', body.length);
		console.log('📦 Webhook body preview:', body.substring(0, 200) + '...');

		// Basic validation
		if (!body) {
			console.error('❌ Empty request body');
			return json({ error: 'Empty body' }, { status: 400 });
		}

		// Log environment variables (sanitized)
		console.log('🔐 STRIPE_SECRET_KEY present:', !!STRIPE_SECRET_KEY);
		console.log('🔐 STRIPE_WEBHOOK_SECRET present:', !!STRIPE_WEBHOOK_SECRET);

		// Initialize Stripe for verification
		const stripe = new Stripe(STRIPE_SECRET_KEY, {
			apiVersion: '2025-02-24.acacia'
		});
		console.log('✅ Stripe client initialized');

		// Verify the webhook signature
		let event;
		try {
			event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
			console.log('✅ Webhook signature verified successfully');
		} catch (err) {
			console.error('❌ Webhook signature verification failed:', err);
			return json({ error: 'Invalid signature' }, { status: 400 });
		}

		// Log the event details
		console.log(`📣 Received Stripe event: ${event.type}`);
		console.log('📊 Event data:', JSON.stringify(event.data.object).substring(0, 200) + '...');

		// Handle specific events
		switch (event.type) {
			case 'checkout.session.completed':
				// Handle successful checkout
				const session = event.data.object;
				console.log('💰 Checkout session completed');
				console.log('🧑 Customer ID:', session.customer);
				console.log('📝 Subscription ID:', session.subscription);

				// Check if client_reference_id contains a Supabase user ID
				if (session.client_reference_id && session.customer) {
					console.log('🔑 Client reference ID found:', session.client_reference_id);

					// Store this ID as supabaseUserId in the customer metadata
					try {
						const stripe = new Stripe(STRIPE_SECRET_KEY, {
							apiVersion: '2025-02-24.acacia'
						});

						const customerId =
							typeof session.customer === 'string' ? session.customer : session.customer.id;

						await stripe.customers.update(customerId, {
							metadata: {
								supabaseUserId: session.client_reference_id
							}
						});

						console.log('✅ Updated customer metadata with user ID');
					} catch (err) {
						console.error('❌ Error updating customer metadata:', err);
					}
				}

				// If this created a subscription, handle it
				if (session.mode === 'subscription' && session.subscription) {
					console.log('✅ Subscription created in checkout, retrieving details');
					try {
						const stripe = new Stripe(STRIPE_SECRET_KEY, {
							apiVersion: '2025-02-24.acacia'
						});

						const subscriptionId =
							typeof session.subscription === 'string'
								? session.subscription
								: session.subscription.id;

						const subscription = await stripe.subscriptions.retrieve(subscriptionId);
						await handleSubscriptionActive(subscription, supabase);
					} catch (err) {
						console.error('❌ Error retrieving subscription details:', err);
					}
				}
				break;

			case 'customer.subscription.created':
			case 'customer.subscription.updated':
				// Handle subscription creation or update
				const subscription = event.data.object;
				console.log('📋 Subscription status:', subscription.status);
				console.log('🧑 Customer ID:', subscription.customer);

				if (subscription.status === 'active' || subscription.status === 'trialing') {
					console.log('✅ Handling active subscription');
					await handleSubscriptionActive(subscription, supabase);
				} else if (
					subscription.status === 'canceled' ||
					subscription.status === 'unpaid' ||
					subscription.status === 'past_due'
				) {
					console.log('⚠️ Handling inactive subscription');
					await handleSubscriptionInactive(subscription, supabase);
				}
				break;

			case 'customer.subscription.deleted':
				// Handle subscription cancellation
				console.log('❌ Handling deleted subscription');
				await handleSubscriptionInactive(event.data.object, supabase);
				break;

			// Add other event types as needed
			default:
				console.log(`⚠️ Unhandled event type: ${event.type}`);
		}

		console.log('✅ Webhook processing completed successfully');
		return json({ received: true });
	} catch (err) {
		console.error('❌ Error processing webhook:', err);
		return json({ error: 'Webhook error' }, { status: 400 });
	}
}

async function handleSubscriptionActive(subscription: any, supabase: any) {
	const customerId = subscription.customer;
	console.log('🔍 Looking up user for Stripe customer:', customerId);

	// Look up existing mapping
	const { data: customerData, error: customerError } = await supabase
		.from('stripe_customers')
		.select('user_id')
		.eq('customer_id', customerId)
		.single();

	console.log('🔍 Customer lookup result:', { data: customerData, error: customerError });

	let userId;

	if (customerError || !customerData) {
		console.log('❓ Customer mapping not found, checking Stripe metadata...');

		// If customer mapping doesn't exist, try to get user_id from Stripe customer metadata
		try {
			const stripe = new Stripe(STRIPE_SECRET_KEY, {
				apiVersion: '2025-02-24.acacia'
			});

			const customer = await stripe.customers.retrieve(customerId);

			// Check for supabaseUserId in metadata
			if (
				customer &&
				'metadata' in customer &&
				customer.metadata &&
				customer.metadata.supabaseUserId
			) {
				userId = customer.metadata.supabaseUserId;
				console.log('✅ Found user ID in Stripe metadata:', userId);
			} else {
				console.log('❌ No supabaseUserId found in customer metadata');

				// Try to find the user by email address instead
				if (customer && 'email' in customer && customer.email) {
					const customerEmail = customer.email;
					console.log('🔍 Searching for user by email:', customerEmail);

					type User = { id: string; email: string | null };
					type ListUsersResponse = {
						data: { users: User[] };
						error: Error | null;
					};

					// Query the auth.users table using the service role
					// The service role in Supabase can access auth tables
					const { data: userData, error: userError } = await supabase.auth.admin
						.listUsers()
						.then((response: ListUsersResponse) => {
							if (response.error) return { data: null, error: response.error };

							// Find the user with the matching email
							const matchedUser = response.data.users.find(
								(user: User) => user.email?.toLowerCase() === customerEmail.toLowerCase()
							);

							return {
								data: matchedUser || null,
								error: null
							};
						})
						.catch((err: Error) => ({ data: null, error: err }));

					console.log('🔍 User lookup result:', userData ? 'User found' : 'No user found');

					if (userError) {
						console.error('❌ Error querying users:', userError);
						return;
					}

					if (userData) {
						userId = userData.id;
						console.log('✅ Found user ID by email lookup:', userId);
					} else {
						console.error('❌ No user found with email:', customer.email);
						return;
					}
				} else {
					console.error('❌ No email found in Stripe customer data');
					return;
				}
			}

			// Create the mapping in our database
			if (userId) {
				const { error: insertError } = await supabase.from('stripe_customers').upsert({
					user_id: userId,
					customer_id: customerId,
					email: 'email' in customer ? customer.email : null
				});

				if (insertError) {
					console.error('❌ Error creating customer mapping:', insertError);
				} else {
					console.log('✅ Created customer mapping in database');
				}
			} else {
				console.error('❌ Could not determine user ID from Stripe customer');
				return;
			}
		} catch (err) {
			console.error('❌ Error retrieving customer from Stripe:', err);
			return;
		}
	} else {
		userId = customerData.user_id;
		console.log('✅ Found user ID in database:', userId);
	}

	// Update user role to 'member'
	console.log('🔄 Updating user role to member for user:', userId);
	const { error: updateError } = await supabase
		.from('user_roles')
		.upsert({ id: userId, role: 'member' }, { onConflict: 'id' });

	if (updateError) {
		console.error('❌ Error updating user role:', updateError);

		// Check if the user_roles table exists and has the right structure
		const { data: tableInfo, error: tableError } = await supabase
			.from('user_roles')
			.select('*')
			.limit(3);

		console.log('🔍 user_roles table info:', { data: tableInfo, error: tableError });
	} else {
		console.log(`✅ Updated user ${userId} to member role`);
	}
}

async function handleSubscriptionInactive(subscription: any, supabase: any) {
	const customerId = subscription.customer;
	console.log('🔍 Looking up user for Stripe customer (inactive):', customerId);

	// Look up existing mapping
	const { data: customerData, error: customerError } = await supabase
		.from('stripe_customers')
		.select('user_id')
		.eq('customer_id', customerId)
		.single();

	console.log('🔍 Customer lookup result (inactive):', {
		data: customerData,
		error: customerError
	});

	let userId;

	if (customerError || !customerData) {
		console.log(
			'❓ Customer mapping not found for inactive subscription, checking Stripe metadata...'
		);

		// If customer mapping doesn't exist, try to get user_id from Stripe customer metadata
		try {
			const stripe = new Stripe(STRIPE_SECRET_KEY, {
				apiVersion: '2025-02-24.acacia'
			});

			const customer = await stripe.customers.retrieve(customerId);

			// Check for supabaseUserId in metadata
			if (
				customer &&
				'metadata' in customer &&
				customer.metadata &&
				customer.metadata.supabaseUserId
			) {
				userId = customer.metadata.supabaseUserId;
				console.log('✅ Found user ID in Stripe metadata (inactive):', userId);

				// Create the mapping in our database
				const { error: insertError } = await supabase.from('stripe_customers').upsert({
					user_id: userId,
					customer_id: customerId,
					email: 'email' in customer ? customer.email : null
				});

				if (insertError) {
					console.error('❌ Error creating customer mapping (inactive):', insertError);
				} else {
					console.log('✅ Created customer mapping in database (inactive)');
				}
			} else {
				console.error('❌ No supabaseUserId found in customer metadata (inactive)');
				return;
			}
		} catch (err) {
			console.error('❌ Error retrieving customer from Stripe (inactive):', err);
			return;
		}
	} else {
		userId = customerData.user_id;
		console.log('✅ Found user ID in database (inactive):', userId);
	}

	// Update user role to 'viewer'
	console.log('🔄 Updating user role to viewer for user:', userId);
	const { error: updateError } = await supabase
		.from('user_roles')
		.upsert({ id: userId, role: 'viewer' }, { onConflict: 'id' });

	if (updateError) {
		console.error('❌ Error updating user role (inactive):', updateError);
	} else {
		console.log(`✅ Updated user ${userId} to viewer role`);
	}
}
