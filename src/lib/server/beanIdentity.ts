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

interface SupabaseClientLike {
	from(table: string): SupabaseQueryLike;
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
		createEvent(input) {
			return single<BeanIdentityEvent>(
				client.from('bean_identity_events').insert(toSnakeEvent(input)).select('*').single()
			);
		},
		async listEvents({ identityId, linkIds }) {
			let query = client.from('bean_identity_events').select('*');
			if (identityId) query = query.eq('identity_id', identityId);
			if (linkIds && linkIds.length > 0) query = query.in('link_id', linkIds);
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

	const identity = identityId
		? null
		: await store.createIdentity({
				status: 'candidate',
				canonical_name: canonicalName,
				primary_catalog_id: coffeeCatalogId,
				metadata: snapshot.metadata ?? {}
			});

	const resolvedIdentityId = identityId ?? identity?.id;
	if (!resolvedIdentityId) throw new BeanIdentityError('Identity id is required to create a link');

	const link = await store.createLink({
		identity_id: resolvedIdentityId,
		coffee_catalog_id: coffeeCatalogId,
		status: 'candidate',
		active: true,
		classifier_version: snapshot.classifierVersion,
		dimension_scores: snapshot.dimensionScores,
		blockers: snapshot.blockers,
		proof_summary_snapshot: snapshot.proofSummarySnapshot,
		reason_codes: snapshot.reasonCodes,
		metadata: snapshot.metadata ?? {},
		proposed_by: actorId
	});

	const event = await writeBeanIdentityEvent({
		store,
		identityId: link.identity_id,
		linkId: link.id,
		action: 'create',
		actorId,
		payload: toJson({
			coffee_catalog_id: coffeeCatalogId,
			candidate_snapshot: snapshot
		})
	});

	return { identity, link, event };
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

	const previousStatus = link.status;
	const accepted = await store.updateLink(link.id, {
		status: 'accepted',
		active: true,
		reviewed_by: actorId,
		reviewed_at: new Date().toISOString(),
		reason_codes: mergeReasonCodes(link.reason_codes, reasonCodes),
		metadata: mergeJsonObjects(link.metadata, metadata)
	});
	await store.updateIdentity(link.identity_id, {
		status: 'accepted',
		primary_catalog_id: link.coffee_catalog_id
	});

	const event = await writeBeanIdentityEvent({
		store,
		identityId: accepted.identity_id,
		linkId: accepted.id,
		action: 'accept',
		actorId,
		payload: toJson({
			previous_status: previousStatus,
			reason_codes: reasonCodes,
			metadata,
			note
		})
	});

	return { link: accepted, event };
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
	const previousStatus = link.status;
	const rejected = await store.updateLink(link.id, {
		status: 'rejected',
		active: false,
		reviewed_by: actorId,
		reviewed_at: new Date().toISOString(),
		reason_codes: mergeReasonCodes(link.reason_codes, reasonCodes),
		metadata: mergeJsonObjects(link.metadata, metadata)
	});
	await store.updateIdentity(link.identity_id, { status: 'rejected' });

	const event = await writeBeanIdentityEvent({
		store,
		identityId: rejected.identity_id,
		linkId: rejected.id,
		action: 'reject',
		actorId,
		payload: toJson({
			previous_status: previousStatus,
			reason_codes: reasonCodes,
			metadata,
			note
		})
	});

	return { link: rejected, event };
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
	const replacement = supersededByLinkId ? await requireLink(store, supersededByLinkId) : null;
	const previousStatus = link.status;
	const superseded = await store.updateLink(link.id, {
		status: 'superseded',
		active: false,
		reviewed_by: actorId,
		reviewed_at: new Date().toISOString(),
		superseded_by: supersededByLinkId,
		reason_codes: mergeReasonCodes(link.reason_codes, reasonCodes),
		metadata: mergeJsonObjects(link.metadata, metadata)
	});
	await store.updateIdentity(link.identity_id, {
		status: 'superseded',
		superseded_by: replacement?.identity_id ?? null
	});

	const event = await writeBeanIdentityEvent({
		store,
		identityId: superseded.identity_id,
		linkId: superseded.id,
		action: 'supersede',
		actorId,
		payload: toJson({
			previous_status: previousStatus,
			superseded_by_link_id: supersededByLinkId,
			reason_codes: reasonCodes,
			metadata,
			note
		})
	});

	return { link: superseded, event };
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
	const events = input.includeEvents
		? await input.store.listEvents({ linkIds: links.map((link) => link.id) })
		: [];

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

function mergeReasonCodes(existing: string[], incoming: string[]) {
	return Array.from(new Set([...existing, ...incoming]));
}

function mergeJsonObjects(existing: Json, incoming: Json): Json {
	if (isPlainObject(existing) && isPlainObject(incoming)) {
		return { ...existing, ...incoming };
	}
	return incoming ?? existing;
}

function isPlainObject(value: Json): value is { [key: string]: Json | undefined } {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toJson(value: unknown): Json {
	return value as Json;
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
