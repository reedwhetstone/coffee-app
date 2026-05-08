import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '$lib/types/database.types';

export type BeanIdentityStatus = 'candidate' | 'accepted' | 'rejected' | 'superseded';
export type BeanIdentityEventAction =
	| 'create'
	| 'accept'
	| 'reject'
	| 'supersede'
	| 'merge'
	| 'split'
	| 'note';

export interface BeanIdentity {
	id: string;
	status: BeanIdentityStatus;
	canonical_name: string | null;
	primary_catalog_id: number | null;
	superseded_by: string | null;
	metadata: Json;
	created_at: string;
	updated_at: string;
}

export interface BeanIdentityLink {
	id: string;
	identity_id: string;
	coffee_catalog_id: number;
	status: BeanIdentityStatus;
	active: boolean;
	classifier_version: string | null;
	dimension_scores: Json;
	blockers: Json;
	proof_summary_snapshot: Json;
	reason_codes: string[];
	metadata: Json;
	proposed_by: string | null;
	reviewed_by: string | null;
	superseded_by: string | null;
	proposed_at: string;
	reviewed_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface BeanIdentityEvent {
	id: string;
	identity_id: string | null;
	link_id: string | null;
	action: BeanIdentityEventAction;
	actor_id: string | null;
	payload: Json;
	created_at: string;
}

export interface BeanIdentityCandidateSnapshot {
	classifierVersion: string;
	dimensionScores: Json;
	blockers: Json;
	proofSummarySnapshot: Json;
	reasonCodes: string[];
	metadata?: Json;
}

interface SupabaseMutationResult<T> {
	data: T | null;
	error: { message: string } | null;
}

interface SupabaseQueryLike<T = unknown> extends PromiseLike<SupabaseMutationResult<T>> {
	insert(input: unknown): SupabaseQueryLike<T>;
	update(input: unknown): SupabaseQueryLike<T>;
	select(columns: string): SupabaseQueryLike<T>;
	single(): SupabaseQueryLike<T>;
	maybeSingle(): SupabaseQueryLike<T>;
	eq(column: string, value: unknown): SupabaseQueryLike<T>;
	in(column: string, values: unknown[]): SupabaseQueryLike<T>;
	order(
		column: string,
		options?: { ascending?: boolean; nullsFirst?: boolean }
	): SupabaseQueryLike<T>;
}

interface SupabaseRpcLike<T = unknown> extends PromiseLike<SupabaseMutationResult<T>> {
	single(): SupabaseRpcLike<T>;
}

interface SupabaseClientLike {
	from(table: string): SupabaseQueryLike;
	rpc(functionName: string, args: Record<string, unknown>): SupabaseRpcLike;
}

export interface BeanIdentityCandidateMutationInput {
	coffeeCatalogId: number;
	identityId?: string | null;
	canonicalName?: string | null;
	snapshot: BeanIdentityCandidateSnapshot;
	actorId?: string | null;
}

export interface BeanIdentityCandidateMutationResult {
	identity: BeanIdentity | null;
	link: BeanIdentityLink;
	event: BeanIdentityEvent;
}

export interface BeanIdentityReviewMutationInput {
	linkId: string;
	action: Extract<BeanIdentityEventAction, 'accept' | 'reject' | 'supersede'>;
	actorId?: string | null;
	reasonCodes?: string[];
	metadata?: Json;
	note?: string | null;
	supersededByLinkId?: string | null;
}

export interface BeanIdentityReviewMutationResult {
	link: BeanIdentityLink;
	event: BeanIdentityEvent;
}

export interface BeanIdentityStore {
	createIdentity(input: Partial<BeanIdentity>): Promise<BeanIdentity>;
	updateIdentity(id: string, patch: Partial<BeanIdentity>): Promise<BeanIdentity>;
	createLink(input: Partial<BeanIdentityLink>): Promise<BeanIdentityLink>;
	updateLink(id: string, patch: Partial<BeanIdentityLink>): Promise<BeanIdentityLink>;
	getLink(id: string): Promise<BeanIdentityLink | null>;
	findLinksByCatalogId(coffeeCatalogId: number): Promise<BeanIdentityLink[]>;
	findRejectedLinks(input: {
		coffeeCatalogId: number;
		identityId?: string | null;
	}): Promise<BeanIdentityLink[]>;
	findActiveAcceptedLink(coffeeCatalogId: number): Promise<BeanIdentityLink | null>;
	createCandidate(
		input: BeanIdentityCandidateMutationInput
	): Promise<BeanIdentityCandidateMutationResult>;
	reviewLink(input: BeanIdentityReviewMutationInput): Promise<BeanIdentityReviewMutationResult>;
	createEvent(input: Partial<BeanIdentityEvent>): Promise<BeanIdentityEvent>;
	listEvents(input: {
		identityId?: string | null;
		linkIds?: string[];
	}): Promise<BeanIdentityEvent[]>;
}

export class BeanIdentityError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BeanIdentityError';
	}
}

