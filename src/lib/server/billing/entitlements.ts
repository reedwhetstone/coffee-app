import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';

import type { UserRole } from '$lib/types/auth.types';
import type { Database, Json } from '$lib/types/database.types';

import { getBillingCatalogEntry, getBillingCatalogEntryByStripePriceId } from './catalog';

type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];
type ApiPlan = UserRoleRow['api_plan'];
type BillingSubscriptionRow = Database['public']['Tables']['billing_subscriptions']['Row'];
type BillingSubscriptionInsert = Database['public']['Tables']['billing_subscriptions']['Insert'];

const ACTIVE_BILLING_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);
const API_PLAN_PRIORITY: Record<ApiPlan, number> = {
	viewer: 0,
	member: 1,
	enterprise: 2
};

export interface ResolvedBillingEntitlements {
	role: UserRole;
	userRole: string[];
	apiPlan: ApiPlan;
	ppiAccess: boolean;
}

export interface BillingSnapshotSyncResult {
	rows: BillingSubscriptionInsert[];
	deletedItemIds: string[];
	unknownPriceIds: string[];
}

export interface BillingRecomputeResult {
	previousEntitlements: ResolvedBillingEntitlements;
	resolvedEntitlements: ResolvedBillingEntitlements;
	changed: boolean;
	subscriptions: BillingSubscriptionRow[];
}

export interface StripeSubscriptionReconciliationResult
	extends BillingSnapshotSyncResult,
		BillingRecomputeResult {}

export class BillingCatalogDriftError extends Error {
	readonly unknownPriceIds: string[];

	constructor(unknownPriceIds: string[]) {
		super(
			`Billing reconciliation aborted because Stripe returned unknown price IDs: ${unknownPriceIds.join(', ')}`
		);
		this.name = 'BillingCatalogDriftError';
		this.unknownPriceIds = unknownPriceIds;
	}
}

function normalizeStoredRole(role: UserRoleRow['role'] | null | undefined): UserRole {
	if (role === 'admin' || role === 'member' || role === 'viewer') {
		return role;
	}

	return 'viewer';
}

function resolveStoredApiPlan(
	role: UserRoleRow['role'] | null | undefined,
	plan: UserRoleRow['api_plan'] | null | undefined
): ApiPlan {
	if (plan === 'viewer' || plan === 'member' || plan === 'enterprise') {
		return plan;
	}

	return normalizeStoredRole(role) === 'admin' ? 'enterprise' : 'viewer';
}

function buildUserRoleMirror(role: UserRole): string[] {
	return [role];
}

function arraysEqual(left: string[], right: string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	return left.every((value, index) => value === right[index]);
}

function toIsoTimestamp(seconds: number | null | undefined): string | null {
	if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
		return null;
	}

	return new Date(seconds * 1000).toISOString();
}

function highestApiPlan(current: ApiPlan, next: ApiPlan): ApiPlan {
	return API_PLAN_PRIORITY[next] > API_PLAN_PRIORITY[current] ? next : current;
}

export function isBillingSubscriptionActive(status: string): boolean {
	return ACTIVE_BILLING_SUBSCRIPTION_STATUSES.has(status);
}

