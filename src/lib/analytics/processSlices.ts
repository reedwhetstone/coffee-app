export interface ProcessSliceBucket {
	name: string;
	count: number;
}

/**
 * Fold slices under `minShare` of the total into "Other", largest first.
 * Always returns new objects: callers pass reactive state, and mutating it from
 * a derived value throws `state_unsafe_mutation` in Svelte 5.
 */
export function foldSmallProcessSlices(
	data: readonly ProcessSliceBucket[],
	minShare = 0.03
): ProcessSliceBucket[] {
	const total = data.reduce((sum, d) => sum + d.count, 0);
	if (total === 0) return data.map((d) => ({ name: d.name, count: d.count }));
	const threshold = total * minShare;
	const main: ProcessSliceBucket[] = [];
	let otherCount = 0;
	for (const d of data) {
		if (d.count >= threshold) main.push({ name: d.name, count: d.count });
		else otherCount += d.count;
	}
	if (otherCount > 0) {
		const other = main.find((d) => d.name === 'Other');
		if (other) other.count += otherCount;
		else main.push({ name: 'Other', count: otherCount });
	}
	return main.sort((a, b) => b.count - a.count);
}
