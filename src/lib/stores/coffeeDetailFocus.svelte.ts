/**
 * Only one coffee detail panel is open at a time. Each CoffeeCard instance
 * claims ownership when it opens its panel; any other open panel closes when
 * ownership moves away from it.
 */
let owner = $state<symbol | null>(null);

export const coffeeDetailFocus = {
	get owner(): symbol | null {
		return owner;
	},
	claim(id: symbol): void {
		owner = id;
	},
	release(id: symbol): void {
		if (owner === id) owner = null;
	}
};
