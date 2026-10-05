/**
 * Roast batches the E2E specs leave on the test account.
 *
 * A roast belongs to a batch, and deleting the roast keeps the batch. A spec that creates a
 * roast therefore deletes its batch, and the global teardown removes any batch a run left
 * empty. Both go through the app's own routes, as a member would.
 */

export interface CleanupResponse {
	ok(): boolean;
	status(): number;
	json(): Promise<unknown>;
}

/** The part of Playwright's APIRequestContext the cleanup uses. */
export interface CleanupRequest {
	get(url: string): Promise<CleanupResponse>;
	delete(url: string): Promise<CleanupResponse>;
}

export interface BatchCleanupOptions {
	/**
	 * `this-run` removes only the empty batches created since the run started. `all` removes
	 * every empty batch on the account, including those earlier runs left behind.
	 */
	scope: 'this-run' | 'all';
	/** When the run started (ISO 8601). Required for `this-run`. */
	startedAt?: string | null;
	log?: (message: string) => void;
}

export interface BatchCleanupResult {
	/** Empty batches on the account. */
	empty: number;
	/** Of those, the ones this cleanup was allowed to remove. */
	selected: number;
	deleted: number;
	failed: number;
}

const BATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Allowance for the clocks of the test runner and the API differing. */
const CLOCK_ALLOWANCE_MS = 5 * 60 * 1000;

interface ListedBatch {
	id: string;
	roastCount: number;
	createdAt: number | null;
}

function listedBatches(body: unknown): ListedBatch[] {
	const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
	if (!Array.isArray(data)) return [];
	return data.flatMap((row) => {
		if (typeof row !== 'object' || row === null) return [];
		const batch = row as Record<string, unknown>;
		if (typeof batch.id !== 'string' || !BATCH_ID.test(batch.id)) return [];
		// A batch is removed only when it is known to hold no roasts.
		if (typeof batch.roast_count !== 'number') return [];
		const created = typeof batch.created_at === 'string' ? Date.parse(batch.created_at) : NaN;
		return [
			{
				id: batch.id,
				roastCount: batch.roast_count,
				createdAt: Number.isNaN(created) ? null : created
			}
		];
	});
}

/** The batch ID a created roast carries, or null when the response has none. */
export function createdBatchId(profile: unknown): string | null {
	if (typeof profile !== 'object' || profile === null) return null;
	const batchId = (profile as { batch_id?: unknown }).batch_id;
	return typeof batchId === 'string' && BATCH_ID.test(batchId) ? batchId : null;
}

/**
 * The IDs of the batches to remove from a `GET /api/roast-batches?include_empty=true`
 * response: batches with no roasts, and under `this-run` only those created since the run
 * started. A batch that holds a roast is never selected.
 */
export function batchesToRemove(
	body: unknown,
	options: Pick<BatchCleanupOptions, 'scope' | 'startedAt'>
): { empty: number; ids: string[] } {
	const empty = listedBatches(body).filter((batch) => batch.roastCount === 0);
	if (options.scope === 'all') return { empty: empty.length, ids: empty.map((batch) => batch.id) };

	const started = options.startedAt ? Date.parse(options.startedAt) : NaN;
	if (Number.isNaN(started)) return { empty: empty.length, ids: [] };
	const since = started - CLOCK_ALLOWANCE_MS;
	return {
		empty: empty.length,
		ids: empty
			.filter((batch) => batch.createdAt !== null && batch.createdAt >= since)
			.map((batch) => batch.id)
	};
}

/** Read only the test account's roasts associated with its inventory from the app response. */
export function roastIdsForInventory(body: unknown, inventoryIds: number[]): number[] | null {
	const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
	if (!Array.isArray(data)) return null;
	const inventory = new Set(inventoryIds);
	const ids: number[] = [];
	for (const row of data) {
		if (typeof row !== 'object' || row === null) return null;
		const { roast_id, coffee_id } = row as Record<string, unknown>;
		if (!Number.isSafeInteger(roast_id) || !Number.isSafeInteger(coffee_id)) return null;
		if (inventory.has(coffee_id as number)) ids.push(roast_id as number);
	}
	return ids;
}

