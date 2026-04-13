<script lang="ts">
	import { goto } from '$app/navigation';

	interface SessionData {
		user?: {
			email?: string;
		};
	}

	let { session = null } = $props<{
		session?: SessionData | null;
	}>();

	let isSignedIn = $derived(Boolean(session?.user));

	function handlePrimaryAction() {
		goto('/catalog');
	}

	function handleSecondaryAction() {
		goto(isSignedIn ? '/dashboard' : '/subscription');
	}
</script>

<div class="bg-background-tertiary-light">
	<div class="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
				Start with the buyer path, then choose the product that fits
			</h2>
			<p class="mx-auto mt-6 max-w-xl text-lg leading-8 text-orange-100">
				{#if isSignedIn}
					Keep sourcing from the live catalog, or jump back into your dashboard for the rest of your
					workflow.
				{:else}
					Browse live green coffees first. When you want more, choose Mallard Studio for workflow,
					Parchment API for data access, or Parchment Intelligence for deeper market visibility.
				{/if}
			</p>
			<div class="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-x-6">
				<button
					onclick={handlePrimaryAction}
					class="w-full rounded-md bg-white px-6 py-3 text-sm font-semibold text-background-tertiary-light shadow-sm transition-all duration-200 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
				>
					Browse coffee catalog
				</button>
				<button
					onclick={handleSecondaryAction}
					class="w-full rounded-md border border-orange-100 px-6 py-3 text-sm font-semibold text-orange-100 transition-all duration-200 hover:bg-orange-100 hover:text-background-tertiary-light sm:w-auto"
				>
					{isSignedIn ? 'Open dashboard' : 'See products'}
				</button>
				<a
					href="/api"
					class="text-sm font-semibold leading-6 text-orange-100 transition-colors duration-200 hover:text-white"
				>
					API overview <span aria-hidden="true">→</span>
				</a>
			</div>
			<div
				class="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-orange-100"
			>
				<div class="flex items-center gap-x-2">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
							clip-rule="evenodd"
						/>
					</svg>
					Public catalog access
				</div>
				<div class="flex items-center gap-x-2">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
							clip-rule="evenodd"
						/>
					</svg>
					Buyer journey first
				</div>
				<div class="flex items-center gap-x-2">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
							clip-rule="evenodd"
						/>
					</svg>
					Clearer product paths
				</div>
			</div>
		</div>
	</div>
</div>
