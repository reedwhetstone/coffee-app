import { browser } from '$app/environment';

export interface CompareItem {
	id: number;
	name: string;
}

const STORAGE_KEY = 'purveyors.compareSelection';

function load(): CompareItem[] {
	if (!browser) return [];
	try {
		const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
		return Array.isArray(parsed)
			? parsed.filter(
					(item): item is CompareItem =>
						typeof item?.id === 'number' && typeof item?.name === 'string'
				)
			: [];
	} catch {
		return [];
	}
}

let items = $state<CompareItem[]>(load());

function persist() {
	if (browser) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Coffees picked for side-by-side comparison, kept for the browser session. */
export const compareSelection = {
	get items(): CompareItem[] {
		return items;
	},
	has(id: number): boolean {
		return items.some((item) => item.id === id);
	},
	/** Adds when under `limit`; returns false when the limit is reached. */
	toggle(item: CompareItem, limit: number): boolean {
		if (items.some((existing) => existing.id === item.id)) {
			items = items.filter((existing) => existing.id !== item.id);
			persist();
			return true;
		}
		if (items.length >= limit) return false;
		items = [...items, item];
		persist();
		return true;
	},
	remove(id: number): void {
		items = items.filter((item) => item.id !== id);
		persist();
	},
	clear(): void {
		items = [];
		persist();
	}
};
