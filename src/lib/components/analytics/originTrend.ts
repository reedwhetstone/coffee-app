export const UTC_DAY_MS = 86_400_000;

export function utcDateKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Snap inspection to the nearest UTC day, never to a nearby observation. */
export function inspectionDate(date: Date): Date {
	return new Date(Math.round(date.getTime() / UTC_DAY_MS) * UTC_DAY_MS);
}

export function observationOnDate<T extends { date: Date }>(
	points: T[],
	date: Date
): T | undefined {
	const key = utcDateKey(date);
	return points.find((point) => utcDateKey(point.date) === key);
}

/** Each returned segment contains only consecutive published daily observations. */
export function dailySegments<T extends { date: Date; synthetic?: boolean; statistic?: string }>(
	points: T[]
): T[][] {
	const segments: T[][] = [];
	for (const point of [...points].sort((a, b) => +a.date - +b.date)) {
		const segment = segments.at(-1);
		const previous = segment?.at(-1);
		if (
			!previous ||
			+point.date - +previous.date !== UTC_DAY_MS ||
			Boolean(point.synthetic) !== Boolean(previous.synthetic) ||
			point.statistic !== previous.statistic
		)
			segments.push([point]);
		else segment!.push(point);
	}
	return segments;
}

/** Include every finite published value, including suspicious extremes. */
export function trendDomain(values: number[], spread = false): [number, number] {
	const finite = values.filter(Number.isFinite);
	if (!finite.length) return spread ? [-5, 50] : [0, 10];
	const low = Math.min(...finite, ...(spread ? [0] : []));
	const high = Math.max(...finite, ...(spread ? [0] : []));
	const padding = Math.max((high - low) * 0.08, spread ? 1 : 0.25);
	return [spread ? low - padding : Math.max(0, low - padding), high + padding];
}

export function cohortSeriesLabel(origin: string, wholesale: boolean, mixed: boolean): string {
	return mixed ? `${origin} · ${wholesale ? 'wholesale' : 'retail'}` : origin;
}