/** Delete roast IDs through the app route, never the roast table. */
export async function deleteRoastsById(
	request: CleanupRequest,
	ids: number[],
	log: (message: string) => void = () => {}
): Promise<{ deleted: number; failed: number }> {
	let deleted = 0;
	let failed = 0;
	for (const id of ids) {
		if (!Number.isSafeInteger(id) || id <= 0) {
			failed += 1;
			log(`[teardown] Invalid roast ID ${id}; roast not deleted`);
			continue;
		}
		const response = await request.delete(`/api/roast-profiles?id=${id}`);
		if (response.ok() || response.status() === 404) deleted += 1;
		else {
			failed += 1;
			log(`[teardown] Could not delete roast ${id} (${response.status()})`);
		}
	}
	return { deleted, failed };
}

/** Remove the selected empty batches through the app's routes. Failures are logged, not thrown. */
export async function removeEmptyBatches(
	request: CleanupRequest,
	options: BatchCleanupOptions
): Promise<BatchCleanupResult> {
	const log = options.log ?? (() => {});
	const result: BatchCleanupResult = { empty: 0, selected: 0, deleted: 0, failed: 0 };

	const listed = await request.get('/api/roast-batches?include_empty=true');
	if (!listed.ok()) {
		log(`[teardown] Could not list roast batches (${listed.status()}); none removed`);
		return result;
	}

	const { empty, ids } = batchesToRemove(await listed.json(), options);
	result.empty = empty;
	result.selected = ids.length;

	for (const id of ids) {
		const removed = await request.delete(`/api/roast-batches/${id}`);
		// Already gone counts as removed: another run or the spec itself got there first.
		if (removed.ok() || removed.status() === 404) result.deleted += 1;
		else {
			result.failed += 1;
			log(`[teardown] Could not delete roast batch ${id} (${removed.status()})`);
		}
	}

	log(
		`[teardown] Roast batches: ${result.empty} empty, ${result.deleted} deleted` +
			(result.failed ? `, ${result.failed} failed` : '') +
			(options.scope === 'this-run' && result.empty > result.selected
				? `, ${result.empty - result.selected} from earlier runs left in place`
				: '')
	);
	return result;
}

/**
 * The email of the account a saved Playwright session is signed in as, read from its
 * Supabase auth cookie. Null when the session cannot be read, so a caller can refuse to act.
 */
export function storageStateEmail(state: unknown, supabaseUrl: string): string | null {
	let cookieName: string;
	try {
		cookieName = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
	} catch {
		return null;
	}

	const cookies =
		typeof state === 'object' && state !== null ? (state as { cookies?: unknown }).cookies : null;
	if (!Array.isArray(cookies)) return null;

	// The session is one cookie, or chunks named `.0`, `.1`, … in order.
	const parts = cookies
		.flatMap((cookie) => {
			if (typeof cookie !== 'object' || cookie === null) return [];
			const { name, value } = cookie as { name?: unknown; value?: unknown };
			if (typeof name !== 'string' || typeof value !== 'string') return [];
			if (name === cookieName) return [{ index: 0, value }];
			const chunk = name.startsWith(`${cookieName}.`) ? name.slice(cookieName.length + 1) : '';
			return /^\d+$/.test(chunk) ? [{ index: Number(chunk), value }] : [];
		})
		.sort((a, b) => a.index - b.index);
	if (parts.length === 0) return null;

	let text = parts.map((part) => part.value).join('');
	try {
		text = decodeURIComponent(text);
	} catch {
		// Not percent-encoded.
	}
	if (text.startsWith('base64-')) {
		text = Buffer.from(text.slice('base64-'.length), 'base64url').toString('utf8');
	}

	try {
		const email = (JSON.parse(text) as { user?: { email?: unknown } }).user?.email;
		return typeof email === 'string' && email ? email.toLowerCase() : null;
	} catch {
		return null;
	}
}
