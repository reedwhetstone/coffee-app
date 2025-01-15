import { writable } from 'svelte/store';

export const navbarActions = writable({
	onAddNewBean: () => {}, // default empty function
	onAddNewRoast: () => {},
	onAddNewSale: () => {},
	onShowRoastForm: () => {} // new action
});
