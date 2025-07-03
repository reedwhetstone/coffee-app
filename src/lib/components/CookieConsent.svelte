<!-- src/lib/components/CookieConsent.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { cookieConsentStore } from '$lib/stores/cookieConsent';

	// Reactive state for showing the popup
	let showPopup = $state(false);
	let isVisible = $state(false);

	// Subscribe to store changes
	let consentStatus = $state('pending');
	
	// Handle store subscription
	onMount(() => {
		// Initialize the store on mount
		cookieConsentStore.initialize();
		
		// Subscribe to store changes
		const unsubscribe = cookieConsentStore.subscribe((status) => {
			consentStatus = status;
			// Show popup only if consent is pending
			if (status === 'pending') {
				// Small delay to ensure DOM is ready for animation
				setTimeout(() => {
					showPopup = true;
					// Trigger animation after component is rendered
					setTimeout(() => {
						isVisible = true;
					}, 50);
				}, 100);
			} else {
				isVisible = false;
				// Delay hiding the popup to allow exit animation
				setTimeout(() => {
					showPopup = false;
				}, 300);
			}
		});

		return unsubscribe;
	});

	/**
	 * Handle accepting cookies
	 */
	function handleAccept() {
		cookieConsentStore.accept();
	}

	/**
	 * Handle dismissing the popup without accepting
	 */
	function handleDismiss() {
		cookieConsentStore.dismiss();
	}

	/**
	 * Handle keyboard navigation for accessibility
	 */
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleDismiss();
		}
	}
</script>

<!-- Cookie Consent Popup -->
{#if showPopup}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center p-4 sm:p-6"
		role="dialog"
		aria-labelledby="cookie-consent-title"
		aria-describedby="cookie-consent-description"
		aria-modal="true"
		onkeydown={handleKeydown}
	>
		<!-- Background overlay -->
		<div
			class="fixed inset-0 bg-black/20 transition-opacity duration-300 {isVisible
				? 'opacity-100'
				: 'opacity-0'}"
			onclick={handleDismiss}
			aria-hidden="true"
		></div>

		<!-- Popup Content -->
		<div
			class="relative w-full max-w-lg transform rounded-lg border border-border-light bg-background-primary-light shadow-xl transition-all duration-300 ease-out {isVisible
				? 'translate-y-0 opacity-100'
				: 'translate-y-full opacity-0'}"
		>
			<!-- Close button -->
			<button
				onclick={handleDismiss}
				class="absolute right-3 top-3 rounded-full p-1 text-text-secondary-light transition-colors duration-200 hover:bg-background-secondary-light hover:text-text-primary-light focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
				aria-label="Close cookie consent dialog"
			>
				<svg
					class="h-5 w-5"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>

			<!-- Content -->
			<div class="p-6 pr-12">
				<!-- Title -->
				<h3
					id="cookie-consent-title"
					class="mb-3 text-lg font-semibold text-text-primary-light"
				>
					🍪 Cookie Notice
				</h3>

				<!-- Description -->
				<p
					id="cookie-consent-description"
					class="mb-4 text-sm leading-relaxed text-text-secondary-light"
				>
					We use cookies to improve your experience on our site. By continuing to browse, you agree to our use of cookies. 
					<a
						href="/privacy"
						class="text-background-tertiary-light underline transition-colors duration-200 hover:text-text-primary-light focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-1"
						target="_blank"
						rel="noopener noreferrer"
					>
						Read our privacy policy
					</a>
					for more information.
				</p>

				<!-- Action buttons -->
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
					<!-- Accept button -->
					<button
						onclick={handleAccept}
						class="rounded-md bg-background-tertiary-light px-6 py-2.5 font-medium text-white transition-all duration-200 hover:bg-opacity-90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 active:scale-[0.98]"
						aria-describedby="cookie-consent-description"
					>
						Accept Cookies
					</button>

					<!-- Secondary dismiss button for mobile -->
					<button
						onclick={handleDismiss}
						class="rounded-md border border-background-tertiary-light px-6 py-2.5 font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 active:scale-[0.98] sm:hidden"
						aria-label="Dismiss cookie consent dialog"
					>
						Not Now
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure smooth animations and proper stacking */
	.fixed {
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}
	
	/* Focus styles for better accessibility */
	button:focus-visible {
		outline: 2px solid #F9A57B;
		outline-offset: 2px;
	}
	
	/* Smooth transitions for all interactive elements */
	button {
		transition: all 0.2s ease-out;
	}
</style>