export class BeanIdentityLinkNotFoundError extends BeanIdentityError {
	constructor(linkId: string) {
		super(`Bean identity link ${linkId} was not found`);
		this.name = 'BeanIdentityLinkNotFoundError';
	}
}

export class DuplicateActiveAcceptedIdentityError extends BeanIdentityError {
	constructor(
		public coffeeCatalogId: number,
		public existingLinkId: string
	) {
		super(
			`Coffee catalog row ${coffeeCatalogId} already has active accepted identity link ${existingLinkId}`
		);
		this.name = 'DuplicateActiveAcceptedIdentityError';
	}
}

export class RejectedBeanIdentityCandidateError extends BeanIdentityError {
	constructor(
		public coffeeCatalogId: number,
		public rejectedLinkId: string
	) {
		super(
			`Coffee catalog row ${coffeeCatalogId} has a rejected identity candidate ${rejectedLinkId}`
		);
		this.name = 'RejectedBeanIdentityCandidateError';
	}
}

interface ActorInput {
	actorId?: string | null;
}

export interface CreateBeanIdentityCandidateInput extends ActorInput {
	store: BeanIdentityStore;
	coffeeCatalogId: number;
	identityId?: string | null;
	canonicalName?: string | null;
	snapshot: BeanIdentityCandidateSnapshot;
	allowAfterRejection?: boolean;
}

export interface ReviewBeanIdentityLinkInput extends ActorInput {
	store: BeanIdentityStore;
	linkId: string;
	reasonCodes?: string[];
	metadata?: Json;
	note?: string | null;
}

export interface SupersedeBeanIdentityLinkInput extends ReviewBeanIdentityLinkInput {
	supersededByLinkId?: string | null;
}

export interface BeanIdentityState {
	coffeeCatalogId: number;
	accepted: BeanIdentityLink | null;
	candidates: BeanIdentityLink[];
	rejected: BeanIdentityLink[];
	superseded: BeanIdentityLink[];
	links: BeanIdentityLink[];
	events: BeanIdentityEvent[];
}

