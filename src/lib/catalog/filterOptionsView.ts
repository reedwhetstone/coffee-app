import type { CatalogFacetCount, CatalogVocabularyEntry } from '$lib/catalog/filterOptions';

/** One selectable option, as the chip and checklist controls take it. */
export interface CatalogFilterOption {
	value: string;
	label: string;
	count?: number | null;
	indent?: boolean;
}

type Sort = 'count' | 'label' | 'given';

/**
 * Options for a control, with the number of coffees each would match.
 *
 * While the control has no selection, options matching nothing are left out.
 * Once it has one, every option stays listed (disabled at zero) so the choices
 * do not jump around as the viewer works, and a selected option always shows.
 */
export function countedOptions(input: {
	values: readonly unknown[] | undefined;
	counts: readonly CatalogFacetCount[] | undefined;
	selected: readonly string[];
	label?: (value: string) => string;
	keep?: (value: string) => boolean;
	sort?: Sort;
}): CatalogFilterOption[] {
	const label = input.label ?? ((value: string) => value);
	const countByValue = new Map((input.counts ?? []).map((entry) => [entry.value, entry.count]));
	const known = new Set<string>();
	for (const value of input.values ?? []) {
		if (value !== null && value !== undefined && String(value) !== '') known.add(String(value));
	}
	for (const value of countByValue.keys()) known.add(value);
	for (const value of input.selected) known.add(value);

	const hasCounts = input.counts !== undefined;
	const options = [...known]
		.filter((value) => input.selected.includes(value) || !input.keep || input.keep(value))
		.map((value) => ({
			value,
			label: label(value),
			count: hasCounts ? (countByValue.get(value) ?? 0) : null
		}))
		.filter(
			(option) =>
				!hasCounts ||
				input.selected.length > 0 ||
				(option.count ?? 0) > 0 ||
				input.selected.includes(option.value)
		);

	const sort = input.sort ?? 'count';
	if (sort === 'label') return options.sort((a, b) => a.label.localeCompare(b.label));
	if (sort === 'count') {
		return options.sort(
			(a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label)
		);
	}
	return options;
}

/**
 * Options for a vocabulary-backed control (variety, species, drying), in
 * family order: each family, then the values under it, indented.
 */
export function vocabularyOptions(input: {
	entries: readonly CatalogVocabularyEntry[] | undefined;
	counts: readonly CatalogFacetCount[] | undefined;
	selected: readonly string[];
}): CatalogFilterOption[] {
	const entries = input.entries ?? [];
	const countByCode = new Map((input.counts ?? []).map((entry) => [entry.value, entry.count]));
	const hasCounts = input.counts !== undefined;
	const byLabel = (a: CatalogVocabularyEntry, b: CatalogVocabularyEntry) =>
		a.label.localeCompare(b.label);
	const shown = (entry: CatalogVocabularyEntry) =>
		!hasCounts ||
		input.selected.length > 0 ||
		(countByCode.get(entry.code) ?? 0) > 0 ||
		input.selected.includes(entry.code);

	const options: CatalogFilterOption[] = [];
	for (const family of entries.filter((entry) => entry.parent_code === null).sort(byLabel)) {
		const members = entries
			.filter((entry) => entry.parent_code === family.code)
			.sort(byLabel)
			.filter(shown);
		// A family with a listed value under it stays listed, so the indent has a heading.
		if (!shown(family) && members.length === 0) continue;
		for (const [entry, indent] of [
			[family, false] as const,
			...members.map((member) => [member, true] as const)
		]) {
			options.push({
				value: entry.code,
				label: entry.label,
				count: hasCounts ? (countByCode.get(entry.code) ?? 0) : null,
				...(indent ? { indent: true } : {})
			});
		}
	}
	return options;
}

const MONTHS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december'
];

/**
 * Supplier arrival options in reading order: availability words such as
 * "Spot" first, then months from the latest to the earliest.
 */
export function arrivalOptionOrder(options: CatalogFilterOption[]): CatalogFilterOption[] {
	const monthIndex = (value: string): number | null => {
		const match = /^([A-Za-z]+) (\d{4})$/.exec(value.trim());
		const month = match ? MONTHS.indexOf(match[1].toLowerCase()) : -1;
		return match && month >= 0 ? Number(match[2]) * 12 + month : null;
	};
	return [...options].sort((a, b) => {
		const left = monthIndex(a.value);
		const right = monthIndex(b.value);
		if (left === null && right === null) return a.label.localeCompare(b.label);
		if (left === null) return -1;
		if (right === null) return 1;
		return right - left;
	});
}

/** "Raised beds includes African beds." for each family with values under it. */
export function familyNotes(entries: readonly CatalogVocabularyEntry[] | undefined): string[] {
	const list = entries ?? [];
	return list
		.filter((entry) => entry.parent_code === null)
		.map((family) => {
			const members = list
				.filter((entry) => entry.parent_code === family.code)
				.map((entry) => entry.label);
			return members.length > 0 ? `${family.label} includes ${members.join(', ')}.` : null;
		})
		.filter((note): note is string => note !== null);
}

export function selectedList(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

export function selectedOne(value: unknown): string[] {
	return typeof value === 'string' && value !== '' ? [value] : [];
}
