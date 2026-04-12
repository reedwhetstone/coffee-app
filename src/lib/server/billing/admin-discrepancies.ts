import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '$lib/types/database.types';

import {
	recomputeUserBillingEntitlements,
	resolveBillingEntitlements,
	type ResolvedBillingEntitlements
} from './entitlements';

type UserRolesRow = Database['public']['Tables']['user_roles']['Row'];
type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];

export interface BillingEntitlementActualState {
	role: UserRolesRow['role'] | null;
	userRole: string[];
	apiPlan: UserRolesRow['api_plan'] | null;
	ppiAccess: boolean | null;
}

export interface BillingSubscriptionSnapshotSummary {
	id: string;
	stripeSubscriptionId: string;
	stripeSubscriptionItemId: string;
	stripePriceId: string;
	productFamily: string;
	productKey: string;
	status: string;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	metadata: Json;
	updatedAt: string | null;
}

export interface BillingEntitlementDiscrepancy {
	userId: string;
	email: string;
	name?: string;
	stripeCustomerId?: string;
	actual: BillingEntitlementActualState;
	expected: ResolvedBillingEntitlements;
	issueFields: Array<'role' | 'user_role' | 'api_plan' | 'ppi_access'>;
	issueSummary: string[];
	lastEntitlementUpdate?: string;
	billingSubscriptions: BillingSubscriptionSnapshotSummary[];
}

export interface BillingEntitlementAuditLogSummary {
	userId: string;
	email?: string;
	oldRole: string | null;
	newRole: string;
	triggerType: string;
	createdAt: string;
	stripeCustomerId?: string;
	metadata?: Json;
}

export interface BillingEntitlementDiscrepancyReport {
	discrepancies: BillingEntitlementDiscrepancy[];
	recentAuditLogs: BillingEntitlementAuditLogSummary[];
	summary: {
		totalDiscrepancies: number;
		totalTrackedUsers: number;
		totalStripeCustomers: number;
		totalUsersWithBillingSnapshots: number;
		lastChecked: string;
	};
}

interface BillingTrackedUser {
	userId: string;
	email: string;
	name?: string;
	stripeCustomerId?: string;
	userRoleRow: Pick<
		UserRolesRow,
		'id' | 'email' | 'name' | 'role' | 'user_role' | 'api_plan' | 'ppi_access' | 'updated_at'
	> | null;
	billingSubscriptions: BillingSubscriptionRow[];
}

function arraysEqual(left: string[], right: string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((value, index) => value === right[index]);
}

function summarizeBillingSubscription(
	row: BillingSubscriptionRow
): BillingSubscriptionSnapshotSummary {
	return {
		id: row.id,
		stripeSubscriptionId: row.stripe_subscription_id,
		stripeSubscriptionItemId: row.stripe_subscription_item_id,
		stripePriceId: row.stripe_price_id,
		productFamily: row.product_family,
		productKey: row.product_key,
		status: row.status,
		currentPeriodEnd: row.current_period_end,
		cancelAtPeriodEnd: row.cancel_at_period_end,
		metadata: row.metadata,
		updatedAt: row.updated_at
	};
}

function buildIssueSummary(input: {
	actual: BillingEntitlementActualState;
	expected: ResolvedBillingEntitlements;
	issueFields: BillingEntitlementDiscrepancy['issueFields'];
}): string[] {
	return input.issueFields.map((field) => {
		switch (field) {
			case 'role':
				return `role is ${input.actual.role ?? 'null'} but should be ${input.expected.role}`;
			case 'user_role':
				return `user_role is [${input.actual.userRole.join(', ')}] but should mirror [${input.expected.userRole.join(', ')}]`;
			case 'api_plan':
				return `api_plan is ${input.actual.apiPlan ?? 'null'} but should be ${input.expected.apiPlan}`;
			case 'ppi_access':
				return `ppi_access is ${String(input.actual.ppiAccess)} but should be ${String(input.expected.ppiAccess)}`;
		}
	});
}

export function buildBillingEntitlementDiscrepancy(
	trackedUser: BillingTrackedUser
): BillingEntitlementDiscrepancy | null {
	const actual: BillingEntitlementActualState = {
		role: trackedUser.userRoleRow?.role ?? null,
		userRole: Array.isArray(trackedUser.userRoleRow?.user_role)
			? trackedUser.userRoleRow.user_role
			: [],
		apiPlan: trackedUser.userRoleRow?.api_plan ?? null,
		ppiAccess:
			typeof trackedUser.userRoleRow?.ppi_access === 'boolean'
				? trackedUser.userRoleRow.ppi_access
				: null
	};

	const expected = resolveBillingEntitlements({
		currentRole: trackedUser.userRoleRow?.role,
		currentApiPlan: trackedUser.userRoleRow?.api_plan,
		currentPpiAccess: trackedUser.userRoleRow?.ppi_access,
		subscriptions: trackedUser.billingSubscriptions
	});

	const issueFields: BillingEntitlementDiscrepancy['issueFields'] = [];

	if (actual.role !== expected.role) {
		issueFields.push('role');
	}

	if (!arraysEqual(actual.userRole, expected.userRole)) {
		issueFields.push('user_role');
	}

	if (actual.apiPlan !== expected.apiPlan) {
		issueFields.push('api_plan');
	}

	if (actual.ppiAccess !== expected.ppiAccess) {
		issueFields.push('ppi_access');
	}

	if (issueFields.length === 0) {
		return null;
	}

	return {
		userId: trackedUser.userId,
		email: trackedUser.email,
		name: trackedUser.name,
		stripeCustomerId: trackedUser.stripeCustomerId,
		actual,
		expected,
		issueFields,
		issueSummary: buildIssueSummary({ actual, expected, issueFields }),
		lastEntitlementUpdate: trackedUser.userRoleRow?.updated_at ?? undefined,
		billingSubscriptions: trackedUser.billingSubscriptions.map(summarizeBillingSubscription)
	};
}

