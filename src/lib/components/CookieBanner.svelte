<script lang="ts">
	import { cookieConsent } from '$lib/stores/cookieConsent';
	import { onMount } from 'svelte';

	let showBanner = $state(false);

	onMount(() => {
		// Check if we need to show the banner
		const unsubscribe = cookieConsent.subscribe((state) => {
			showBanner = cookieConsent.needsConsent(state);
		});

		return unsubscribe;
	});

	function handleAccept() {
		cookieConsent.accept();
		showBanner = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleAccept();
		}
	}
</script>

{#if showBanner}
	<div
		class="fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-out"
		role="dialog"
		aria-labelledby="cookie-banner-title"
		aria-describedby="cookie-banner-description"
	>
		<div class="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
			<div
				class="rounded-lg bg-background-secondary-light p-4 shadow-lg ring-1 ring-border-light sm:p-6"
			>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex-1">
						<h3
							id="cookie-banner-title"
							class="text-sm font-semibold text-text-primary-light sm:text-base"
						>
							This app uses cookies
						</h3>
						<p
							id="cookie-banner-description"
							class="mt-1 text-xs text-text-secondary-light sm:text-sm"
						>
							We use essential cookies for authentication and core functionality. No tracking or
							analytics data is collected.
							<a
								href="/contact"
								class="font-medium text-background-tertiary-light hover:underline"
							>
								Learn more
							</a>
						</p>
					</div>
					<div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
						<button
							type="button"
							onclick={handleAccept}
							onkeydown={handleKeydown}
							class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 focus:ring-offset-background-secondary-light sm:px-6 sm:py-2"
						>
							Accept cookies
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure the banner slides up from bottom */
	.fixed.bottom-0 {
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>