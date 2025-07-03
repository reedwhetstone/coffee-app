<!-- src/lib/components/CookieConsentExample.svelte -->
<!-- 
	Example component demonstrating how to use cookie consent helpers throughout your app.
	You can import and use these functions anywhere in your application.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cookieConsentStore, getCookieConsent, areCookiesAccepted } from '$lib';

	let consentStatus = $state('checking...');
	let canUseAnalytics = $state(false);

	onMount(() => {
		// Example 1: Check current cookie consent status
		const currentStatus = getCookieConsent();
		consentStatus = currentStatus;

		// Example 2: Check if cookies are accepted for analytics
		canUseAnalytics = areCookiesAccepted();

		// Example 3: React to consent changes
		const unsubscribe = cookieConsentStore.subscribe((status) => {
			consentStatus = status;
			canUseAnalytics = status === 'accepted';

			// Enable/disable analytics based on consent
			if (status === 'accepted') {
				console.log('🍪 Cookies accepted - Analytics enabled');
				// Here you would initialize analytics like Google Analytics, etc.
				// Example: gtag('config', 'GA_TRACKING_ID');
			} else {
				console.log('🚫 Cookies not accepted - Analytics disabled');
				// Here you would disable or remove analytics
			}
		});

		return unsubscribe;
	});

	// Example function that only runs if cookies are accepted
	function trackUserAction(action: string) {
		if (areCookiesAccepted()) {
			console.log(`Tracking user action: ${action}`);
			// Your analytics code here
		} else {
			console.log('Analytics disabled - user has not accepted cookies');
		}
	}

	// Example function to reset consent for testing
	function resetConsent() {
		cookieConsentStore.reset();
	}
</script>

<!-- Example usage display -->
<div class="rounded-lg border border-border-light bg-background-secondary-light p-4">
	<h3 class="mb-3 text-lg font-semibold text-text-primary-light">Cookie Consent Status</h3>
	
	<div class="space-y-2 text-sm">
		<p class="text-text-secondary-light">
			<strong>Current Status:</strong> 
			<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
				{consentStatus === 'accepted' ? 'bg-green-100 text-green-800' : 
				  consentStatus === 'dismissed' ? 'bg-yellow-100 text-yellow-800' : 
				  'bg-gray-100 text-gray-800'}">
				{consentStatus}
			</span>
		</p>
		
		<p class="text-text-secondary-light">
			<strong>Analytics Enabled:</strong> 
			<span class="{canUseAnalytics ? 'text-green-600' : 'text-red-600'}">
				{canUseAnalytics ? 'Yes' : 'No'}
			</span>
		</p>
	</div>

	<div class="mt-4 flex gap-2">
		<button
			onclick={() => trackUserAction('button_click')}
			class="rounded bg-background-tertiary-light px-3 py-1 text-sm text-white hover:bg-opacity-90"
		>
			Test Analytics Call
		</button>
		
		<button
			onclick={resetConsent}
			class="rounded border border-background-tertiary-light px-3 py-1 text-sm text-background-tertiary-light hover:bg-background-tertiary-light hover:text-white"
		>
			Reset Consent (Testing)
		</button>
	</div>
</div>

<!-- Usage instructions -->
<div class="mt-4 rounded-lg bg-background-primary-light p-4 text-sm text-text-secondary-light">
	<h4 class="font-semibold text-text-primary-light">Usage Examples:</h4>
	<pre class="mt-2 overflow-x-auto text-xs"><code>{`// Import the helpers anywhere in your app
import { getCookieConsent, areCookiesAccepted } from '$lib';

// Check current status
const status = getCookieConsent(); // 'pending' | 'accepted' | 'dismissed'

// Quick boolean check for analytics
if (areCookiesAccepted()) {
  // Initialize analytics, tracking, etc.
  gtag('config', 'GA_TRACKING_ID');
}

// React to changes
cookieConsentStore.subscribe((status) => {
  if (status === 'accepted') {
    enableAnalytics();
  }
});`}</code></pre>
</div>