export function buildBillingEntitlementDiscrepancyReport(input: {
	userRoles: Array<
		Pick<
			UserRolesRow,
			'id' | 'email' | 'name' | 'role' | 'user_role' | 'api_plan' | 'ppi_access' | 'updated_at'
		>
	>;
	stripeCustomers: Array<{
		user_id: string;
		customer_id: string;
		email: string | null;
	}>;
	billingSubscriptions: BillingSubscriptionRow[];
	recentAuditLogs: BillingEntitlementAuditLogSummary[];
	lastChecked?: string;
}): BillingEntitlementDiscrepancyReport {
	const userRolesById = new Map(input.userRoles.map((row) => [row.id, row]));
	const stripeCustomersByUserId = new Map(
		input.stripeCustomers.map((row) => [row.user_id, row] as const)
	);
	const subscriptionsByUserId = new Map<string, BillingSubscriptionRow[]>();

	for (const subscription of input.billingSubscriptions) {
		const existing = subscriptionsByUserId.get(subscription.user_id) ?? [];
		existing.push(subscription);
		subscriptionsByUserId.set(subscription.user_id, existing);
	}

	const trackedUserIds = new Set<string>([
		...input.userRoles.map((row) => row.id),
		...input.stripeCustomers.map((row) => row.user_id),
		...input.billingSubscriptions.map((row) => row.user_id)
	]);

	const discrepancies = [...trackedUserIds]
		.map((userId) => {
			const userRoleRow = userRolesById.get(userId) ?? null;
			const stripeCustomer = stripeCustomersByUserId.get(userId);
			const trackedUser: BillingTrackedUser = {
				userId,
				email: userRoleRow?.email ?? stripeCustomer?.email ?? 'Unknown',
				name: userRoleRow?.name ?? undefined,
				stripeCustomerId: stripeCustomer?.customer_id ?? undefined,
				userRoleRow,
				billingSubscriptions: subscriptionsByUserId.get(userId) ?? []
			};

			return buildBillingEntitlementDiscrepancy(trackedUser);
		})
		.filter((discrepancy): discrepancy is BillingEntitlementDiscrepancy => discrepancy !== null)
		.sort((left, right) => left.email.localeCompare(right.email));

	return {
		discrepancies,
		recentAuditLogs: input.recentAuditLogs,
		summary: {
			totalDiscrepancies: discrepancies.length,
			totalTrackedUsers: trackedUserIds.size,
			totalStripeCustomers: input.stripeCustomers.length,
			totalUsersWithBillingSnapshots: subscriptionsByUserId.size,
			lastChecked: input.lastChecked ?? new Date().toISOString()
		}
	};
}

function serializeEntitlements(entitlements: ResolvedBillingEntitlements): Json {
	return {
		role: entitlements.role,
		userRole: entitlements.userRole,
		apiPlan: entitlements.apiPlan,
		ppiAccess: entitlements.ppiAccess
	};
}

export async function repairBillingEntitlementDiscrepancy(
	supabase: SupabaseClient<Database>,
	input: {
		userId: string;
		adminUserId: string;
		reason?: string;
	}
) {
	const recomputeResult = await recomputeUserBillingEntitlements(supabase, input.userId);

	const { error: auditError } = await supabase.from('role_audit_logs').insert({
		user_id: input.userId,
		old_role: recomputeResult.previousEntitlements.userRole.join(','),
		new_role: recomputeResult.resolvedEntitlements.userRole.join(','),
		trigger_type: 'admin_change',
		metadata: {
			reason: input.reason || 'Admin entitlement recompute',
			admin_user: input.adminUserId,
			changed: recomputeResult.changed,
			previous_entitlements: serializeEntitlements(recomputeResult.previousEntitlements),
			resolved_entitlements: serializeEntitlements(recomputeResult.resolvedEntitlements),
			billing_subscriptions: recomputeResult.subscriptions.map((row) => ({
				stripe_subscription_id: row.stripe_subscription_id,
				stripe_subscription_item_id: row.stripe_subscription_item_id,
				stripe_price_id: row.stripe_price_id,
				product_family: row.product_family,
				product_key: row.product_key,
				status: row.status,
				cancel_at_period_end: row.cancel_at_period_end,
				current_period_end: row.current_period_end
			}))
		} as Json,
		created_at: new Date().toISOString()
	});

	if (auditError) {
		throw new Error(`Failed to log admin entitlement repair: ${auditError.message}`);
	}

	return recomputeResult;
}
