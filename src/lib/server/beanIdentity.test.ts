import { describe, expect, it } from 'vitest';
import type {
	BeanIdentity,
	BeanIdentityEvent,
	BeanIdentityEventAction,
	BeanIdentityLink,
	BeanIdentityStore
} from './beanIdentity';
import {
	acceptBeanIdentityLink,
	createBeanIdentityCandidate,
	createSupabaseBeanIdentityStore,
	DuplicateActiveAcceptedIdentityError,
	readBeanIdentityState,
	RejectedBeanIdentityCandidateError,
	rejectBeanIdentityLink,
	supersedeBeanIdentityLink,
	writeBeanIdentityEvent
} from './beanIdentity';

const snapshot = {
	classifierVersion: 'canonical-match-v1',
	dimensionScores: { origin: 0.94, processing: 0.91, tasting: 0.88 },
	blockers: [{ code: 'insufficient_structured_process', severity: 'soft' }],
	proofSummarySnapshot: { confidence: 'medium_beta', evidence: ['same supplier lot name'] },
	reasonCodes: ['high_embedding_score', 'same_country'],
	metadata: { proposed_by: 'test' }
} satisfies Parameters<typeof createBeanIdentityCandidate>[0]['snapshot'];

describe('bean identity helpers', () => {
	it('creates candidate links with classifier snapshots and append-only create events', async () => {
		const store = createMemoryBeanIdentityStore();

		const result = await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 42,
			canonicalName: 'Ethiopia Guji Natural',
			snapshot,
			actorId: '00000000-0000-0000-0000-000000000001'
		});

		expect(result.identity).toMatchObject({ status: 'candidate', primary_catalog_id: 42 });
		expect(result.link).toMatchObject({
			coffee_catalog_id: 42,
			status: 'candidate',
			active: true,
			classifier_version: 'canonical-match-v1',
			dimension_scores: snapshot.dimensionScores,
			blockers: snapshot.blockers,
			proof_summary_snapshot: snapshot.proofSummarySnapshot,
			reason_codes: snapshot.reasonCodes
		});
		expect(result.event).toMatchObject({
			action: 'create',
			link_id: result.link.id,
			payload: expect.objectContaining({
				coffee_catalog_id: 42,
				candidate_snapshot: expect.objectContaining({ classifierVersion: 'canonical-match-v1' })
			})
		});
	});

	it('prevents duplicate active accepted identity links for one catalog row', async () => {
		const store = createMemoryBeanIdentityStore();
		const first = await createBeanIdentityCandidate({ store, coffeeCatalogId: 7, snapshot });
		const second = await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 7,
			snapshot: { ...snapshot, reasonCodes: ['same_region'] }
		});

		await acceptBeanIdentityLink({ store, linkId: first.link.id, reasonCodes: ['human_reviewed'] });

		await expect(acceptBeanIdentityLink({ store, linkId: second.link.id })).rejects.toBeInstanceOf(
			DuplicateActiveAcceptedIdentityError
		);
	});

	it('keeps accepted links reversible by superseding before accepting a replacement', async () => {
		const store = createMemoryBeanIdentityStore();
		const first = await createBeanIdentityCandidate({ store, coffeeCatalogId: 11, snapshot });
		const second = await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 11,
			snapshot: { ...snapshot, reasonCodes: ['newer_classifier_version'] }
		});

		await acceptBeanIdentityLink({ store, linkId: first.link.id });
		const superseded = await supersedeBeanIdentityLink({
			store,
			linkId: first.link.id,
			supersededByLinkId: second.link.id,
			reasonCodes: ['better_proof']
		});
		const accepted = await acceptBeanIdentityLink({ store, linkId: second.link.id });
		const state = await readBeanIdentityState({ store, coffeeCatalogId: 11, includeEvents: true });

		expect(superseded.link).toMatchObject({ status: 'superseded', active: false });
		expect(accepted.link).toMatchObject({ status: 'accepted', active: true });
		expect(state.accepted?.id).toBe(second.link.id);
		expect(state.superseded.map((link) => link.id)).toContain(first.link.id);
		expect(state.events.map((event) => event.action)).toEqual([
			'create',
			'create',
			'accept',
			'supersede',
			'accept'
		]);
	});

	it('retains rejected candidate history without destructive deletion', async () => {
		const store = createMemoryBeanIdentityStore();
		const candidate = await createBeanIdentityCandidate({ store, coffeeCatalogId: 12, snapshot });

		await rejectBeanIdentityLink({
			store,
			linkId: candidate.link.id,
			reasonCodes: ['processing_base_method_conflict'],
			metadata: { target: 'washed', candidate: 'natural' },
			note: 'Natural vs washed is not a same-coffee claim.'
		});

		const state = await readBeanIdentityState({ store, coffeeCatalogId: 12, includeEvents: true });
		expect(state.candidates).toHaveLength(0);
		expect(state.rejected).toHaveLength(1);
		expect(state.rejected[0]).toMatchObject({
			status: 'rejected',
			active: false,
			reason_codes: expect.arrayContaining(['processing_base_method_conflict'])
		});
		expect(state.events.map((event) => event.action)).toEqual(['create', 'reject']);
		expect(state.events[1].payload).toMatchObject({
			previous_status: 'candidate',
			note: 'Natural vs washed is not a same-coffee claim.'
		});
	});

	it('does not mutate review state when writing the review event fails', async () => {
		const store = createMemoryBeanIdentityStore();
		const candidate = await createBeanIdentityCandidate({ store, coffeeCatalogId: 13, snapshot });
		const originalCreateEvent = store.createEvent.bind(store);
		store.createEvent = async (input) => {
			if (input.action === 'accept') throw new Error('audit insert failed');
			return originalCreateEvent(input);
		};

		await expect(acceptBeanIdentityLink({ store, linkId: candidate.link.id })).rejects.toThrow(
			'audit insert failed'
		);

		expect(store.links.find((link) => link.id === candidate.link.id)).toMatchObject({
			status: 'candidate',
			active: true,
			reviewed_at: null
		});
		expect(
			store.identities.find((identity) => identity.id === candidate.link.identity_id)
		).toMatchObject({
			status: 'candidate',
			primary_catalog_id: 13
		});
		expect(store.events.map((event) => event.action)).toEqual(['create']);
	});

	it('does not leave candidate state when writing the create event fails', async () => {
		const store = createMemoryBeanIdentityStore();
		store.createEvent = async () => {
			throw new Error('create audit insert failed');
		};

		await expect(
			createBeanIdentityCandidate({ store, coffeeCatalogId: 16, snapshot })
		).rejects.toThrow('create audit insert failed');

		expect(store.identities).toEqual([]);
		expect(store.links).toEqual([]);
		expect(store.events).toEqual([]);
	});

	it('does not reject an identity that still has another active accepted link', async () => {
		const store = createMemoryBeanIdentityStore();
		const first = await createBeanIdentityCandidate({ store, coffeeCatalogId: 14, snapshot });
		const second = await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 15,
			identityId: first.link.identity_id,
			snapshot: { ...snapshot, reasonCodes: ['same_identity_other_catalog_row'] }
		});
		await acceptBeanIdentityLink({ store, linkId: second.link.id });

		await rejectBeanIdentityLink({ store, linkId: first.link.id, reasonCodes: ['bad_candidate'] });

		expect(store.links.find((link) => link.id === first.link.id)).toMatchObject({
			status: 'rejected',
			active: false
		});
		expect(store.links.find((link) => link.id === second.link.id)).toMatchObject({
			status: 'accepted',
			active: true
		});
		expect(
			store.identities.find((identity) => identity.id === first.link.identity_id)
		).toMatchObject({
			status: 'accepted',
			primary_catalog_id: 15
		});
	});

	it('recomputes identity primary catalog when superseding the current accepted link', async () => {
		const store = createMemoryBeanIdentityStore();
		const first = await createBeanIdentityCandidate({ store, coffeeCatalogId: 17, snapshot });
		const second = await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 18,
			identityId: first.link.identity_id,
			snapshot: { ...snapshot, reasonCodes: ['same_identity_other_catalog_row'] }
		});

		await acceptBeanIdentityLink({ store, linkId: first.link.id });
		await acceptBeanIdentityLink({ store, linkId: second.link.id });
		await supersedeBeanIdentityLink({ store, linkId: first.link.id });

		expect(store.links.find((link) => link.id === first.link.id)).toMatchObject({
			status: 'superseded',
			active: false
		});
		expect(
			store.identities.find((identity) => identity.id === first.link.identity_id)
		).toMatchObject({
			status: 'accepted',
			primary_catalog_id: 18,
			superseded_by: null
		});
	});

	it('respects rejected records before creating another candidate for the same identity memory', async () => {
		const store = createMemoryBeanIdentityStore();
		const candidate = await createBeanIdentityCandidate({ store, coffeeCatalogId: 24, snapshot });
		await rejectBeanIdentityLink({
			store,
			linkId: candidate.link.id,
			reasonCodes: ['country_conflict']
		});

		await expect(
			createBeanIdentityCandidate({
				store,
				coffeeCatalogId: 24,
				identityId: candidate.link.identity_id,
				snapshot
			})
		).rejects.toBeInstanceOf(RejectedBeanIdentityCandidateError);
	});

	it('returns a rejected identity to candidate state when reusing it for a new candidate link', async () => {
		const store = createMemoryBeanIdentityStore();
		const first = await createBeanIdentityCandidate({ store, coffeeCatalogId: 25, snapshot });
		await rejectBeanIdentityLink({
			store,
			linkId: first.link.id,
			reasonCodes: ['country_conflict']
		});

		await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 26,
			identityId: first.link.identity_id,
			snapshot,
			allowAfterRejection: true
		});

		expect(
			store.identities.find((identity) => identity.id === first.link.identity_id)
		).toMatchObject({
			status: 'candidate',
			primary_catalog_id: 26
		});
	});

	it('passes allowAfterRejection through to the Supabase candidate RPC', async () => {
		let rpcCall: { functionName: string; args: Record<string, unknown> } | null = null;
		const store = createSupabaseBeanIdentityStore({
			rpc(functionName: string, args: Record<string, unknown>) {
				rpcCall = { functionName, args };
				return {
					single() {
						return Promise.resolve({
							data: {
								identity: null,
								link: {
									id: 'link-1',
									identity_id: 'identity-1',
									coffee_catalog_id: 24,
									status: 'candidate',
									active: true,
									classifier_version: 'canonical-match-v1',
									dimension_scores: {},
									blockers: [],
									proof_summary_snapshot: {},
									reason_codes: [],
									metadata: {},
									proposed_by: null,
									reviewed_by: null,
									superseded_by: null,
									proposed_at: '2026-05-08T00:00:00.000Z',
									reviewed_at: null,
									created_at: '2026-05-08T00:00:00.000Z',
									updated_at: '2026-05-08T00:00:00.000Z'
								},
								event: {
									id: 'event-1',
									identity_id: 'identity-1',
									link_id: 'link-1',
									action: 'create',
									actor_id: null,
									payload: {},
									created_at: '2026-05-08T00:00:00.000Z'
								}
							},
							error: null
						});
					}
				};
			}
		} as never);

		await createBeanIdentityCandidate({
			store,
			coffeeCatalogId: 24,
			identityId: '00000000-0000-0000-0000-000000000024',
			snapshot,
			allowAfterRejection: true
		});

		expect(rpcCall).toMatchObject({
			functionName: 'create_bean_identity_candidate',
			args: expect.objectContaining({ p_allow_after_rejection: true })
		});
	});

	it('supports explicit merge, split, and note audit events without mutating prior events', async () => {
		const store = createMemoryBeanIdentityStore();
		const candidate = await createBeanIdentityCandidate({ store, coffeeCatalogId: 30, snapshot });

		for (const action of ['merge', 'split', 'note'] satisfies BeanIdentityEventAction[]) {
			await writeBeanIdentityEvent({
				store,
				identityId: candidate.link.identity_id,
				linkId: candidate.link.id,
				action,
				payload: { action }
			});
		}

		const state = await readBeanIdentityState({ store, coffeeCatalogId: 30, includeEvents: true });
		expect(state.events.map((event) => event.action)).toEqual(['create', 'merge', 'split', 'note']);
		expect(store.events).toHaveLength(4);
	});

	it('does not load unrelated events for a catalog row with no identity links', async () => {
		const store = createMemoryBeanIdentityStore();
		const candidate = await createBeanIdentityCandidate({ store, coffeeCatalogId: 30, snapshot });
		await writeBeanIdentityEvent({
			store,
			identityId: candidate.link.identity_id,
			linkId: candidate.link.id,
			action: 'note',
			payload: { source: 'unrelated catalog row' }
		});

		const state = await readBeanIdentityState({ store, coffeeCatalogId: 31, includeEvents: true });

		expect(state.links).toHaveLength(0);
		expect(state.events).toEqual([]);
	});

	it('treats empty link id filters as no matches in the Supabase store', async () => {
		let queryCount = 0;
		const store = createSupabaseBeanIdentityStore({
			from() {
				queryCount += 1;
				throw new Error('empty link id filters should not query Supabase');
			}
		} as never);

		await expect(store.listEvents({ linkIds: [] })).resolves.toEqual([]);
		expect(queryCount).toBe(0);
	});
});

