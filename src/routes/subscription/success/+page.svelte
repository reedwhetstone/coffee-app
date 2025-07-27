<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props<{ data: PageData }>();
	let loading = $state(true);
	let error = $state<string | null>(null);
	let sessionStatus = $state<'complete' | 'open' | 'expired' | null>(null);
	let roleVerificationComplete = $state(false);
	let roleVerificationMessage = $state<string>('');

	onMount(async () => {
		try {
			if (!data?.user) {
				goto('/');
				return;
			}

			// Get session ID from URL
			const url = new URL(window.location.href);
			const sessionId = url.searchParams.get('session_id');

			if (!sessionId) {
				error = 'No session ID found';
				loading = false;
				return;
			}

			// Check session status
			const response = await fetch(`/api/stripe/check-session?session_id=${sessionId}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to verify payment status');
			}

			const { status } = await response.json();
			sessionStatus = status;

			// If payment is successful, verify and update role as backup to webhooks
			if (status === 'complete') {
				try {
					// Call backup role verification API
					const roleResponse = await fetch('/api/stripe/verify-and-update-role', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ sessionId })
					});

					if (roleResponse.ok) {
						const roleResult = await roleResponse.json();
						roleVerificationComplete = true;

						if (roleResult.roleUpdated) {
							roleVerificationMessage = 'Your account has been upgraded to premium!';
						} else if (roleResult.alreadyProcessed) {
							roleVerificationMessage = 'Your account is already up to date.';
						} else {
							roleVerificationMessage = roleResult.message || 'Payment verified successfully.';
						}

						console.log('✅ Role verification completed:', roleResult);
					} else {
						// Role verification failed, but don't block the user - webhooks may still work
						console.warn(
							'⚠️ Role verification failed, relying on webhooks:',
							await roleResponse.text()
						);
						roleVerificationMessage = 'Payment confirmed. Your account upgrade is being processed.';
					}
				} catch (roleError) {
					console.warn('⚠️ Role verification error, relying on webhooks:', roleError);
					roleVerificationMessage = 'Payment confirmed. Your account upgrade is being processed.';
				}

				// Invalidate all data to refresh auth state regardless of role verification outcome
				await invalidateAll();
			}
		} catch (err: any) {
			error = err.message || 'Something went wrong';
			console.error('Error verifying payment:', err);
		} finally {
			loading = false;
		}
	});

	// Function to handle return to homepage with data refresh
	const returnToHomepage = async () => {
		// Invalidate all data to ensure fresh data on the next page
		await invalidateAll();
		goto('/');
	};
</script>

<div class="flex min-h-[calc(100vh-80px)] flex-col items-center justify-center py-10">
	<div
		class="max-w-md rounded-2xl border border-background-tertiary-light bg-background-secondary-light p-8 shadow-md"
	>
		{#if loading}
			<div class="flex flex-col items-center justify-center py-10">
				<div
					class="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"
				></div>
				<p class="text-primary-light mt-4">Verifying your payment...</p>
			</div>
		{:else if error}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-red-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h2 class="text-primary-light mt-4 text-xl font-bold">Something went wrong</h2>
				<p class="text-primary-light mt-2">{error}</p>
				<button
					onclick={() => goto('/subscription')}
					class="mt-6 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
				>
					Try Again
				</button>
			</div>
		{:else if sessionStatus === 'complete'}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-green-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
				<h2 class="text-primary-light mt-4 text-xl font-bold">Payment Successful!</h2>
				<p class="text-primary-light mt-2">
					Thank you for your subscription! {roleVerificationMessage ||
						'Your account upgrade is being processed.'}
				</p>
				{#if roleVerificationComplete}
					<p class="mt-1 text-sm text-green-600">✅ Account verification completed</p>
				{:else}
					<p class="mt-1 text-sm text-blue-600">⏳ Account upgrade in progress...</p>
				{/if}
				<button
					onclick={returnToHomepage}
					class="mt-6 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
				>
					Return to Homepage
				</button>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center text-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-16 w-16 text-yellow-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<h2 class="text-primary-light mt-4 text-xl font-bold">Payment Pending</h2>
				<p class="text-primary-light mt-2">
					Your payment is being processed. We'll update your account status shortly.
				</p>
				<button
					onclick={returnToHomepage}
					class="mt-6 rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
				>
					Return to Homepage
				</button>
			</div>
		{/if}
	</div>
</div>
