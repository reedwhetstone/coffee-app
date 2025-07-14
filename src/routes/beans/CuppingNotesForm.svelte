<script lang="ts">
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let {
		initialNotes = null,
		initialRating = null,
		onSave,
		onCancel,
		aiTastingNotes = null
	} = $props<{
		initialNotes?: TastingNotes | null;
		initialRating?: number | null;
		onSave: (notes: TastingNotes, rating: number | null) => void;
		onCancel: () => void;
		aiTastingNotes?: TastingNotes | null;
	}>();

	let formData = $state<TastingNotes>({
		body: { tag: '', color: '#8B4513', score: 3 },
		flavor: { tag: '', color: '#D2691E', score: 3 },
		acidity: { tag: '', color: '#FFD700', score: 3 },
		sweetness: { tag: '', color: '#DEB887', score: 3 },
		fragrance_aroma: { tag: '', color: '#DDA0DD', score: 3 }
	});

	let overallRating = $state<number | null>(initialRating);

	// Initialize form data with existing notes if provided
	$effect(() => {
		if (initialNotes) {
			formData = JSON.parse(JSON.stringify(initialNotes));
		}
		if (initialRating !== null) {
			overallRating = initialRating;
		}
	});

	const dimensions = [
		{ key: 'body', label: 'Body', description: 'The weight and mouthfeel of the coffee' },
		{ key: 'flavor', label: 'Flavor', description: 'The taste characteristics and flavor notes' },
		{ key: 'acidity', label: 'Acidity', description: 'The brightness and liveliness' },
		{ key: 'sweetness', label: 'Sweetness', description: 'The natural sweetness perception' },
		{ key: 'fragrance_aroma', label: 'Aroma', description: 'The smell of the coffee' }
	] as const;

	function handleSave() {
		onSave(formData, overallRating);
	}

	function handleReset() {
		formData = {
			body: { tag: '', color: '#8B4513', score: 3 },
			flavor: { tag: '', color: '#D2691E', score: 3 },
			acidity: { tag: '', color: '#FFD700', score: 3 },
			sweetness: { tag: '', color: '#DEB887', score: 3 },
			fragrance_aroma: { tag: '', color: '#DDA0DD', score: 3 }
		};
		overallRating = null;
	}

	// Validation - check if form has meaningful data
	let isValidForm = $derived(() => {
		return dimensions.some((dim) => formData[dim.key].tag.trim() !== '');
	});
</script>

