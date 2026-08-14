<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { BillingPurchaseKey } from '$lib/billing/purchaseKeys';
	import {
		clearCheckoutAttempt,
		getOrCreateCheckoutAttempt,
		isTerminalCheckoutFailure,
		isTerminalCheckoutStatus,
		parseCheckoutFailure,
		persistCheckoutAdmission
	} from '$lib/billing/checkoutRequest';

	const { purchaseKey, onSuccess = () => {} } = $props<{
		purchaseKey: BillingPurchaseKey;
		onSuccess?: () => void;
	}>();

	let checkoutElement = $state<HTMLElement | null>(null);
	// Stripe.js is loaded from the provider's public script and intentionally stays browser-only.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let stripe: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let checkout: any;
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function prepareCheckout() {
		let attempt = getOrCreateCheckoutAttempt(sessionStorage, purchaseKey, () =>
			crypto.randomUUID()
		);
		const response = attempt.admissionId
			? await fetch(`/api/billing/checkout-sessions/${encodeURIComponent(attempt.admissionId)}`, {
					method: 'POST'
				})
			: await fetch('/api/billing/checkout-sessions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						requestId: attempt.requestId,
						purchaseItems: [{ purchaseKey, quantity: 1 }]
					})
				});
		const body = await response.json().catch(() => null);

		if (!response.ok) {
			const failure = parseCheckoutFailure(body);
			if (isTerminalCheckoutFailure(failure.code)) clearCheckoutAttempt(sessionStorage);
			throw new Error(failure.message);
		}

		if (
			!body ||
			typeof body.admissionId !== 'string' ||
			typeof body.status !== 'string' ||
			(body.clientSecret !== null && typeof body.clientSecret !== 'string')
		) {
			throw new Error('Checkout returned an invalid response. Please try again.');
		}

		attempt = persistCheckoutAdmission(sessionStorage, attempt, body.admissionId);
		if (isTerminalCheckoutStatus(body.status)) {
			clearCheckoutAttempt(sessionStorage);
			throw new Error(
				body.status === 'settled'
					? 'This checkout is already complete.'
					: 'This checkout is closed. Start a new checkout to continue.'
			);
		}
		if (body.status !== 'published' || !body.clientSecret) {
			throw new Error('Checkout is still being prepared. Try again in a moment.');
		}

		return body.clientSecret as string;
	}

	const initializeCheckout = async () => {
		try {
			checkout?.destroy();
			checkout = null;
			loading = true;
			error = null;

			if (!checkoutElement) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				if (!checkoutElement) throw new Error('Checkout element is unavailable.');
			}

			const clientSecret = await prepareCheckout();
			if (!stripe) {
				// eslint-disable-next-line no-undef
				stripe = Stripe(
					'pk_live_51R3ltgKwI9NkGqAnzQHOmPvkVfxCdAFGf4fwDKw9tGMtv1AcEYLONo8It8dnPTBHoZHY6gmHj6zZhtbPRgrYOrII006S1GdaWO'
				);
			}

			checkout = await stripe.initEmbeddedCheckout({ clientSecret, onComplete: onSuccess });
			checkout.mount(checkoutElement);
			if (checkout.error) throw new Error(checkout.error.message);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Something went wrong';
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		const existing = document.querySelector<HTMLScriptElement>('script[data-purveyors-stripe-js]');
		if (existing) {
			if (typeof Stripe !== 'undefined') initializeCheckout();
			else existing.addEventListener('load', initializeCheckout, { once: true });
			return;
		}

		const script = document.createElement('script');
		script.src = 'https://js.stripe.com/v3/';
		script.dataset.purveyorsStripeJs = 'true';
		script.addEventListener('load', initializeCheckout, { once: true });
		document.body.appendChild(script);
	});

	onDestroy(() => checkout?.destroy());
</script>

<div class="stripe-checkout-container">
	<div bind:this={checkoutElement} id="checkout-element" class:hidden={error || loading}></div>

	{#if error}
		<div class="error-message">
			<p>{error}</p>
			<button onclick={initializeCheckout} class="retry-button">Try again</button>
		</div>
	{:else if loading}
		<div class="loading-spinner">
			<div class="spinner"></div>
			<p>Loading payment form...</p>
		</div>
	{/if}
</div>

<style>
	.stripe-checkout-container,
	#checkout-element {
		width: 100%;
		min-height: 500px;
	}
	.error-message,
	.loading-spinner {
		display: flex;
		min-height: 300px;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.error-message {
		border-radius: 8px;
		background: rgb(255 0 0 / 10%);
		color: #b91c1c;
	}
	.retry-button {
		margin-top: 10px;
		border-radius: 4px;
		background: #1a73e8;
		padding: 8px 16px;
		color: white;
	}
	.spinner {
		margin-bottom: 16px;
		height: 36px;
		width: 36px;
		animation: spin 1s linear infinite;
		border: 4px solid rgb(0 0 0 / 10%);
		border-left-color: #1a73e8;
		border-radius: 9999px;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
