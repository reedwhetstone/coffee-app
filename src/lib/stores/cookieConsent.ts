import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface CookieConsentState {
	hasConsented: boolean;
	timestamp: number | null;
}

const STORAGE_KEY = 'cookie-consent';

function createCookieConsentStore() {
	// Initialize with default state
	const defaultState: CookieConsentState = {
		hasConsented: false,
		timestamp: null
	};

	// Load from localStorage if available
	const loadFromStorage = (): CookieConsentState => {
		if (!browser) return defaultState;

		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				// Validate the structure
				if (typeof parsed.hasConsented === 'boolean') {
					return parsed;
				}
			}
		} catch (error) {
			console.warn('Error loading cookie consent from localStorage:', error);
		}
		return defaultState;
	};

	const { subscribe, set, update } = writable<CookieConsentState>(loadFromStorage());

	// Save to localStorage whenever state changes
	const saveToStorage = (state: CookieConsentState) => {
		if (!browser) return;

		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch (error) {
			console.warn('Error saving cookie consent to localStorage:', error);
		}
	};

	return {
		subscribe,
		accept: () => {
			const newState: CookieConsentState = {
				hasConsented: true,
				timestamp: Date.now()
			};
			set(newState);
			saveToStorage(newState);
		},
		reset: () => {
			const newState = defaultState;
			set(newState);
			saveToStorage(newState);
		},
		// Helper to check if consent is needed
		needsConsent: (state: CookieConsentState) => !state.hasConsented
	};
}

export const cookieConsent = createCookieConsentStore();
