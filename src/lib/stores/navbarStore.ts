import { writable } from 'svelte/store';

interface NavbarActions {
	onAddNewBean: () => void;
	onAddNewRoast: () => void;
	onAddNewSale: () => void;
	onShowRoastForm: () => void;
	onSearchSelect?: (type: string, id: number) => void;
}

export const navbarActions = writable<NavbarActions>({
	onAddNewBean: () => {}, // default empty function
	onAddNewRoast: () => {},
	onAddNewSale: () => {},
	onShowRoastForm: () => {}, // new action
	onSearchSelect: () => {}
});
