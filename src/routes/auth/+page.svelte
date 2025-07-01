<script lang="ts">
	import type { PageData } from './$types';
	import { signInWithGoogle } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props<{ data: PageData }>();

	let loading = $state(false);
	let error = $state('');

	async function handleGoogleSignIn() {
		if (loading) return;

		loading = true;
		error = '';

		try {
			await signInWithGoogle(data.supabase);
			// The auth callback will handle the redirect
		} catch (err) {
			console.error('Sign in error:', err);
			error = 'Failed to sign in. Please try again.';
		} finally {
			loading = false;
		}
	}

	// If user is already authenticated, redirect them
	onMount(() => {
		if (data.session) {
			goto('/');
		}
	});
</script>

<svelte:head>
	<title>Sign In - Purveyors</title>
	<meta name="description" content="Sign in to access your coffee roasting platform" />
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-background-primary-light to-background-secondary-light px-4 sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<h2 class="mt-6 text-3xl font-bold text-text-primary-light">Welcome to Purveyors</h2>
			<p class="mt-2 text-sm text-text-secondary-light">
				Sign in to start your coffee roasting journey
			</p>
		</div>

		<div class="space-y-6 rounded-lg bg-background-secondary-light p-8 shadow-md">
			{#if error}
				<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
					<p class="text-sm text-red-400">{error}</p>
				</div>
			{/if}

			<button
				onclick={handleGoogleSignIn}
				disabled={loading}
				class="flex w-full items-center justify-center rounded-md border border-transparent bg-background-tertiary-light px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if loading}
					<div class="mr-3 h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
					Signing in...
				{:else}
					<svg class="mr-3 h-5 w-5" viewBox="0 0 24 24">
						<path
							fill="currentColor"
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
						/>
						<path
							fill="currentColor"
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						/>
						<path
							fill="currentColor"
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						/>
						<path
							fill="currentColor"
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						/>
					</svg>
					Continue with Google
				{/if}
			</button>

			<div class="text-center">
				<p class="text-xs text-text-secondary-light">
					By signing in, you agree to our terms of service and privacy policy
				</p>
			</div>
		</div>

		<div class="text-center">
			<button
				onclick={() => goto('/')}
				class="text-sm text-text-secondary-light transition-colors duration-200 hover:text-text-primary-light"
			>
				← Back to homepage
			</button>
		</div>
	</div>
</div>
