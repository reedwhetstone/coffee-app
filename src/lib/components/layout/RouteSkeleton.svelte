<script lang="ts">
	import BeansPageSkeleton from '$lib/components/BeansPageSkeleton.svelte';
	import CatalogPageSkeleton from '$lib/components/CatalogPageSkeleton.svelte';
	import ProfitPageSkeleton from '$lib/components/ProfitPageSkeleton.svelte';
	import RoastPageSkeleton from '$lib/components/RoastPageSkeleton.svelte';
	import AnalyticsRouteSkeleton from '$lib/components/analytics/AnalyticsRouteSkeleton.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { getRouteSkeletonKind } from './routeSkeletons';

	let {
		pathname = '/',
		isParchmentIntelligence = false,
		authenticated = false,
		role = 'viewer'
	}: {
		pathname?: string | null;
		isParchmentIntelligence?: boolean;
		authenticated?: boolean;
		role?: 'viewer' | 'member' | 'admin';
	} = $props();

	let kind = $derived(
		getRouteSkeletonKind(pathname, {
			authenticated,
			role,
			ppiAccess: isParchmentIntelligence
		})
	);

	const chatMessageRows = [0, 1, 2];
	const subscriptionCards = [0, 1, 2, 3];
</script>

<div aria-busy="true" aria-label="Loading page" data-testid="route-skeleton">
	{#if kind === 'catalog'}
		<CatalogPageSkeleton />
	{:else if kind === 'beans'}
		<BeansPageSkeleton />
	{:else if kind === 'profit'}
		<ProfitPageSkeleton />
	{:else if kind === 'roast'}
		<RoastPageSkeleton />
	{:else if kind === 'analytics'}
		<AnalyticsRouteSkeleton mode="route" {isParchmentIntelligence} />
	{:else if kind === 'access-gate'}
		<div
			class="mx-auto flex min-h-[28rem] max-w-xl items-center justify-center px-4 motion-safe:animate-pulse"
			data-testid="access-gate-skeleton"
		>
			<div class="w-full rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
				<Skeleton class="mx-auto mb-6 h-14 w-14 opacity-35" rounded="rounded-full" />
				<Skeleton class="mx-auto mb-3 h-8 w-72 max-w-full opacity-50" />
				<Skeleton class="mx-auto mb-2 h-4 w-96 max-w-full opacity-25" />
				<Skeleton class="mx-auto mb-6 h-4 w-64 max-w-full opacity-25" />
				<Skeleton class="mx-auto h-10 w-36 opacity-35" rounded="rounded-md" />
			</div>
		</div>
	{:else if kind === 'chat'}
		<div
			class="grid min-h-[min(720px,calc(100vh-10rem))] gap-4 motion-safe:animate-pulse lg:grid-cols-[280px_minmax(0,1fr)]"
		>
			<aside class="hidden rounded-lg bg-surface-panel p-4 ring-1 ring-line lg:block">
				<Skeleton class="mb-4 h-7 w-40 opacity-50" />
				<div class="space-y-3">
					<Skeleton class="h-10 w-full opacity-25" rounded="rounded-md" />
					<Skeleton class="h-10 w-11/12 opacity-25" rounded="rounded-md" />
					<Skeleton class="h-10 w-4/5 opacity-25" rounded="rounded-md" />
				</div>
				<div class="mt-8 space-y-3">
					<Skeleton class="h-4 w-24 opacity-30" />
					<Skeleton class="h-16 w-full opacity-20" rounded="rounded-md" />
					<Skeleton class="h-16 w-full opacity-20" rounded="rounded-md" />
				</div>
			</aside>
			<section class="flex min-h-0 flex-col rounded-lg bg-surface-panel ring-1 ring-line">
				<div class="border-b border-line p-4">
					<Skeleton class="mb-2 h-6 w-56 max-w-full opacity-50" />
					<Skeleton class="h-4 w-80 max-w-full opacity-30" />
				</div>
				<div class="flex-1 space-y-5 p-4">
					{#each chatMessageRows as row (row)}
						<div class="max-w-3xl rounded-lg bg-surface-canvas p-4">
							<Skeleton class="mb-3 h-4 w-28 opacity-30" />
							<Skeleton class="mb-2 h-4 w-full opacity-25" />
							<Skeleton class="h-4 w-2/3 opacity-25" />
						</div>
					{/each}
				</div>
				<div class="border-t border-line p-4">
					<Skeleton class="h-12 w-full opacity-25" rounded="rounded-md" />
				</div>
			</section>
		</div>
	{:else if kind === 'dashboard'}
		<div class="space-y-6 motion-safe:animate-pulse">
			<div>
				<Skeleton class="mb-3 h-8 w-64 max-w-full opacity-50" />
				<Skeleton class="h-4 w-96 max-w-full opacity-30" />
			</div>
			<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				{#each Array.from({ length: 4 }) as _, index (index)}
					<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
						<Skeleton class="mb-2 h-4 w-24 opacity-30" />
						<Skeleton class="mb-1 h-8 w-20 opacity-50" />
						<Skeleton class="h-3 w-32 opacity-25" />
					</div>
				{/each}
			</div>
			<div class="grid gap-4 lg:grid-cols-2">
				<Skeleton class="h-72 w-full opacity-20" rounded="rounded-lg" />
				<Skeleton class="h-72 w-full opacity-20" rounded="rounded-lg" />
			</div>
		</div>
	{:else if kind === 'subscription'}
		<div class="space-y-8 motion-safe:animate-pulse">
			<div class="mx-auto max-w-4xl text-center">
				<Skeleton class="mx-auto mb-3 h-4 w-32 opacity-30" />
				<Skeleton class="mx-auto mb-3 h-10 w-[32rem] max-w-full opacity-50" />
				<Skeleton class="mx-auto h-4 w-[42rem] max-w-full opacity-25" />
			</div>
			<div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
				{#each subscriptionCards as card (card)}
					<div class="rounded-lg bg-surface-panel p-5 ring-1 ring-line">
						<Skeleton class="mb-3 h-4 w-24 opacity-30" />
						<Skeleton class="mb-3 h-7 w-40 max-w-full opacity-50" />
						<div class="mb-5 space-y-2">
							<Skeleton class="h-3 w-full opacity-25" />
							<Skeleton class="h-3 w-5/6 opacity-25" />
						</div>
						<Skeleton class="mb-4 h-9 w-28 opacity-45" />
						<div class="space-y-2">
							<Skeleton class="h-3 w-full opacity-20" />
							<Skeleton class="h-3 w-11/12 opacity-20" />
							<Skeleton class="h-3 w-3/4 opacity-20" />
						</div>
						<Skeleton class="mt-6 h-10 w-full opacity-25" rounded="rounded-md" />
					</div>
				{/each}
			</div>
		</div>
	{:else if kind === 'subscription-success'}
		<div
			class="mx-auto flex min-h-[28rem] max-w-xl items-center justify-center px-4 motion-safe:animate-pulse"
			data-testid="subscription-verification-skeleton"
		>
			<div class="w-full rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
				<Skeleton class="mx-auto mb-6 h-14 w-14 opacity-35" rounded="rounded-full" />
				<Skeleton class="mx-auto mb-3 h-8 w-72 max-w-full opacity-50" />
				<Skeleton class="mx-auto mb-2 h-4 w-96 max-w-full opacity-25" />
				<Skeleton class="mx-auto h-4 w-64 max-w-full opacity-25" />
			</div>
		</div>
	{:else}
		<div class="space-y-6 motion-safe:animate-pulse">
			<div>
				<Skeleton class="mb-3 h-8 w-64 max-w-full opacity-50" />
				<Skeleton class="h-4 w-96 max-w-full opacity-30" />
			</div>
			<div class="space-y-4">
				{#each Array.from({ length: 3 }) as _, index (index)}
					<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
						<Skeleton class="mb-3 h-6 w-1/3 opacity-50" />
						<div class="space-y-2">
							<Skeleton class="h-4 w-full opacity-25" />
							<Skeleton class="h-4 w-3/4 opacity-25" />
							<Skeleton class="h-4 w-1/2 opacity-25" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