export function createSupabaseBeanIdentityStore(
	supabase: SupabaseClient<Database>
): BeanIdentityStore {
	const client = supabase as unknown as SupabaseClientLike;

	async function single<T>(query: PromiseLike<SupabaseMutationResult<unknown>>) {
		const { data, error } = await query;
		if (error) throw new BeanIdentityError(error.message);
		if (!data) throw new BeanIdentityError('Expected Supabase mutation to return a row');
		return data as T;
	}

	async function maybeSingle<T>(query: PromiseLike<SupabaseMutationResult<unknown>>) {
		const { data, error } = await query;
		if (error) throw new BeanIdentityError(error.message);
		return data as T | null;
	}

	async function many<T>(query: PromiseLike<SupabaseMutationResult<unknown>>) {
		const { data, error } = await query;
		if (error) throw new BeanIdentityError(error.message);
		return (data ?? []) as T[];
	}

	return {
		createIdentity(input) {
			return single<BeanIdentity>(
				client.from('bean_identities').insert(toSnakeIdentity(input)).select('*').single()
			);
		},
		updateIdentity(id, patch) {
			return single<BeanIdentity>(
				client
					.from('bean_identities')
					.update(toSnakeIdentity(patch))
					.eq('id', id)
					.select('*')
					.single()
			);
		},
		createLink(input) {
			return single<BeanIdentityLink>(
				client.from('bean_identity_links').insert(toSnakeLink(input)).select('*').single()
			);
		},
		updateLink(id, patch) {
			return single<BeanIdentityLink>(
				client
					.from('bean_identity_links')
					.update(toSnakeLink(patch))
					.eq('id', id)
					.select('*')
					.single()
			);
		},
		getLink(id) {
			return maybeSingle<BeanIdentityLink>(
				client.from('bean_identity_links').select('*').eq('id', id).maybeSingle()
			);
		},
		findLinksByCatalogId(coffeeCatalogId) {
			return many<BeanIdentityLink>(
				client
					.from('bean_identity_links')
					.select('*')
					.eq('coffee_catalog_id', coffeeCatalogId)
					.order('created_at', { ascending: false })
			);
		},
		findRejectedLinks({ coffeeCatalogId, identityId }) {
			let query = client
				.from('bean_identity_links')
				.select('*')
				.eq('coffee_catalog_id', coffeeCatalogId)
				.eq('status', 'rejected')
				.order('reviewed_at', { ascending: false, nullsFirst: false });
			if (identityId) query = query.eq('identity_id', identityId);
			return many<BeanIdentityLink>(query);
		},
		findActiveAcceptedLink(coffeeCatalogId) {
			return maybeSingle<BeanIdentityLink>(
				client
					.from('bean_identity_links')
					.select('*')
					.eq('coffee_catalog_id', coffeeCatalogId)
					.eq('status', 'accepted')
					.eq('active', true)
					.maybeSingle()
			);
		},
		async createCandidate(input) {
			return single<{
				identity: BeanIdentity | null;
				link: BeanIdentityLink;
				event: BeanIdentityEvent;
			}>(
				client
					.rpc('create_bean_identity_candidate', {
						p_coffee_catalog_id: input.coffeeCatalogId,
						p_identity_id: input.identityId ?? null,
						p_canonical_name: input.canonicalName ?? null,
						p_snapshot: input.snapshot,
						p_actor_id: input.actorId ?? null
					})
					.single()
			);
		},
		async reviewLink(input) {
			const result = await single<{ link: BeanIdentityLink; event: BeanIdentityEvent }>(
				client
					.rpc('review_bean_identity_link', {
						p_link_id: input.linkId,
						p_action: input.action,
						p_actor_id: input.actorId ?? null,
						p_reason_codes: input.reasonCodes ?? [],
						p_metadata: input.metadata ?? {},
						p_note: input.note ?? null,
						p_superseded_by_link_id: input.supersededByLinkId ?? null
					})
					.single()
			);
			return result;
		},
		createEvent(input) {
			return single<BeanIdentityEvent>(
				client.from('bean_identity_events').insert(toSnakeEvent(input)).select('*').single()
			);
		},
		async listEvents({ identityId, linkIds }) {
			if (linkIds && linkIds.length === 0) return [];

			let query = client.from('bean_identity_events').select('*');
			if (identityId) query = query.eq('identity_id', identityId);
			if (linkIds) query = query.in('link_id', linkIds);
			return many<BeanIdentityEvent>(query.order('created_at', { ascending: true }));
		}
	};
}

