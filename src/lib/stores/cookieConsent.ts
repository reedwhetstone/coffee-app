import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const COOKIE_CONSENT_KEY = 'cookie-consent';

type CookieConsentStatus = 'pending' | 'accepted' | 'dismissed';

/**
 * Store for managing cookie consent state
 * Automatically syncs with localStorage when in browser environment
 */
function createCookieConsentStore() {
	// Initialize with pending state
	const { subscribe, set, update } = writable<CookieConsentStatus>('pending');

	return {
		subscribe,
		/**
		 * Accept cookies and store preference in localStorage
		 */
		accept: () => {
			if (browser) {
				localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
			}
			set('accepted');
		},
		/**
		 * Dismiss the consent popup without accepting
		 */
		dismiss: () => {
			if (browser) {
				localStorage.setItem(COOKIE_CONSENT_KEY, 'dismissed');
			}
			set('dismissed');
		},
		/**
		 * Initialize the store with value from localStorage
		 */
		initialize: () => {
			if (browser) {
				const stored = localStorage.getItem(COOKIE_CONSENT_KEY) as CookieConsentStatus;
				if (stored) {
					set(stored);
				}
			}
		},
		/**
		 * Reset consent state (useful for testing or admin functions)
		 */
		reset: () => {
			if (browser) {
				localStorage.removeItem(COOKIE_CONSENT_KEY);
			}
			set('pending');
		}
	};
}

export const cookieConsentStore = createCookieConsentStore();

/**
 * Helper function to get current cookie consent status
 * Can be used throughout the app to check if user has consented
 * @returns The current consent status
 */
export function getCookieConsent(): CookieConsentStatus {
	if (!browser) return 'pending';
	
	const stored = localStorage.getItem(COOKIE_CONSENT_KEY) as CookieConsentStatus;
	return stored || 'pending';
}

/**
 * Helper function to check if cookies are accepted
 * @returns true if user has accepted cookies
 */
export function areCookiesAccepted(): boolean {
	return getCookieConsent() === 'accepted';
}