<script lang="ts">
	import { onMount } from 'svelte';
	import CoffeeCard from './CoffeeCard.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';

	let {
		isOpen = false,
		coffeeIds = [],
		focusId,
		onClose,
		parseTastingNotes
	} = $props<{
		isOpen: boolean;
		coffeeIds: number[];
		focusId?: number;
		onClose: () => void;
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
	}>();

	// Coffee data state
	let coffeeData = $state<CoffeeCatalog[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// References for scrolling - DOM element references with $state() to avoid warnings
	let contentContainer = $state<HTMLDivElement>();
	let mobileContentContainer = $state<HTMLDivElement>();

	// Fetch coffee data when sidebar opens
	$effect(() => {
		if (isOpen && coffeeIds.length > 0) {
			loadCoffeeData();
		}
	});

	async function loadCoffeeData() {
		if (coffeeIds.length === 0) return;

		loading = true;
		error = null;

		try {
			// Create query params for the coffee IDs
			const params = new URLSearchParams();
			coffeeIds.forEach((id: number) => params.append('ids', id.toString()));

			const response = await fetch(`/api/catalog?${params.toString()}`);
			if (!response.ok) {
				throw new Error('Failed to fetch coffee data');
			}

			const data = await response.json();
			coffeeData = Array.isArray(data) ? data : [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error occurred';
			coffeeData = [];
		} finally {
			loading = false;
		}
	}

	// Scroll to focused coffee when data loads
	$effect(() => {
		if (coffeeData.length > 0 && focusId && isOpen) {
			// Small delay to ensure DOM is updated
			setTimeout(() => {
				scrollToFocusedCoffee();
			}, 100);
		}
	});

	function scrollToFocusedCoffee() {
		if (!focusId) return;

		const targetElement = document.getElementById(`coffee-${focusId}`);
		if (targetElement) {
			// Try desktop container first, then mobile
			const container = contentContainer || mobileContentContainer;
			if (container) {
				const containerRect = container.getBoundingClientRect();
				const targetRect = targetElement.getBoundingClientRect();
				const scrollTop = targetRect.top - containerRect.top + container.scrollTop - 20; // 20px offset

				container.scrollTo({
					top: scrollTop,
					behavior: 'smooth'
				});
			}
		}
	}

	// Handle escape key
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	// Set up keyboard listener
	onMount(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleKeydown);
		}
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	// Update keyboard listener when isOpen changes
	$effect(() => {
		if (isOpen) {
			document.addEventListener('keydown', handleKeydown);
		} else {
			document.removeEventListener('keydown', handleKeydown);
		}
		return () => {
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<!-- Desktop Sidebar -->
<div
	class="fixed right-0 top-0 z-[55] h-full w-[32rem] transform bg-background-primary-light shadow-2xl transition-transform duration-300 ease-out {isOpen
		? 'translate-x-0'
		: 'translate-x-full'} hidden md:block"
>
	<!-- Sidebar Header -->
	<div class="border-b border-border-light bg-background-secondary-light px-6 py-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-text-primary-light">Coffee Details</h2>
				<p class="text-sm text-text-secondary-light">
					{coffeeIds.length} coffee{coffeeIds.length !== 1 ? 's' : ''} selected
				</p>
			</div>
			<button
				onclick={onClose}
				class="rounded-md border border-border-light bg-background-secondary-light p-2 text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
				aria-label="Close coffee preview"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Sidebar Content -->
	<div bind:this={contentContainer} class="h-[calc(100%-80px)] overflow-y-auto p-6">
		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="flex items-center space-x-3">
					<div
						class="h-6 w-6 animate-spin rounded-full border-2 border-background-tertiary-light border-t-transparent"
					></div>
					<span class="text-text-secondary-light">Loading coffee details...</span>
				</div>
			</div>
		{:else if error}
			<div class="rounded-lg bg-red-50 p-4 text-center">
				<p class="text-red-600">Error: {error}</p>
				<button
					onclick={loadCoffeeData}
					class="mt-2 rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
				>
					Retry
				</button>
			</div>
		{:else if coffeeData.length === 0}
			<div class="rounded-lg bg-background-secondary-light p-6 text-center">
				<p class="text-text-secondary-light">No coffee data available</p>
			</div>
		{:else}
			<!-- Coffee Grid - matches /catalog page layout -->
			<div class="space-y-4">
				{#each coffeeData as coffee}
					<div id="coffee-{coffee.id}">
						<CoffeeCard {coffee} {parseTastingNotes} />
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Mobile Overlay -->
{#if isOpen}
	<div
		class="fixed inset-0 z-[60] bg-black bg-opacity-50 md:hidden"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-label="Coffee details modal"
		tabindex="-1"
	>
		<!-- Mobile Modal Content -->
		<div class="fixed inset-x-0 bottom-0 top-0 bg-background-primary-light">
			<!-- Mobile Header -->
			<div class="border-b border-border-light bg-background-secondary-light px-4 py-3">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-text-primary-light">Coffee Details</h2>
						<p class="text-sm text-text-secondary-light">
							{coffeeIds.length} coffee{coffeeIds.length !== 1 ? 's' : ''} selected
						</p>
					</div>
					<button
						onclick={onClose}
						class="rounded-md border border-border-light bg-background-secondary-light p-2 text-text-secondary-light transition-all hover:bg-background-tertiary-light hover:text-white"
						aria-label="Close coffee preview"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Mobile Content -->
			<div bind:this={mobileContentContainer} class="h-[calc(100%-64px)] overflow-y-auto p-4">
				{#if loading}
					<div class="flex items-center justify-center py-12">
						<div class="flex items-center space-x-3">
							<div
								class="h-6 w-6 animate-spin rounded-full border-2 border-background-tertiary-light border-t-transparent"
							></div>
							<span class="text-text-secondary-light">Loading coffee details...</span>
						</div>
					</div>
				{:else if error}
					<div class="rounded-lg bg-red-50 p-4 text-center">
						<p class="text-red-600">Error: {error}</p>
						<button
							onclick={loadCoffeeData}
							class="mt-2 rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
						>
							Retry
						</button>
					</div>
				{:else if coffeeData.length === 0}
					<div class="rounded-lg bg-background-secondary-light p-4 text-center">
						<p class="text-text-secondary-light">No coffee data available</p>
					</div>
				{:else}
					<!-- Mobile Coffee Grid -->
					<div class="space-y-4">
						{#each coffeeData as coffee}
							<div id="coffee-{coffee.id}">
								<CoffeeCard {coffee} {parseTastingNotes} />
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
