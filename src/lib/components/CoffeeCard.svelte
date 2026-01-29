<script lang="ts">
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';

	let { coffee, parseTastingNotes } = $props<{
		coffee: CoffeeCatalog;
		parseTastingNotes: (tastingNotesJson: string | null | object) => TastingNotes | null;
	}>();

	// Lazy load the tasting notes radar component
	let TastingNotesRadar = $state<any>(null);
	let radarComponentLoading = $state(true);

	// Load radar component after initial render
	$effect(() => {
		setTimeout(async () => {
			try {
				const module = await import('$lib/components/TastingNotesRadar.svelte');
				TastingNotesRadar = module.default;
				radarComponentLoading = false;
			} catch (error) {
				console.error('Failed to load radar component:', error);
				radarComponentLoading = false;
			}
		}, 250); // Further delayed for catalog cards
	});

	// Parse tasting notes for this coffee
	let tastingNotes = $derived(parseTastingNotes(coffee.ai_tasting_notes));

	// Debug logging (preserved from original)
	$effect(() => {
		if (coffee.ai_tasting_notes && !tastingNotes) {
			console.log(
				'Debug - Raw ai_tasting_notes:',
				coffee.ai_tasting_notes,
				'Type:',
				typeof coffee.ai_tasting_notes
			);
		}
	});
</script>

<button
	type="button"
	class="group rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
	onclick={() => {
		if (coffee.link) window.open(coffee.link, '_blank');
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter' && coffee.link) window.open(coffee.link, '_blank');
	}}
>
	<!-- Mobile-optimized layout -->
	<div class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
		<!-- Content section -->
		<div class="flex-1">
			<h3 class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light">
				{coffee.name}
			</h3>
			<div class="mt-1 flex items-center justify-between">
				<p class="text-sm font-medium text-background-tertiary-light">
					{coffee.source}
				</p>
				<!-- Mobile: Price and score next to supplier name -->
				<div class="text-right sm:hidden">
					<div class="font-bold text-background-tertiary-light">
						${coffee.cost_lb}/lb
					</div>
					<!-- {#if coffee.score_value}
						<div class="text-xs text-text-secondary-light">
							Score: {Math.round(coffee.score_value)}
						</div>
					{/if} -->
				</div>
			</div>
			{#if coffee.ai_description}
				<p class="my-4 whitespace-pre-wrap text-xs text-text-secondary-light">
					{coffee.ai_description}
				</p>
			{/if}

			<!-- Mobile: Chart full width -->
			{#if tastingNotes}
				<div class="mt-2 px-6 sm:hidden">
					{#if radarComponentLoading}
						<ChartSkeleton height="300px" title="Loading tasting profile..." />
					{:else if TastingNotesRadar}
						<TastingNotesRadar {tastingNotes} size={300} responsive={true} lazy={true} />
					{/if}
				</div>
			{/if}

			<div class="mt-3 flex-col gap-2 text-xs text-text-secondary-light sm:grid-cols-2">
				<div>
					<span class="font-medium">Location:</span>
					{[coffee.continent, coffee.country, coffee.region].filter(Boolean).join(' > ') || '-'}
				</div>
				<div>
					{#if coffee.processing}
						<span>Processing: {coffee.processing}</span>
					{/if}
				</div>
				<div>
					{#if coffee.cultivar_detail}
						<span>Cultivar: {coffee.cultivar_detail}</span>
					{/if}
				</div>
				<div>
					{#if coffee.grade}
						<span>Elevation: {coffee.grade}</span>
					{/if}
				</div>
				<div>
					{#if coffee.appearance}
						<span>Appearance: {coffee.appearance}</span>
					{/if}
				</div>
				<div>
					{#if coffee.type}
						<span>Importer: {coffee.type}</span>
					{/if}
				</div>
				<div>
					{#if coffee.arrival_date}
						<span>Arrival: {coffee.arrival_date}</span>
					{/if}
				</div>
				<div>
					{#if coffee.stocked_date}
						<span>Stocked: {coffee.stocked_date}</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Desktop: Price, score, and chart in sidebar -->
		<div class="hidden flex-col items-end space-y-2 sm:flex">
			<div class="text-right">
				<div class="font-bold text-background-tertiary-light">
					${coffee.cost_lb}/lb
				</div>
				<!-- {#if coffee.score_value}
					<div class="mt-1 text-xs text-text-secondary-light">
						Score: {Math.round(coffee.score_value)}
					</div>
				{/if} -->
			</div>
			{#if tastingNotes}
				<div class="pt-4">
					{#if radarComponentLoading}
						<ChartSkeleton height="180px" title="Loading tasting profile..." />
					{:else if TastingNotesRadar}
						<TastingNotesRadar {tastingNotes} size={180} lazy={true} />
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="mt-3 flex items-center justify-end">
		<svg
			class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
			/>
		</svg>
	</div>
</button>
