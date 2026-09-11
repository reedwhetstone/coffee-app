/** Start existing authenticated product reads during server rendering, preserving
 * their authorization and response contracts. Errors settle into a serializable
 * result so the page can render its existing retry UI without an unhandled stream. */
export async function loadProductPageData<T>(
	fetcher: typeof fetch,
	path: string
): Promise<{ data: T; error: null } | { data: null; error: string }> {
	try {
		const response = await fetcher(path);
		if (!response.ok) throw new Error(`Failed to load data (${response.status})`);
		return { data: (await response.json()) as T, error: null };
	} catch (error) {
		return { data: null, error: error instanceof Error ? error.message : 'Failed to load data' };
	}
}
