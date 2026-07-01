<script lang="ts">
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import CuppingNotesForm from '../CuppingNotesForm.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { InventoryWithCatalog } from '$lib/types/component.types';

	const tastingNoteFields = ['body', 'flavor', 'acidity', 'sweetness', 'fragrance_aroma'] as const;

	let { selectedBean, aiTastingNotes, userTastingNotes, canManagePortfolio, onSave } = $props<{
		selectedBean: InventoryWithCatalog;
		aiTastingNotes: TastingNotes | null;
		userTastingNotes: TastingNotes | null;
		canManagePortfolio: boolean;
		onSave: (notes: TastingNotes, rating: number | null) => Promise<boolean>;
	}>();

	let showCuppingForm = $state(false);
</script>

<div class="space-y-6">
	{#if showCuppingForm}
		<CuppingNotesForm
			initialNotes={userTastingNotes}
			initialRating={selectedBean.rank}
			{aiTastingNotes}
			onSave={async (notes, rating) => {
				const saved = await onSave(notes, rating);
				if (saved) {
					showCuppingForm = false;
				}
			}}
			onCancel={() => (showCuppingForm = false)}
		/>
	{:else}
		<!-- Cupping Overview -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Radar Chart Section -->
			<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="font-semibold text-text-primary-light">Tasting Profile</h3>
					{#if canManagePortfolio}
						<button
							onclick={() => (showCuppingForm = true)}
							class="rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
						>
							{userTastingNotes ? 'Edit' : 'Add'} Cupping Notes
						</button>
					{/if}
				</div>

				<div class="flex justify-center">
					{#if aiTastingNotes || userTastingNotes}
						<TastingNotesRadar
							tastingNotes={aiTastingNotes}
							{userTastingNotes}
							showOverlay={!!(aiTastingNotes && userTastingNotes)}
							size={300}
							responsive={false}
						/>
					{:else}
						<div
							class="flex h-[300px] w-[300px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
						>
							<span class="text-sm text-gray-400">No tasting data available</span>
						</div>
					{/if}
				</div>

				{#if aiTastingNotes && userTastingNotes}
					<p class="mt-2 text-center text-xs text-text-secondary-light">
						Solid circles: AI assessment • Dashed circles: Your assessment
					</p>
				{/if}
			</div>

			<!-- Rating & Notes Section -->
			<div class="space-y-4">
				<!-- User Rating -->
				<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
					<h4 class="mb-2 font-medium text-text-primary-light">Your Rating</h4>
					{#if selectedBean.rank != null && typeof selectedBean.rank === 'number'}
						<div class="flex items-center gap-3">
							<span class="text-2xl font-bold text-background-tertiary-light">
								{selectedBean.rank % 1 === 0 ? selectedBean.rank : selectedBean.rank.toFixed(1)}
							</span>
							<span class="text-text-secondary-light">/10</span>
						</div>
					{:else}
						<p class="text-sm text-text-secondary-light">No rating yet</p>
					{/if}
				</div>

				<!-- Cupping Notes Summary -->
				{#if userTastingNotes}
					{@const notes = userTastingNotes}
					<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
						<h4 class="mb-3 font-medium text-text-primary-light">Your Cupping Notes</h4>
						<div class="space-y-2">
							{#each tastingNoteFields as key}
								{@const note = notes[key]}
								<div class="flex items-center justify-between">
									<span class="text-sm capitalize text-text-secondary-light">
										{key.replace('_', ' ')}:
									</span>
									<div class="flex items-center gap-2">
										<div class="h-3 w-3 rounded-full" style="background-color: {note.color}"></div>
										<span class="text-sm font-medium text-text-primary-light">
											{note.tag}
										</span>
										<span class="text-xs text-text-secondary-light">
											({note.score}/5)
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
						<h4 class="mb-2 font-medium text-text-primary-light">Your Cupping Notes</h4>
						<p class="text-sm text-text-secondary-light">No cupping notes yet</p>
						{#if canManagePortfolio}
							<button
								onclick={() => (showCuppingForm = true)}
								class="mt-2 rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
							>
								Add Cupping Assessment
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
