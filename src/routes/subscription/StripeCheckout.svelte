<!-- src/lib/components/StripeCheckout.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	const {
		priceId,
		clientReferenceId,
		customerEmail,
		onSuccess = () => {}
	} = $props<{
		priceId: string;
		clientReferenceId: string;
		customerEmail: string;
		onSuccess?: () => void;
		onCancel?: () => void;
	}>();

	let checkoutElement = $state<HTMLElement | null>(null);
	let stripe: any;
	let checkout: any;
	let loading = $state(true);
	let error = $state<string | null>(null);

	const initializeCheckout = async () => {
		try {
			// Clean up any existing checkout instance first
			if (checkout) {
				checkout.destroy();
				checkout = null;
			}

			loading = true;
			error = null;

			// Wait for the checkout element to be available
			if (!checkoutElement) {
				// Adding a small delay to allow the element to be rendered
				await new Promise((resolve) => setTimeout(resolve, 100));
				if (!checkoutElement) {
					throw new Error('Checkout element not available in DOM');
				}
			}

			// Create checkout session
			const response = await fetch('/api/stripe/create-checkout-session', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					priceId,
					clientReferenceId,
					customerEmail
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to create checkout session');
			}

			const { clientSecret } = await response.json();

			// Initialize Stripe Elements
			if (!stripe) {
				// @ts-ignore - Stripe will be loaded from external script
				stripe = Stripe(
					'pk_test_51R3ltgKwI9NkGqAnh6PER9cKR2gXZuBKEIb8oIQpSbOQ6qo13ivw2694cCoGWNvqUu2hG5z91rLBsupkwz92kAfY00arRRkkIc'
				);
			}

			// Mount checkout form
			checkout = await stripe.initEmbeddedCheckout({
				clientSecret,
				onComplete: () => {
					// Handle successful payment
					onSuccess();
				}
			});

			// Only mount if element exists
			if (checkoutElement) {
				checkout.mount(checkoutElement);
			} else {
				throw new Error('Checkout element not found in the DOM');
			}

			if (checkout.error) {
				throw new Error(checkout.error.message);
			}
		} catch (err: any) {
			error = err.message || 'Something went wrong';
			console.error('Checkout error:', err);
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		// Load Stripe.js
		const script = document.createElement('script');
		script.src = 'https://js.stripe.com/v3/';
		script.onload = initializeCheckout;
		document.body.appendChild(script);

		return () => {
			document.body.removeChild(script);
		};
	});

	onDestroy(() => {
		// Clean up checkout if component is unmounted
		if (checkout) {
			checkout.destroy();
		}
	});
</script>

<div class="stripe-checkout-container">
	<!-- Always create the checkout element but hide it when not needed -->
	<div
		bind:this={checkoutElement}
		id="checkout-element"
		class={error || loading ? 'hidden' : ''}
	></div>

	{#if error}
		<div class="error-message">
			<p>{error}</p>
			<button onclick={initializeCheckout} class="retry-button"> Try again </button>
		</div>
	{:else if loading}
		<div class="loading-spinner">
			<div class="spinner"></div>
			<p>Loading payment form...</p>
		</div>
	{/if}
</div>

<style>
	.stripe-checkout-container {
		width: 100%;
		min-height: 500px;
		position: relative;
	}

	#checkout-element {
		width: 100%;
		min-height: 500px;
	}

	.hidden {
		display: none;
	}

	.error-message {
		padding: 20px;
		border-radius: 8px;
		background-color: rgba(255, 0, 0, 0.1);
		color: #d00;
		text-align: center;
	}

	.retry-button {
		margin-top: 10px;
		padding: 8px 16px;
		background-color: #1a73e8;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.loading-spinner {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 300px;
	}

	.spinner {
		border: 4px solid rgba(0, 0, 0, 0.1);
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border-left-color: #1a73e8;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
