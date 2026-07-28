export const INVENTORY_DELETE_CONFIRMATION =
	'Delete this coffee from your inventory? This is blocked while roast profiles or sales still depend on it.';

export const INVENTORY_DELETE_DEPENDENCY_MESSAGE =
	'This coffee cannot be deleted while roast profiles or sales depend on it. Remove those records first, then try again.';

type Fetch = typeof fetch;

type DeleteBeanResult = {
	ok: boolean;
	message?: string;
};

function messageForStatus(status: number, upstreamMessage?: string): string {
	switch (status) {
		case 404:
			return 'This coffee is no longer in your inventory.';
		case 409:
			return INVENTORY_DELETE_DEPENDENCY_MESSAGE;
		case 429:
			return 'Too many inventory changes were requested. Wait a moment, then try again.';
		case 503:
			return 'Inventory deletion is temporarily unavailable. Try again shortly.';
		default:
			return upstreamMessage || 'Failed to delete this coffee.';
	}
}

function upstreamErrorMessage(body: unknown): string | undefined {
	if (!body || typeof body !== 'object' || !('error' in body)) return undefined;
	const error = body.error;
	if (typeof error === 'string') return error;
	if (
		error &&
		typeof error === 'object' &&
		'message' in error &&
		typeof error.message === 'string'
	) {
		return error.message;
	}
	return undefined;
}

/**
 * Delete one portfolio row and refresh only after confirmed success. Keeping
 * the success callback out of error paths leaves a dependency-blocked row
 * visible and gives the page a stable place to present actionable feedback.
 */
export async function deletePortfolioBean(
	fetcher: Fetch,
	id: number,
	onDeleted: () => Promise<void>
): Promise<DeleteBeanResult> {
	const response = await fetcher(`/api/beans?id=${id}`, { method: 'DELETE' });
	if (response.ok) {
		await onDeleted();
		return { ok: true };
	}

	// A 404 means the desired end state is already true, usually because this
	// page is stale relative to another session. Refresh instead of leaving a
	// nonexistent inventory row visible.
	if (response.status === 404) {
		await onDeleted();
		return { ok: true };
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		body = undefined;
	}

	return {
		ok: false,
		message: messageForStatus(response.status, upstreamErrorMessage(body))
	};
}
