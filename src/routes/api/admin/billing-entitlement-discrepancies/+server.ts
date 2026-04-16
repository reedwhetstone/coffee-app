import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import {
	buildBillingEntitlementDiscrepancyReport,
	repairBillingEntitlementDiscrepancy,
	type BillingEntitlementAuditLogSummary
} from '$lib/server/billing/admin-discrepancies';
import { createAdminClient } from '$lib/supabase-admin';
import { validateAdminAccess } from '$lib/server/auth';
import type { Database } from '$lib/types/database.types';

export const GET: RequestHandler = async (event) => {
	try {
		await validateAdminAccess(event);

		const supabase = createAdminClient() as SupabaseClient<Database>;
		const lastChecked = new Date().toISOString();

		const { data: stripeCustomers, error: customersError } = (await supabase
			.from('stripe_customers')
			.select('user_id, customer_id, email')) as {
			data: { user_id: string; customer_id: string; email: string | null }[] | null;
			error: PostgrestError | null;
		};

		if (customersError) {
			return json({ error: 'Database error fetching Stripe customers' }, { status: 500 });
		}

		const { data: userRoles, error: userRolesError } = (await supabase
			.from('user_roles')
			.select('id, email, name, role, user_role, api_plan, ppi_access, updated_at')) as {
			data:
				| {
						id: string;
						email: string | null;
						name: string | null;
						role: Database['public']['Tables']['user_roles']['Row']['role'];
						user_role: string[];
						api_plan: Database['public']['Tables']['user_roles']['Row']['api_plan'];
						ppi_access: boolean;
						updated_at: string;
				  }[]
				| null;
			error: PostgrestError | null;
		};

		if (userRolesError) {
			return json({ error: 'Database error fetching user entitlements' }, { status: 500 });
		}

		const { data: billingSubscriptions, error: billingSubscriptionsError } = await supabase
			.from('billing_subscriptions')
			.select('*');

		if (billingSubscriptionsError) {
			return json({ error: 'Database error fetching billing snapshots' }, { status: 500 });
		}

		const { data: recentLogs, error: recentLogsError } = (await supabase
			.from('role_audit_logs')
			.select('user_id, old_role, new_role, trigger_type, created_at, stripe_customer_id, metadata')
			.order('created_at', { ascending: false })
			.limit(50)) as {
			data:
				| {
						user_id: string;
						old_role: string | null;
						new_role: string;
						trigger_type: string;
						created_at: string;
						stripe_customer_id: string | null;
						metadata: Database['public']['Tables']['role_audit_logs']['Row']['metadata'];
				  }[]
				| null;
			error: PostgrestError | null;
		};

		if (recentLogsError) {
			return json({ error: 'Database error fetching audit logs' }, { status: 500 });
		}

		const recentAuditLogs: BillingEntitlementAuditLogSummary[] = (recentLogs || []).map((log) => {
			const userRole = userRoles?.find((row) => row.id === log.user_id);
			return {
				userId: log.user_id,
				email: userRole?.email ?? undefined,
				oldRole: log.old_role,
				newRole: log.new_role,
				triggerType: log.trigger_type,
				createdAt: log.created_at,
				stripeCustomerId: log.stripe_customer_id ?? undefined,
				metadata: log.metadata
			};
		});

		return json(
			buildBillingEntitlementDiscrepancyReport({
				userRoles: userRoles || [],
				stripeCustomers: stripeCustomers || [],
				billingSubscriptions: billingSubscriptions || [],
				recentAuditLogs,
				lastChecked
			})
		);
	} catch (error: unknown) {
		const err = error as { status?: number; message?: string };
		if (err.status === 403 || err.status === 401) {
			return json({ error: err.message }, { status: err.status });
		}

		return json({ error: err.message || 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const { user: adminUser } = await validateAdminAccess(event);
		const { userId, reason } = await event.request.json();

		if (!userId || typeof userId !== 'string') {
			return json({ error: 'Missing or invalid userId' }, { status: 400 });
		}

		const supabase = createAdminClient() as SupabaseClient<Database>;
		const repairResult = await repairBillingEntitlementDiscrepancy(supabase, {
			userId,
			adminUserId: adminUser.id,
			reason: typeof reason === 'string' ? reason : undefined
		});

		return json({
			success: true,
			message: repairResult.changed
				? 'Billing entitlements recomputed and repaired'
				: 'Billing entitlements were already canonical; audit log recorded the recompute',
			userId,
			changed: repairResult.changed,
			previousEntitlements: repairResult.previousEntitlements,
			resolvedEntitlements: repairResult.resolvedEntitlements,
			billingSubscriptions: repairResult.subscriptions.map((row) => ({
				stripeSubscriptionId: row.stripe_subscription_id,
				stripeSubscriptionItemId: row.stripe_subscription_item_id,
				stripePriceId: row.stripe_price_id,
				productFamily: row.product_family,
				productKey: row.product_key,
				status: row.status,
				cancelAtPeriodEnd: row.cancel_at_period_end,
				currentPeriodEnd: row.current_period_end
			}))
		});
	} catch (error: unknown) {
		const err = error as { status?: number; message?: string };
		if (err.status === 403 || err.status === 401) {
			return json({ error: err.message }, { status: err.status });
		}

		return json({ error: err.message || 'Internal server error' }, { status: 500 });
	}
};
