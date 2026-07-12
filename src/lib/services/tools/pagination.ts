export async function collectOffsetPages<T, K>(options: {
	fetchPage: (offset: number) => Promise<T[]>;
	key: (row: T) => K;
	maxPages?: number;
}): Promise<T[]> {
	const rows = new Map<K, T>();
	let offset = 0;
	const maxPages = options.maxPages ?? 1000;

	for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
		const page = await options.fetchPage(offset);
		if (page.length === 0) return [...rows.values()];

		const before = rows.size;
		for (const row of page) rows.set(options.key(row), row);
		if (rows.size === before) {
			throw new Error('Parchment pagination made no progress');
		}
		offset += page.length;
	}

	throw new Error(`Parchment pagination exceeded ${maxPages} pages`);
}