export function resolveBillingEntitlements(input: {
	currentRole: UserRoleRow['role'] | null | undefined;
	currentApiPlan?: UserRoleRow['api_plan'] | null | undefined;
	currentPpiAccess?: boolean | null | undefined;
	subscriptions: Array<Pick<BillingSubscriptionRow, 'product_key' | 'status'>>;
}): ResolvedBillingEntitlements {
	const currentRole = normalizeStoredRole(input.currentRole);
	const preserveAdmin = currentRole === 'admin';

	const resolved: ResolvedBillingEntitlements = {
		role: preserveAdmin ? 'admin' : 'viewer',
		userRole: buildUserRoleMirror(preserveAdmin ? 'admin' : 'viewer'),
		apiPlan: resolveStoredApiPlan(input.currentRole, input.currentApiPlan),
		ppiAccess: input.currentPpiAccess === true
	};

	for (const subscription of input.subscriptions) {
		if (!isBillingSubscriptionActive(subscription.status)) {
			continue;
		}

		const catalogEntry = getBillingCatalogEntry(subscription.product_key);
		if (!catalogEntry) {
			continue;
		}

		if (!preserveAdmin && catalogEntry.grants.role === 'member') {
			resolved.role = 'member';
		}

		if (catalogEntry.grants.apiPlan) {
			resolved.apiPlan = highestApiPlan(resolved.apiPlan, catalogEntry.grants.apiPlan);
		}

		if (catalogEntry.grants.ppiAccess) {
			resolved.ppiAccess = true;
		}
	}

	resolved.userRole = buildUserRoleMirror(resolved.role);
	return resolved;
}

export function mapStripeSubscriptionToBillingSnapshotRows(input: {
	userId: string;
	stripeCustomerId: string;
	subscription: Stripe.Subscription;
}): BillingSnapshotSyncResult {
	const rows: BillingSubscriptionInsert[] = [];
	const unknownPriceIds: string[] = [];

	for (const item of input.subscription.items.data) {
		const stripePriceId = item.price.id;
		const catalogEntry = getBillingCatalogEntryByStripePriceId(stripePriceId);

		if (!catalogEntry) {
			unknownPriceIds.push(stripePriceId);
			continue;
		}

		const metadata: Json = {
			purchaseKey: catalogEntry.purchaseKey,
			planName: catalogEntry.planName,
			interval: catalogEntry.interval,
			quantity: item.quantity ?? 1,
			stripeProductId: typeof item.price.product === 'string' ? item.price.product : null
		};

		rows.push({
			user_id: input.userId,
			stripe_customer_id: input.stripeCustomerId,
			stripe_subscription_id: input.subscription.id,
			stripe_subscription_item_id: item.id,
			stripe_price_id: stripePriceId,
			product_family: catalogEntry.productFamily,
			product_key: catalogEntry.purchaseKey,
			status: input.subscription.status,
			current_period_end: toIsoTimestamp(input.subscription.current_period_end),
			cancel_at_period_end: input.subscription.cancel_at_period_end,
			metadata,
			updated_at: new Date().toISOString()
		});
	}

	return {
		rows,
		deletedItemIds: [],
		unknownPriceIds
	};
}

export async function syncBillingSubscriptionSnapshotFromStripeSubscription(
	supabase: SupabaseClient<Database>,
	input: {
		userId: string;
		stripeCustomerId: string;
		subscription: Stripe.Subscription;
	}
): Promise<BillingSnapshotSyncResult> {
	const mapped = mapStripeSubscriptionToBillingSnapshotRows(input);

	if (mapped.unknownPriceIds.length > 0) {
		throw new BillingCatalogDriftError(mapped.unknownPriceIds);
	}

	const { data: existingRows, error: existingRowsError } = await supabase
		.from('billing_subscriptions')
		.select('stripe_subscription_item_id')
		.eq('stripe_subscription_id', input.subscription.id);

	if (existingRowsError) {
		throw new Error(
			`Failed to load billing subscription snapshot rows: ${existingRowsError.message}`
		);
	}

	if (mapped.rows.length > 0) {
		const { error: upsertError } = await supabase
			.from('billing_subscriptions')
			.upsert(mapped.rows, {
				onConflict: 'stripe_subscription_item_id'
			});

		if (upsertError) {
			throw new Error(
				`Failed to upsert billing subscription snapshot rows: ${upsertError.message}`
			);
		}
	}

	const currentItemIds = new Set(mapped.rows.map((row) => row.stripe_subscription_item_id));
	const deletedItemIds =
		existingRows
			?.map((row) => row.stripe_subscription_item_id)
			.filter((itemId) => !currentItemIds.has(itemId)) ?? [];

	if (deletedItemIds.length > 0) {
		const { error: deleteError } = await supabase
			.from('billing_subscriptions')
			.delete()
			.eq('stripe_subscription_id', input.subscription.id)
			.in('stripe_subscription_item_id', deletedItemIds);

		if (deleteError) {
			throw new Error(`Failed to remove stale billing subscription rows: ${deleteError.message}`);
		}
	}

	return {
		...mapped,
		deletedItemIds
	};
}