export async function createBeanIdentityCandidate({
	store,
	coffeeCatalogId,
	identityId,
	canonicalName = null,
	snapshot,
	actorId = null,
	allowAfterRejection = false
}: CreateBeanIdentityCandidateInput) {
	if (!allowAfterRejection) {
		const rejectedLinks = await store.findRejectedLinks({ coffeeCatalogId, identityId });
		if (rejectedLinks[0]) {
			throw new RejectedBeanIdentityCandidateError(coffeeCatalogId, rejectedLinks[0].id);
		}
	}

	return store.createCandidate({
		coffeeCatalogId,
		identityId,
		canonicalName,
		snapshot,
		actorId
	});
}

export async function acceptBeanIdentityLink({
	store,
	linkId,
	actorId = null,
	reasonCodes = [],
	metadata = {},
	note = null
}: ReviewBeanIdentityLinkInput) {
	const link = await requireLink(store, linkId);
	const conflict = await store.findActiveAcceptedLink(link.coffee_catalog_id);
	if (conflict && conflict.id !== link.id) {
		throw new DuplicateActiveAcceptedIdentityError(link.coffee_catalog_id, conflict.id);
	}

	return store.reviewLink({
		linkId: link.id,
		action: 'accept',
		actorId,
		reasonCodes,
		metadata,
		note
	});
}

export async function rejectBeanIdentityLink({
	store,
	linkId,
	actorId = null,
	reasonCodes = [],
	metadata = {},
	note = null
}: ReviewBeanIdentityLinkInput) {
	const link = await requireLink(store, linkId);
	return store.reviewLink({
		linkId: link.id,
		action: 'reject',
		actorId,
		reasonCodes,
		metadata,
		note
	});
}

export async function supersedeBeanIdentityLink({
	store,
	linkId,
	actorId = null,
	reasonCodes = [],
	metadata = {},
	note = null,
	supersededByLinkId = null
}: SupersedeBeanIdentityLinkInput) {
	const link = await requireLink(store, linkId);
	if (supersededByLinkId) await requireLink(store, supersededByLinkId);

	return store.reviewLink({
		linkId: link.id,
		action: 'supersede',
		actorId,
		reasonCodes,
		metadata,
		note,
		supersededByLinkId
	});
}

export async function writeBeanIdentityEvent({
	store,
	identityId = null,
	linkId = null,
	action,
	actorId = null,
	payload = {}
}: {
	store: BeanIdentityStore;
	identityId?: string | null;
	linkId?: string | null;
	action: BeanIdentityEventAction;
	actorId?: string | null;
	payload?: Json;
}) {
	return store.createEvent({
		identity_id: identityId,
		link_id: linkId,
		action,
		actor_id: actorId,
		payload
	});
}

export async function readBeanIdentityState(input: {
	store: BeanIdentityStore;
	coffeeCatalogId: number;
	includeEvents?: boolean;
}): Promise<BeanIdentityState> {
	const links = await input.store.findLinksByCatalogId(input.coffeeCatalogId);
	const linkIds = links.map((link) => link.id);
	const events =
		input.includeEvents && linkIds.length > 0 ? await input.store.listEvents({ linkIds }) : [];

	return {
		coffeeCatalogId: input.coffeeCatalogId,
		accepted: links.find((link) => link.status === 'accepted' && link.active) ?? null,
		candidates: links.filter((link) => link.status === 'candidate' && link.active),
		rejected: links.filter((link) => link.status === 'rejected'),
		superseded: links.filter((link) => link.status === 'superseded'),
		links,
		events
	};
}

async function requireLink(store: BeanIdentityStore, linkId: string) {
	const link = await store.getLink(linkId);
	if (!link) throw new BeanIdentityLinkNotFoundError(linkId);
	return link;
}

function toSnakeIdentity(input: Partial<BeanIdentity>) {
	return input;
}

function toSnakeLink(input: Partial<BeanIdentityLink>) {
	return input;
}

function toSnakeEvent(input: Partial<BeanIdentityEvent>) {
	return input;
}
