<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';

	import CoffeeCard from '$lib/components/CoffeeCard.svelte';

	let { data } = $props<{ data: PageData }>();

	let canAccessMemberRoutes = $derived(checkRole(data.role ?? 'viewer', 'member'));
	let isAdmin = $derived(checkRole(data.role ?? 'viewer', 'admin'));
	let displayName = $derived(data.session?.user?.email?.split('@')[0] ?? 'there');

	interface QuickStartCard {
		href: string;
		icon: string;
		title: string;
		description: string;
		requiresMember?: boolean;
		requiresAdmin?: boolean;
	}

	const quickStartCards: QuickStartCard[] = [
		{
			href: '/catalog',
			icon: '☕',
			title: 'Catalog',
			description: 'Browse live green coffees, filters, and sourcing context.'
		},
		{
			href: '/analytics',
			icon: '📈',
			title: 'Market Data',
			description: 'Track supply index changes and public market movement.'
		},
		{
			href: '/api-dashboard',
			icon: '🔑',
			title: 'Parchment Console',
			description: 'Manage Parchment API keys, docs, and usage.'
		},
		{
			href: '/beans',
			icon: '🌱',
			title: 'Inventory',
			description: 'Track green coffee stock, purchases, and usage.',
			requiresMember: true
		},
		{
			href: '/roast',
			icon: '🔥',
			title: 'Roast',
			description: 'Log roast profiles and monitor development over time.',
			requiresMember: true
		},
		{
			href: '/profit',
			icon: '📊',
			title: 'Profit',
			description: 'Review margins, sales, and roastery profitability.',
			requiresMember: true
		},
		{
			href: '/chat',
			icon: '💬',
			title: 'Chat',
			description: 'Ask questions about coffees and your roasting data.',
			requiresMember: true
		},
		{
			href: '/admin',
			icon: '🛠️',
			title: 'Admin',
			description: 'Manage administrative workflows and internal tooling.',
			requiresAdmin: true
		}
	];

	const visibleCards = $derived.by(() =>
		quickStartCards.filter((card) => {
			if (card.requiresAdmin) {
				return isAdmin;
			}

			if (card.requiresMember) {
				return canAccessMemberRoutes;
			}

			return true;
		})
	);
</script>

<div class="mx-auto max-w-6xl space-y-8 px-4 py-4 sm:px-6 lg:px-8">
	<section
		class="rounded-2xl border border-border-light bg-background-secondary-light p-6 shadow-sm"
	>
		<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="text-sm font-medium uppercase tracking-[0.18em] text-background-tertiary-light">
					Dashboard
				</p>
				<h1 class="mt-2 text-3xl font-bold text-text-primary-light sm:text-4xl">
					Welcome back, {displayName}
				</h1>
				<p class="mt-3 max-w-3xl text-sm leading-relaxed text-text-secondary-light sm:text-base">
					This is your logged-in home for jumping into sourcing, roasting, and the rest of the app.
					The public story stays on /; the day-to-day work starts here.
				</p>
			</div>
			<div class="flex flex-col gap-3 sm:flex-row">
				<button
					onclick={() => goto('/catalog')}
					class="rounded-md border border-background-tertiary-light px-5 py-2.5 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					Browse Catalog
				</button>
				{#if canAccessMemberRoutes}
					<button
						onclick={() => goto('/beans')}
						class="rounded-md bg-background-tertiary-light px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
					>
						Open Inventory
					</button>
				{/if}
			</div>
		</div>
	</section>

	{#if !canAccessMemberRoutes}
		<section
			class="rounded-2xl border border-background-tertiary-light/20 bg-gradient-to-r from-background-tertiary-light/10 to-harvest-gold/10 p-6"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h2 class="text-xl font-semibold text-text-primary-light">
						Unlock Mallard Studio Member
					</h2>
					<p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary-light">
						Catalog, market data, and API access are ready now. Upgrade when you want inventory,
						roast tracking, profit workflows, chat, and the full Mallard Studio operating surface.
					</p>
				</div>
				<button
					onclick={() => goto('/subscription')}
					class="rounded-md bg-background-tertiary-light px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Unlock Mallard Studio
				</button>
			</div>
		</section>
	{/if}

	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-semibold text-text-primary-light sm:text-2xl">Quick start</h2>
			<button
				onclick={() => goto('/')}
				class="text-sm font-medium text-text-secondary-light transition-colors duration-200 hover:text-background-tertiary-light"
			>
				View public homepage
			</button>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{#each visibleCards as card}
				<button
					onclick={() => goto(card.href)}
					class="group rounded-xl border border-border-light bg-background-secondary-light p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-background-tertiary-light/40 hover:shadow-md"
				>
					<div class="mb-4 text-3xl">{card.icon}</div>
					<h3
						class="text-lg font-semibold text-text-primary-light transition-colors duration-200 group-hover:text-background-tertiary-light"
					>
						{card.title}
					</h3>
					<p class="mt-2 text-sm leading-relaxed text-text-secondary-light">
						{card.description}
					</p>
				</button>
			{/each}
		</div>
	</section>

	{#if data.recentArrivals?.length > 0}
		<section class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-xl font-semibold text-text-primary-light sm:text-2xl">Recent arrivals</h2>
					<p class="mt-1 text-sm text-text-secondary-light">
						A quick look at the latest coffees available in the marketplace.
					</p>
				</div>
				<button
					onclick={() => goto('/catalog')}
					class="text-sm font-medium text-background-tertiary-light transition-colors duration-200 hover:text-text-primary-light"
				>
					Browse full catalog
				</button>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
				{#each data.recentArrivals as coffee}
					<CoffeeCard {coffee} {parseTastingNotes} />
				{/each}
			</div>
		</section>
	{/if}
</div>