export async function recomputeUserBillingEntitlements(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<BillingRecomputeResult> {
	const { data: currentUserRoleRow, error: currentUserRoleError } = await supabase
		.from('user_roles')
		.select('role, user_role, api_plan, ppi_access')
		.eq('id', userId)
		.maybeSingle();

	if (currentUserRoleError) {
		throw new Error(`Failed to load current user entitlements: ${currentUserRoleError.message}`);
	}

	const { data: subscriptions, error: subscriptionsError } = await supabase
		.from('billing_subscriptions')
		.select('*')
		.eq('user_id', userId);

	if (subscriptionsError) {
		throw new Error(`Failed to load billing subscriptions: ${subscriptionsError.message}`);
	}

	const previousRole = normalizeStoredRole(currentUserRoleRow?.role);
	const previousEntitlements: ResolvedBillingEntitlements = {
		role: previousRole,
		userRole:
			Array.isArray(currentUserRoleRow?.user_role) && currentUserRoleRow.user_role.length > 0
				? currentUserRoleRow.user_role
				: buildUserRoleMirror(previousRole),
		apiPlan: resolveStoredApiPlan(currentUserRoleRow?.role, currentUserRoleRow?.api_plan),
		ppiAccess: currentUserRoleRow?.ppi_access === true
	};

	const resolvedEntitlements = resolveBillingEntitlements({
		currentRole: currentUserRoleRow?.role,
		currentApiPlan: currentUserRoleRow?.api_plan,
		currentPpiAccess: currentUserRoleRow?.ppi_access,
		subscriptions: subscriptions ?? []
	});

	const storedUserRole =
		Array.isArray(currentUserRoleRow?.user_role) && currentUserRoleRow.user_role.length > 0
			? currentUserRoleRow.user_role
			: [];

	const changed =
		!currentUserRoleRow ||
		currentUserRoleRow.role !== resolvedEntitlements.role ||
		currentUserRoleRow.api_plan !== resolvedEntitlements.apiPlan ||
		currentUserRoleRow.ppi_access !== resolvedEntitlements.ppiAccess ||
		!arraysEqual(storedUserRole, resolvedEntitlements.userRole);

	if (!currentUserRoleRow || changed) {
		const { error: upsertError } = await supabase.from('user_roles').upsert(
			{
				id: userId,
				role: resolvedEntitlements.role,
				user_role: resolvedEntitlements.userRole,
				api_plan: resolvedEntitlements.apiPlan,
				ppi_access: resolvedEntitlements.ppiAccess,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'id' }
		);

		if (upsertError) {
			throw new Error(`Failed to persist reconciled entitlements: ${upsertError.message}`);
		}
	}

	return {
		previousEntitlements,
		resolvedEntitlements,
		changed,
		subscriptions: subscriptions ?? []
	};
}

export async function reconcileStripeSubscriptionEntitlements(
	supabase: SupabaseClient<Database>,
	input: {
		userId: string;
		stripeCustomerId: string;
		subscription: Stripe.Subscription;
	}
): Promise<StripeSubscriptionReconciliationResult> {
	const snapshotResult = await syncBillingSubscriptionSnapshotFromStripeSubscription(
		supabase,
		input
	);
	const recomputeResult = await recomputeUserBillingEntitlements(supabase, input.userId);

	return {
		...snapshotResult,
		...recomputeResult
	};
}
