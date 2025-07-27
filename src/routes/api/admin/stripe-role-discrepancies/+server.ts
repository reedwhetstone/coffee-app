import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe } from '$lib/services/stripe';
import { createAdminClient } from '$lib/supabase-admin';
import { validateAdminAccess } from '$lib/server/auth';

interface DiscrepancyReport {
	shouldBeMemberButArent: UserDiscrepancy[];
	shouldBeViewerButArent: UserDiscrepancy[];
	recentAuditLogs: AuditLogSummary[];
	summary: {
		totalDiscrepancies: number;
		totalStripeCustomers: number;
		lastChecked: string;
	};
}

interface UserDiscrepancy {
	userId: string;
	email: string;
	name?: string;
	currentRole: string;
	expectedRole: string;
	stripeCustomerId: string;
	subscriptionStatus: string;
	subscriptionId?: string;
	lastRoleUpdate?: string;
	issue: string;
}

interface AuditLogSummary {
	userId: string;
	email?: string;
	oldRole: string | null;
	newRole: string;
	triggerType: string;
	createdAt: string;
	stripeCustomerId?: string;
}

// Remove old admin check function - using centralized validation now

export const GET: RequestHandler = async ({ locals }) => {
	try {
		// Verify admin access using centralized validation
		await validateAdminAccess(locals);

		console.log('🔍 Starting Stripe/role discrepancy check');

		const supabase = createAdminClient();
		const stripe = getStripe();

		// Get all Stripe customers from our database
		const { data: stripeCustomers, error: customersError } = await supabase
			.from('stripe_customers')
			.select('user_id, customer_id, email');

		if (customersError) {
			console.error('❌ Error fetching Stripe customers:', customersError);
			return json({ error: 'Database error fetching customers' }, { status: 500 });
		}

		// Get all user roles separately
		const { data: userRoles, error: rolesError } = await supabase
			.from('user_roles')
			.select('id, role, email, name, updated_at');

		if (rolesError) {
			console.error('❌ Error fetching user roles:', rolesError);
			return json({ error: 'Database error fetching roles' }, { status: 500 });
		}

		// Manually join the data
		const customersWithRoles =
			stripeCustomers?.map((customer) => ({
				...customer,
				user_roles: userRoles?.find((role) => role.id === customer.user_id) || null
			})) || [];

		console.log(`📊 Checking ${customersWithRoles?.length || 0} Stripe customers`);

		const shouldBeMemberButArent: UserDiscrepancy[] = [];
		const shouldBeViewerButArent: UserDiscrepancy[] = [];

		// Check each customer's subscription status
		for (const customer of customersWithRoles || []) {
			try {
				const userRole = customer.user_roles as any;

				// Get subscriptions for this customer
				const subscriptions = await stripe.subscriptions.list({
					customer: customer.customer_id,
					status: 'all',
					limit: 10
				});

				// Determine what role they should have based on active subscriptions
				const activeSubscriptions = subscriptions.data.filter(
					(sub) => sub.status === 'active' || sub.status === 'trialing'
				);

				const hasActiveSubscription = activeSubscriptions.length > 0;
				const expectedRole = hasActiveSubscription ? 'member' : 'viewer';
				const currentRole = userRole?.role || 'viewer';

				// Check for discrepancies
				if (expectedRole !== currentRole) {
					const discrepancy: UserDiscrepancy = {
						userId: customer.user_id,
						email: userRole?.email || customer.email || 'Unknown',
						name: userRole?.name,
						currentRole,
						expectedRole,
						stripeCustomerId: customer.customer_id,
						subscriptionStatus:
							activeSubscriptions.length > 0
								? activeSubscriptions[0].status
								: 'no_active_subscription',
						subscriptionId: activeSubscriptions.length > 0 ? activeSubscriptions[0].id : undefined,
						lastRoleUpdate: userRole?.updated_at,
						issue: hasActiveSubscription
							? `Has active subscription but role is ${currentRole}, should be member`
							: `No active subscription but role is ${currentRole}, should be viewer`
					};

					if (expectedRole === 'member' && currentRole !== 'member') {
						shouldBeMemberButArent.push(discrepancy);
					} else if (expectedRole === 'viewer' && currentRole !== 'viewer') {
						shouldBeViewerButArent.push(discrepancy);
					}
				}

				// Add a small delay to avoid rate limiting
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				console.error(`❌ Error checking customer ${customer.customer_id}:`, error);
				// Continue with next customer rather than failing entirely
			}
		}

		// Get recent audit logs for context
		const { data: recentLogs } = await supabase
			.from('role_audit_logs')
			.select(
				`
				user_id,
				old_role,
				new_role,
				trigger_type,
				created_at,
				stripe_customer_id
			`
			)
			.order('created_at', { ascending: false })
			.limit(50);

		// Manually join audit logs with user roles for email
		const recentAuditLogs: AuditLogSummary[] = (recentLogs || []).map((log) => {
			const userRole = userRoles?.find((role) => role.id === log.user_id);
			return {
				userId: log.user_id,
				email: userRole?.email,
				oldRole: log.old_role,
				newRole: log.new_role,
				triggerType: log.trigger_type,
				createdAt: log.created_at,
				stripeCustomerId: log.stripe_customer_id
			};
		});

		const report: DiscrepancyReport = {
			shouldBeMemberButArent,
			shouldBeViewerButArent,
			recentAuditLogs,
			summary: {
				totalDiscrepancies: shouldBeMemberButArent.length + shouldBeViewerButArent.length,
				totalStripeCustomers: customersWithRoles?.length || 0,
				lastChecked: new Date().toISOString()
			}
		};

		console.log('📈 Discrepancy report generated:', {
			shouldBeMember: shouldBeMemberButArent.length,
			shouldBeViewer: shouldBeViewerButArent.length,
			totalCustomers: customersWithRoles?.length || 0
		});

		return json(report);
	} catch (error: any) {
		console.error('❌ Error generating discrepancy report:', error);

		// Handle authentication errors specifically
		if (error.status === 403 || error.status === 401) {
			return json({ error: error.message }, { status: error.status });
		}

		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
};

// POST endpoint to fix a specific discrepancy
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Verify admin access using centralized validation
		const { user: adminUser } = await validateAdminAccess(locals);

		const { userId, expectedRole, reason } = await request.json();

		if (!userId || !expectedRole || !['member', 'viewer'].includes(expectedRole)) {
			return json({ error: 'Invalid parameters' }, { status: 400 });
		}

		const supabase = createAdminClient();

		// Get current role
		const { data: currentRoleData } = await supabase
			.from('user_roles')
			.select('role, email')
			.eq('id', userId)
			.maybeSingle();

		if (!currentRoleData) {
			return json({ error: 'User not found in user_roles' }, { status: 404 });
		}

		const currentRole = currentRoleData.role;

		// Update the role
		const { error: roleError } = await supabase
			.from('user_roles')
			.update({
				role: expectedRole,
				updated_at: new Date().toISOString()
			})
			.eq('id', userId);

		if (roleError) {
			console.error('❌ Error updating user role:', roleError);
			return json({ error: 'Failed to update role' }, { status: 500 });
		}

		// Log the manual role change
		const { error: auditError } = await supabase.from('role_audit_logs').insert({
			user_id: userId,
			old_role: currentRole,
			new_role: expectedRole,
			trigger_type: 'admin_change',
			metadata: {
				reason: reason || 'Manual fix via admin dashboard',
				admin_user: adminUser.id
			},
			created_at: new Date().toISOString()
		});

		if (auditError) {
			console.error('❌ Error logging role change:', auditError);
			// Don't fail the request, just log the error
		}

		console.log(`✅ Admin updated user ${userId} from ${currentRole} to ${expectedRole}`);

		return json({
			success: true,
			message: `User role updated from ${currentRole} to ${expectedRole}`,
			userId,
			oldRole: currentRole,
			newRole: expectedRole
		});
	} catch (error: any) {
		console.error('❌ Error fixing role discrepancy:', error);

		// Handle authentication errors specifically
		if (error.status === 403 || error.status === 401) {
			return json({ error: error.message }, { status: error.status });
		}

		return json({ error: error.message || 'Internal server error' }, { status: 500 });
	}
};