interface MemoryStore extends BeanIdentityStore {
	identities: BeanIdentity[];
	links: BeanIdentityLink[];
	events: BeanIdentityEvent[];
}

function createMemoryBeanIdentityStore(): MemoryStore {
	let nextIdentityId = 1;
	let nextLinkId = 1;
	let nextEventId = 1;
	let tick = 1;
	const identities: BeanIdentity[] = [];
	const links: BeanIdentityLink[] = [];
	const events: BeanIdentityEvent[] = [];

	function now() {
		return new Date(Date.UTC(2026, 4, 7, 0, 0, tick++)).toISOString();
	}

	return {
		identities,
		links,
		events,
		async createIdentity(input) {
			const createdAt = now();
			const identity: BeanIdentity = {
				id: `identity-${nextIdentityId++}`,
				status: input.status ?? 'candidate',
				canonical_name: input.canonical_name ?? null,
				primary_catalog_id: input.primary_catalog_id ?? null,
				superseded_by: input.superseded_by ?? null,
				metadata: input.metadata ?? {},
				created_at: createdAt,
				updated_at: createdAt
			};
			identities.push(identity);
			return identity;
		},
		async updateIdentity(id, patch) {
			const identity = identities.find((entry) => entry.id === id);
			if (!identity) throw new Error(`Missing identity ${id}`);
			Object.assign(identity, patch, { updated_at: now() });
			return identity;
		},
		async createLink(input) {
			if (!input.identity_id || !input.coffee_catalog_id)
				throw new Error('identity and catalog ids are required');
			if (
				links.some(
					(link) =>
						link.identity_id === input.identity_id &&
						link.coffee_catalog_id === input.coffee_catalog_id &&
						link.active
				)
			) {
				throw new Error('duplicate active identity/catalog link');
			}
			const createdAt = now();
			const link: BeanIdentityLink = {
				id: `link-${nextLinkId++}`,
				identity_id: input.identity_id,
				coffee_catalog_id: input.coffee_catalog_id,
				status: input.status ?? 'candidate',
				active: input.active ?? true,
				classifier_version: input.classifier_version ?? null,
				dimension_scores: input.dimension_scores ?? {},
				blockers: input.blockers ?? [],
				proof_summary_snapshot: input.proof_summary_snapshot ?? {},
				reason_codes: input.reason_codes ?? [],
				metadata: input.metadata ?? {},
				proposed_by: input.proposed_by ?? null,
				reviewed_by: input.reviewed_by ?? null,
				superseded_by: input.superseded_by ?? null,
				proposed_at: input.proposed_at ?? createdAt,
				reviewed_at: input.reviewed_at ?? null,
				created_at: createdAt,
				updated_at: createdAt
			};
			links.push(link);
			return link;
		},
		async updateLink(id, patch) {
			const link = links.find((entry) => entry.id === id);
			if (!link) throw new Error(`Missing link ${id}`);
			if (patch.status === 'accepted' && patch.active !== false) {
				const conflict = links.find(
					(entry) =>
						entry.id !== id &&
						entry.coffee_catalog_id === link.coffee_catalog_id &&
						entry.status === 'accepted' &&
						entry.active
				);
				if (conflict) throw new Error(`duplicate active accepted link ${conflict.id}`);
			}
			Object.assign(link, patch, { updated_at: now() });
			return link;
		},
		async getLink(id) {
			return links.find((link) => link.id === id) ?? null;
		},
		async findLinksByCatalogId(coffeeCatalogId) {
			return links.filter((link) => link.coffee_catalog_id === coffeeCatalogId);
		},
		async findRejectedLinks({ coffeeCatalogId, identityId }) {
			return links.filter(
				(link) =>
					link.coffee_catalog_id === coffeeCatalogId &&
					link.status === 'rejected' &&
					(!identityId || link.identity_id === identityId)
			);
		},
		async findActiveAcceptedLink(coffeeCatalogId) {
			return (
				links.find(
					(link) =>
						link.coffee_catalog_id === coffeeCatalogId && link.status === 'accepted' && link.active
				) ?? null
			);
		},
		async createCandidate(input) {
			const originalIdentitiesLength = identities.length;
			const originalLinksLength = links.length;
			const originalEventsLength = events.length;
			const existingIdentity = input.identityId
				? (identities.find((entry) => entry.id === input.identityId) ?? null)
				: null;
			const originalExistingIdentity = existingIdentity ? { ...existingIdentity } : null;
			try {
				const identity = input.identityId
					? null
					: await this.createIdentity({
							status: 'candidate',
							canonical_name: input.canonicalName ?? null,
							primary_catalog_id: input.coffeeCatalogId,
							metadata: input.snapshot.metadata ?? {}
						});
				const resolvedIdentityId = input.identityId ?? identity?.id;
				if (!resolvedIdentityId) throw new Error('Identity id is required to create a link');

				if (input.identityId) {
					await this.updateIdentity(resolvedIdentityId, {
						status: 'candidate',
						primary_catalog_id: input.coffeeCatalogId
					});
				}

				const link = await this.createLink({
					identity_id: resolvedIdentityId,
					coffee_catalog_id: input.coffeeCatalogId,
					status: 'candidate',
					active: true,
					classifier_version: input.snapshot.classifierVersion,
					dimension_scores: input.snapshot.dimensionScores,
					blockers: input.snapshot.blockers,
					proof_summary_snapshot: input.snapshot.proofSummarySnapshot,
					reason_codes: input.snapshot.reasonCodes,
					metadata: input.snapshot.metadata ?? {},
					proposed_by: input.actorId ?? null
				});

				const event = await this.createEvent({
					identity_id: link.identity_id,
					link_id: link.id,
					action: 'create',
					actor_id: input.actorId ?? null,
					payload: {
						coffee_catalog_id: input.coffeeCatalogId,
						candidate_snapshot: input.snapshot
					} as unknown as BeanIdentityEvent['payload']
				});

				return { identity, link, event };
			} catch (error) {
				if (existingIdentity && originalExistingIdentity) {
					Object.assign(existingIdentity, originalExistingIdentity);
				}
				identities.splice(originalIdentitiesLength);
				links.splice(originalLinksLength);
				events.splice(originalEventsLength);
				throw error;
			}
		},
		async reviewLink(input) {
			const link = links.find((entry) => entry.id === input.linkId);
			if (!link) throw new Error(`Missing link ${input.linkId}`);
			const identity = identities.find((entry) => entry.id === link.identity_id);
			if (!identity) throw new Error(`Missing identity ${link.identity_id}`);
			const originalLink = { ...link };
			const originalIdentity = { ...identity };
			let event: BeanIdentityEvent | null = null;

			try {
				event = await this.createEvent({
					identity_id: link.identity_id,
					link_id: link.id,
					action: input.action,
					actor_id: input.actorId ?? null,
					payload: {
						previous_status: link.status,
						...(input.action === 'supersede'
							? { superseded_by_link_id: input.supersededByLinkId ?? null }
							: {}),
						reason_codes: input.reasonCodes ?? [],
						metadata: input.metadata ?? {},
						note: input.note ?? null
					}
				});

				const reviewedAt = now();
				Object.assign(link, {
					status:
						input.action === 'accept'
							? 'accepted'
							: input.action === 'reject'
								? 'rejected'
								: 'superseded',
					active: input.action === 'accept',
					reviewed_by: input.actorId ?? null,
					reviewed_at: reviewedAt,
					superseded_by:
						input.action === 'supersede' ? (input.supersededByLinkId ?? null) : link.superseded_by,
					reason_codes: Array.from(new Set([...link.reason_codes, ...(input.reasonCodes ?? [])])),
					metadata: {
						...(link.metadata as Record<string, unknown>),
						...((input.metadata ?? {}) as Record<string, unknown>)
					},
					updated_at: now()
				});

				if (input.action === 'accept') {
					Object.assign(identity, {
						status: 'accepted',
						primary_catalog_id: link.coffee_catalog_id,
						superseded_by: null,
						updated_at: now()
					});
				} else if (input.action === 'reject') {
					const accepted = links.find(
						(entry) =>
							entry.identity_id === link.identity_id && entry.status === 'accepted' && entry.active
					);
					const hasCandidate = links.some(
						(entry) =>
							entry.identity_id === link.identity_id && entry.status === 'candidate' && entry.active
					);
					Object.assign(identity, {
						status: accepted ? 'accepted' : hasCandidate ? 'candidate' : 'rejected',
						primary_catalog_id: accepted?.coffee_catalog_id ?? identity.primary_catalog_id,
						superseded_by: accepted ? null : identity.superseded_by,
						updated_at: now()
					});
				} else {
					const accepted = links.find(
						(entry) =>
							entry.identity_id === link.identity_id && entry.status === 'accepted' && entry.active
					);
					const hasCandidate = links.some(
						(entry) =>
							entry.identity_id === link.identity_id && entry.status === 'candidate' && entry.active
					);
					const replacement = input.supersededByLinkId
						? links.find((entry) => entry.id === input.supersededByLinkId)
						: null;
					Object.assign(identity, {
						status: accepted ? 'accepted' : hasCandidate ? 'candidate' : 'superseded',
						primary_catalog_id: accepted?.coffee_catalog_id ?? identity.primary_catalog_id,
						superseded_by: accepted || hasCandidate ? null : (replacement?.identity_id ?? null),
						updated_at: now()
					});
				}

				return { link, event };
			} catch (error) {
				Object.assign(link, originalLink);
				Object.assign(identity, originalIdentity);
				if (event) events.splice(events.indexOf(event), 1);
				throw error;
			}
		},
		async createEvent(input) {
			if (!input.action) throw new Error('action is required');
			const event: BeanIdentityEvent = {
				id: `event-${nextEventId++}`,
				identity_id: input.identity_id ?? null,
				link_id: input.link_id ?? null,
				action: input.action,
				actor_id: input.actor_id ?? null,
				payload: input.payload ?? {},
				created_at: now()
			};
			events.push(event);
			return event;
		},
		async listEvents({ identityId, linkIds }) {
			if (linkIds && linkIds.length === 0) return [];

			return events.filter((event) => {
				if (identityId && event.identity_id !== identityId) return false;
				if (linkIds && (!event.link_id || !linkIds.includes(event.link_id))) return false;
				return true;
			});
		}
	};
}
