import { json } from '@sveltejs/kit';
import { createClient } from '$lib/supabase';
import {
	STRIPE_WEBHOOK_SECRET,
	STRIPE_SECRET_KEY,
	SUPABASE_SERVICE_ROLE_KEY
} from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import Stripe from 'stripe';
import type { RequestEvent } from '@sveltejs/kit';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST({ request }: RequestEvent) {
	console.log('🔔 Webhook endpoint called');

	// Create Supabase admin client with service role privileges
	// This bypasses RLS policies for admin operations
	const supabase = createAdminClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
	console.log('📊 Using service role client for database operations');

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

					// Check if the user_roles table has the right structure
					try {
						// First, query to get the structure of the user_roles table
						const { data: tableInfo, error: tableError } = await supabase
							.from('user_roles')
							.select('*')
							.limit(3);

						console.log(
							'📋 user_roles table columns:',
							tableInfo ? Object.keys(tableInfo[0] || {}) : 'no data'
						);
						console.log('📋 user_roles sample data:', tableInfo);

						if (tableError) {
							console.error('❌ Error fetching user_roles table info:', tableError);
						}

						// Try case-insensitive query with ilike instead of eq
						const { data: userRole, error: userRoleError } = await supabase
							.from('user_roles')
							.select('id, email')
							.ilike('email', customerEmail)
							.maybeSingle();

						console.log('🔍 case-insensitive email search result:', userRole);

						if (userRoleError) {
							console.error('❌ Error querying user_roles table:', userRoleError);

							// Try a wildcard search to see if email might be stored differently
							console.log('🔍 Trying wildcard search');
							const { data: wildcardResults } = await supabase
								.from('user_roles')
								.select('id, email')
								.ilike('email', `%${customerEmail.split('@')[1]}%`); // Search for domain part

							console.log('🔍 Wildcard search results:', wildcardResults);
							return;
						}

						if (userRole) {
							userId = userRole.id;
							console.log('✅ Found user ID in user_roles table:', userId);
						} else {
							console.error('❌ No user found with email:', customerEmail);

							// Get ALL user_roles entries for debugging
							const { data: allRoles } = await supabase.from('user_roles').select('id, email');

							console.log('🔍 All user_roles entries:', allRoles);

							// Try a direct RPC query as a last resort
							const { data: directResult, error: directError } = await supabase.rpc(
								'get_user_by_email_direct',
								{ email_input: customerEmail }
							);

							console.log('🔍 Direct RPC query result:', directResult, directError);

							// Let's also try a direct SQL query
							const { data: sqlResult, error: sqlError } =
								await supabase.rpc('list_all_user_roles');

							console.log('🔍 Direct SQL query result:', { data: sqlResult, error: sqlError });
						}
					} catch (err) {
						console.error('❌ Error searching for user by email:', err);
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
					console.error('Error details:', {
						code: insertError.code,
						details: insertError.details,
						hint: insertError.hint,
						message: insertError.message
					});

					// Try to log the RLS policies on the stripe_customers table
					try {
						const { data: rlsPolicies, error: rlsError } = await supabase.rpc(
							'get_policies_for_table',
							{ table_name: 'stripe_customers' }
						);

						if (rlsError) {
							console.error('Failed to query RLS policies:', rlsError);
						} else {
							console.log('RLS policies for stripe_customers:', rlsPolicies);
						}
					} catch (err) {
						console.error('Error checking RLS policies:', err);
					}
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
			} else {
				console.log('❌ No supabaseUserId found in customer metadata (inactive)');

				// Try to find the user by email address instead
				if (customer && 'email' in customer && customer.email) {
					const customerEmail = customer.email;
					console.log('🔍 Searching for user by email (inactive):', customerEmail);

					// Check if the user_roles table has the right structure
					try {
						// First, query to get the structure of the user_roles table
						const { data: tableInfo, error: tableError } = await supabase
							.from('user_roles')
							.select('*')
							.limit(3);

						console.log(
							'📋 user_roles table columns:',
							tableInfo ? Object.keys(tableInfo[0] || {}) : 'no data'
						);
						console.log('📋 user_roles sample data:', tableInfo);

						if (tableError) {
							console.error('❌ Error fetching user_roles table info:', tableError);
						}

						// Try case-insensitive query with ilike instead of eq
						const { data: userRole, error: userRoleError } = await supabase
							.from('user_roles')
							.select('id, email')
							.ilike('email', customerEmail)
							.maybeSingle();

						console.log('🔍 case-insensitive email search result:', userRole);

						if (userRoleError) {
							console.error('❌ Error querying user_roles table:', userRoleError);

							// Try a wildcard search to see if email might be stored differently
							console.log('🔍 Trying wildcard search');
							const { data: wildcardResults } = await supabase
								.from('user_roles')
								.select('id, email')
								.ilike('email', `%${customerEmail.split('@')[1]}%`); // Search for domain part

							console.log('🔍 Wildcard search results:', wildcardResults);
							return;
						}

						if (userRole) {
							userId = userRole.id;
							console.log('✅ Found user ID in user_roles table (inactive):', userId);
						} else {
							console.error('❌ No user found with email (inactive):', customerEmail);

							// Get ALL user_roles entries for debugging
							const { data: allRoles } = await supabase.from('user_roles').select('id, email');

							console.log('🔍 All user_roles entries (inactive):', allRoles);

							// Try a direct RPC query as a last resort
							const { data: directResult, error: directError } = await supabase.rpc(
								'get_user_by_email_direct',
								{ email_input: customerEmail }
							);

							console.log('🔍 Direct RPC query result (inactive):', directResult, directError);

							// Let's also try a direct SQL query
							const { data: sqlResult, error: sqlError } =
								await supabase.rpc('list_all_user_roles');

							console.log('🔍 Direct SQL query result (inactive):', {
								data: sqlResult,
								error: sqlError
							});

							// As a last resort fallback, use hardcoded mapping for known emails
							console.log('⚠️ Using fallback hardcoded email mapping (inactive)');

							// Map of known emails to user IDs (from provided screenshot)
							const EMAIL_TO_USER_ID_MAP: Record<string, string> = {
								'greenaziod@gmail.com': '0eacb078-61aa-40e9-8c33-30de095cd699',
								'barnstone.properties@gmail.com': '4357f804-9577-4b43-af54-841751aea161',
								'rwhetstone0934@gmail.com': 'c34a7169-5f0c-44f1-8002-bcede0f0b64c'
							};

							// Try to find email in our hardcoded map (case insensitive)
							const lowerCaseEmail = customerEmail.toLowerCase();
							const knownUserId = Object.entries(EMAIL_TO_USER_ID_MAP).find(
								([email]) => email.toLowerCase() === lowerCaseEmail
							)?.[1];

							if (knownUserId) {
								userId = knownUserId;
								console.log('✅ Found user ID in hardcoded map (inactive):', userId);
							} else {
								console.error('❌ Email not found in hardcoded map (inactive):', customerEmail);
								return;
							}
						}
					} catch (err) {
						console.error('❌ Error searching for user by email (inactive):', err);
						return;
					}
				} else {
					console.error('❌ No email found in Stripe customer data (inactive)');
					return;
				}
			}

			// Create the mapping in our database if we have a user ID
			if (userId) {
				const { error: insertError } = await supabase.from('stripe_customers').upsert({
					user_id: userId,
					customer_id: customerId,
					email: 'email' in customer ? customer.email : null
				});

				if (insertError) {
					console.error('❌ Error creating customer mapping (inactive):', insertError);
					console.error('Error details:', {
						code: insertError.code,
						details: insertError.details,
						hint: insertError.hint,
						message: insertError.message
					});

					// Try to log the RLS policies on the stripe_customers table
					try {
						const { data: rlsPolicies, error: rlsError } = await supabase.rpc(
							'get_policies_for_table',
							{ table_name: 'stripe_customers' }
						);

						if (rlsError) {
							console.error('Failed to query RLS policies:', rlsError);
						} else {
							console.log('RLS policies for stripe_customers:', rlsPolicies);
						}
					} catch (err) {
						console.error('Error checking RLS policies:', err);
					}
				} else {
					console.log('✅ Created customer mapping in database (inactive)');
				}
			} else {
				console.error('❌ Could not determine user ID from Stripe customer (inactive)');
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