<div class="cupping-notes-form">
	<div class="mb-6">
		<h3 class="mb-2 text-lg font-semibold text-text-primary-light">Your Cupping Assessment</h3>
		<p class="text-sm text-text-secondary-light">
			Give an overall rating and rate each dimension from 1-5, add descriptive tags, and choose
			colors that represent your experience.
		</p>
	</div>

	<!-- Overall Rating Section -->
	<div class="mb-6 rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<h4 class="mb-1 font-medium text-text-primary-light">Overall Rating</h4>
				<p class="text-xs text-text-secondary-light">
					Your overall impression of this coffee (1-10)
				</p>
			</div>
			<div class="flex items-center gap-4">
				{#if overallRating !== null}
					<span class="text-2xl font-bold text-amber-500">{overallRating}</span>
					<span class="text-sm text-text-secondary-light">/10</span>
				{:else}
					<span class="text-sm text-text-secondary-light">No rating</span>
				{/if}
			</div>
		</div>
		<div class="mt-4">
			<input
				type="range"
				min="1"
				max="10"
				step="1"
				bind:value={overallRating}
				class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-background-primary-light"
			/>
			<div class="mt-1 flex justify-between text-xs text-text-secondary-light">
				<span>1</span>
				<span>2</span>
				<span>3</span>
				<span>4</span>
				<span>5</span>
				<span>6</span>
				<span>7</span>
				<span>8</span>
				<span>9</span>
				<span>10</span>
			</div>
		</div>
		<div class="mt-2 text-center">
			<button
				type="button"
				onclick={() => (overallRating = null)}
				class="text-xs text-text-secondary-light underline hover:text-text-primary-light"
			>
				Clear Rating
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Form Section -->
		<div class="space-y-4">
			{#each dimensions as dimension}
				<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
					<div class="mb-3 flex items-center justify-between">
						<div>
							<h4 class="font-medium text-text-primary-light">{dimension.label}</h4>
							<p class="text-xs text-text-secondary-light">{dimension.description}</p>
						</div>
						<div class="text-right">
							<span class="text-lg font-bold text-background-tertiary-light">
								{formData[dimension.key].score}
							</span>
							<span class="text-xs text-text-secondary-light">/5</span>
						</div>
					</div>

					<div class="space-y-3">
						<!-- Score Slider -->
						<div>
							<label
								for="{dimension.key}-score"
								class="mb-1 block text-xs font-medium text-text-secondary-light"
							>
								Score (1-5)
							</label>
							<input
								id="{dimension.key}-score"
								type="range"
								min="1"
								max="5"
								step="1"
								bind:value={formData[dimension.key].score}
								class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-background-secondary-light"
							/>
							<div class="mt-1 flex justify-between text-xs text-text-secondary-light">
								<span>1</span>
								<span>2</span>
								<span>3</span>
								<span>4</span>
								<span>5</span>
							</div>
						</div>

						<!-- Tag Input -->
						<div>
							<label
								for="{dimension.key}-tag"
								class="mb-1 block text-xs font-medium text-text-secondary-light"
							>
								Descriptive Tag
							</label>
							<input
								id="{dimension.key}-tag"
								type="text"
								bind:value={formData[dimension.key].tag}
								placeholder="e.g., Chocolate, Bright, Full..."
								class="w-full rounded-md border border-border-light bg-background-secondary-light px-3 py-2 text-text-primary-light placeholder-text-secondary-light focus:border-transparent focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
							/>
						</div>

						<!-- Color Picker -->
						<div>
							<label
								for="{dimension.key}-color"
								class="mb-1 block text-xs font-medium text-text-secondary-light"
							>
								Color
							</label>
							<div class="flex items-center gap-2">
								<input
									id="{dimension.key}-color"
									type="color"
									bind:value={formData[dimension.key].color}
									class="h-8 w-8 cursor-pointer rounded border border-border-light"
								/>
								<input
									id="{dimension.key}-color-text"
									type="text"
									bind:value={formData[dimension.key].color}
									class="flex-1 rounded border border-border-light bg-background-secondary-light px-2 py-1 text-xs text-text-primary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Live Preview Section -->
		<div class="space-y-4">
			<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
				<h4 class="mb-4 font-medium text-text-primary-light">Live Preview</h4>
				<div class="flex justify-center">
					<TastingNotesRadar
						tastingNotes={aiTastingNotes}
						userTastingNotes={formData}
						showOverlay={!!aiTastingNotes}
						size={300}
						responsive={false}
					/>
				</div>
				{#if aiTastingNotes}
					<p class="mt-2 text-center text-xs text-text-secondary-light">
						Solid circles: AI assessment • Dashed circles: Your assessment
					</p>
				{/if}
			</div>

			<!-- Quick Actions -->
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h4 class="mb-3 font-medium text-text-primary-light">Quick Actions</h4>
				<div class="space-y-2">
					<button
						type="button"
						onclick={handleReset}
						class="w-full rounded-md border border-border-light bg-background-primary-light px-3 py-2 text-text-secondary-light transition-colors duration-200 hover:bg-background-tertiary-light hover:text-white"
					>
						Reset to Defaults
					</button>
					{#if aiTastingNotes}
						<button
							type="button"
							onclick={() => {
								if (aiTastingNotes) {
									formData = JSON.parse(JSON.stringify(aiTastingNotes));
								}
							}}
							class="w-full rounded-md border border-border-light bg-background-primary-light px-3 py-2 text-text-secondary-light transition-colors duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Start from AI Assessment
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Action Buttons -->
	<div class="mt-6 flex justify-end gap-3 border-t border-border-light pt-4">
		<button
			type="button"
			onclick={onCancel}
			class="rounded-md border border-border-light bg-background-secondary-light px-4 py-2 text-text-secondary-light transition-colors duration-200 hover:bg-background-primary-light"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={!isValidForm}
			class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Save Cupping Notes
		</button>
	</div>
</div>

<style>
	/* Custom slider styling */
	.slider::-webkit-slider-thumb {
		appearance: none;
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #8b4513;
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.slider::-moz-range-thumb {
		height: 20px;
		width: 20px;
		border-radius: 50%;
		background: #8b4513;
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.cupping-notes-form {
		max-width: 100%;
	}
</style>
