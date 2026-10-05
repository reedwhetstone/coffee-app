const COFFEE_ID = /^[1-9]\d*$/;

/** The portfolio coffee a `/roast?coffee=<inventory id>` link narrows the roast list to. */
export function readCoffeeFilter(searchParams: URLSearchParams): number | null {
	const value = searchParams.get('coffee')?.trim();
	if (!value || !COFFEE_ID.test(value)) return null;
	const coffeeId = Number(value);
	return Number.isSafeInteger(coffeeId) ? coffeeId : null;
}

/** The link to the roast list showing one coffee's roasts. */
export function coffeeRoastsHref(coffeeId: number | string): string {
	return `/roast?coffee=${coffeeId}`;
}

/** The link to the new-roast form with a portfolio coffee filled in. */
export function newRoastHref(coffeeId: number | string, coffeeName: string): string {
	return `/roast?modal=new&beanId=${coffeeId}&beanName=${encodeURIComponent(coffeeName)}`;
}

interface BatchedRoast {
	coffee_id?: number | null;
	coffee_name?: string | null;
}

/**
 * Narrow the roast list's batches to one coffee. A batch keeps only that coffee's roasts,
 * and a batch with none of them is dropped. Batch order is kept.
 */
export function filterBatchesByCoffee<T extends BatchedRoast>(
	batchNames: readonly string[],
	groupedRoasts: Readonly<Record<string, T[]>>,
	coffeeId: number | null
): { batchNames: string[]; groupedRoasts: Record<string, T[]> } {
	if (coffeeId === null) {
		return { batchNames: [...batchNames], groupedRoasts: { ...groupedRoasts } };
	}
	const names: string[] = [];
	const grouped: Record<string, T[]> = {};
	for (const name of batchNames) {
		const roasts = (groupedRoasts[name] ?? []).filter((roast) => roast.coffee_id === coffeeId);
		if (roasts.length === 0) continue;
		names.push(name);
		grouped[name] = roasts;
	}
	return { batchNames: names, groupedRoasts: grouped };
}

/** The coffee's name as its roasts carry it, or null when none of them is for that coffee. */
export function coffeeFilterName(roasts: readonly BatchedRoast[], coffeeId: number): string | null {
	for (const roast of roasts) {
		if (roast.coffee_id === coffeeId && roast.coffee_name?.trim()) return roast.coffee_name.trim();
	}
	return null;
}
