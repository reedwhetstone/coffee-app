import { formatDay } from './profile-picker-model';

/** One choice in the roast list's coffee control: a portfolio coffee, by inventory ID. */
export interface RoastCoffeeOption {
	id: number;
	name: string;
}

/** The portfolio fields a coffee choice is named from. */
export interface PortfolioCoffee {
	id: number;
	name?: string | null;
	purchase_date?: string | null;
	coffee_catalog?: { name?: string | null } | null;
}

/**
 * The coffees to choose from, by name. A coffee bought more than once is in the portfolio
 * once per purchase, so those choices add the purchase date to tell them apart, and the
 * portfolio number as well when two purchases share a date.
 */
export function roastCoffeeOptions(coffees: readonly PortfolioCoffee[]): RoastCoffeeOption[] {
	const named = coffees.map((coffee) => ({
		id: coffee.id,
		name: coffee.name?.trim() || coffee.coffee_catalog?.name?.trim() || `Coffee #${coffee.id}`,
		purchased: formatDay(coffee.purchase_date)
	}));
	const count = (names: readonly string[]) => {
		const counts = new Map<string, number>();
		for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
		return counts;
	};

	const names = count(named.map((coffee) => coffee.name));
	const dated = named.map((coffee) => ({
		id: coffee.id,
		purchased: coffee.purchased,
		name:
			(names.get(coffee.name) ?? 0) > 1
				? `${coffee.name} · ${coffee.purchased ? `purchased ${coffee.purchased}` : `#${coffee.id}`}`
				: coffee.name
	}));
	const labels = count(dated.map((coffee) => coffee.name));

	return dated
		.map((coffee) => ({
			id: coffee.id,
			name: (labels.get(coffee.name) ?? 0) > 1 ? `${coffee.name} · #${coffee.id}` : coffee.name
		}))
		.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}
