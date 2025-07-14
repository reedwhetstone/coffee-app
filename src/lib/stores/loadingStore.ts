/**
 * Centralized loading state management store
 * Manages multiple concurrent loading operations with detailed progress tracking
 */

import { writable, derived, get } from 'svelte/store';

type LoadingState = {
	isLoading: boolean;
	message: string;
	progress?: number;
	operation: string;
};

type LoadingStoreData = {
	operations: Map<string, LoadingState>;
};

// Create the base writable store
const loadingStoreData = writable<LoadingStoreData>({
	operations: new Map()
});

// Derived stores for computed values
export const isAnyLoading = derived(loadingStoreData, ($store) => $store.operations.size > 0);

export const primaryOperation = derived(loadingStoreData, ($store) => {
	// Return the most recently started operation
	const operations = Array.from($store.operations.values());
	return operations.length > 0 ? operations[operations.length - 1] : null;
});

export const loadingStore = {
	// Subscribe to the store (for reactive usage)
	subscribe: loadingStoreData.subscribe,

	// Reactive getters
	get isAnyLoading() {
		return get(isAnyLoading);
	},
	get primaryOperation() {
		return get(primaryOperation);
	},
	get operations() {
		return Array.from(get(loadingStoreData).operations.values());
	},

	// Start a loading operation
	start(operationId: string, message: string, progress?: number) {
		loadingStoreData.update(($store) => {
			const newOperations = new Map($store.operations);
			newOperations.set(operationId, {
				isLoading: true,
				message,
				progress,
				operation: operationId
			});
			return {
				...$store,
				operations: newOperations
			};
		});
	},

	// Update an existing loading operation
	update(operationId: string, message: string, progress?: number) {
		loadingStoreData.update(($store) => {
			const currentState = $store.operations.get(operationId);
			if (currentState) {
				const newOperations = new Map($store.operations);
				newOperations.set(operationId, {
					...currentState,
					message,
					progress
				});
				return {
					...$store,
					operations: newOperations
				};
			}
			return $store;
		});
	},

	// Complete and remove a loading operation
	complete(operationId: string) {
		loadingStoreData.update(($store) => {
			const newOperations = new Map($store.operations);
			newOperations.delete(operationId);
			return {
				...$store,
				operations: newOperations
			};
		});
	},

	// Clear all loading operations (for error scenarios)
	clearAll() {
		loadingStoreData.set({
			operations: new Map()
		});
	},

	// Get specific operation state
	getOperation(operationId: string): LoadingState | undefined {
		return get(loadingStoreData).operations.get(operationId);
	},

	// Check if specific operation is loading
	isLoading(operationId: string): boolean {
		return get(loadingStoreData).operations.has(operationId);
	}
};
