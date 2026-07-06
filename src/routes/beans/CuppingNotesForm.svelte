<script lang="ts">
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import type { TastingNotes, BrewMethod } from '$lib/types/coffee.types';

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

	const brewMethods: { value: BrewMethod; label: string }[] = [
		{ value: 'cupping', label: 'Cupping (Standard)' },
		{ value: 'espresso', label: 'Espresso' },
		{ value: 'pour_over', label: 'Pour Over' },
		{ value: 'french_press', label: 'French Press' },
		{ value: 'aeropress', label: 'AeroPress' },
		{ value: 'drip', label: 'Drip Coffee' },
		{ value: 'cold_brew', label: 'Cold Brew' },
		{ value: 'moka_pot', label: 'Moka Pot' },
		{ value: 'siphon', label: 'Siphon' },
		{ value: 'other', label: 'Other' }
	];

	let formData = $state<TastingNotes>({
		body: { tag: '', color: '#8B4513', score: 3 },
		flavor: { tag: '', color: '#D2691E', score: 3 },
		acidity: { tag: '', color: '#FFD700', score: 3 },
		sweetness: { tag: '', color: '#DEB887', score: 3 },
		fragrance_aroma: { tag: '', color: '#DDA0DD', score: 3 },
		brew_method: 'cupping'
	});

	let overallRating = $state<number | null>(null);

	// Initialize form data with existing notes if provided
	$effect(() => {
		if (initialNotes) {
			const loadedNotes = JSON.parse(JSON.stringify(initialNotes));
			// Ensure brew_method has a default if not present in loaded data
			if (!loadedNotes.brew_method) {
				loadedNotes.brew_method = 'cupping';
			}
			formData = loadedNotes;
		}
		if (initialRating !== null) {
			overallRating = initialRating;
		} else {
			overallRating = 5; // Default to midpoint for new ratings
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
			fragrance_aroma: { tag: '', color: '#DDA0DD', score: 3 },
			brew_method: 'cupping'
		};
		overallRating = null;
	}

	// Validation - check if form has meaningful data
	let isValidForm = $derived.by(() => {
		return overallRating !== null || dimensions.some((dim) => formData[dim.key].tag.trim() !== '');
	});

	// Color for each rating value
	function getRatingButtonColor(value: number): string {
		if (value >= 9) return 'bg-success-strong text-white';
		if (value >= 7) return 'bg-success text-white';
		if (value >= 5) return 'bg-chart-gold text-ink';
		if (value >= 3) return 'bg-warning text-white';
		return 'bg-danger text-white';
	}
</script>

<div class="cupping-notes-form">
	<div class="mb-6">
		<h3 class="mb-2 text-lg font-semibold text-ink">Your Cupping Assessment</h3>
		<p class="text-sm text-muted">
			Give an overall rating and rate each dimension from 1-5, add descriptive tags, and choose
			colors that represent your experience.
		</p>
	</div>

	<!-- Overall Rating Section -->
	<div class="mb-6 rounded-lg bg-surface-panel p-4 ring-1 ring-line">
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<h4 class="mb-1 font-medium text-ink">Overall Rating</h4>
				<p class="text-xs text-muted">Your overall impression of this coffee (1-10)</p>
			</div>
			<div class="flex items-center gap-4">
				{#if overallRating !== null}
					<span class="text-2xl font-bold text-chart-gold">{overallRating}</span>
					<span class="text-sm text-muted">/10</span>
				{:else}
					<span class="text-sm text-muted">No rating</span>
				{/if}
			</div>
		</div>
		<div class="mt-4">
			<div class="flex gap-1">
				{#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as value}
					<button
						type="button"
						onclick={() => {
							overallRating = overallRating === value ? null : value;
						}}
						class="flex-1 rounded-md border py-2 text-center text-sm font-medium transition-all duration-150 {overallRating ===
						value
							? getRatingButtonColor(value) + ' border-transparent shadow-sm'
							: 'border-line bg-surface-canvas text-muted hover:bg-accent/10 hover:text-ink'}"
					>
						{value}
					</button>
				{/each}
			</div>
		</div>
		<div class="mt-2 text-center">
			<button
				type="button"
				onclick={() => (overallRating = null)}
				class="text-xs text-muted underline hover:text-ink"
			>
				Clear Rating
			</button>
		</div>
	</div>

	<!-- Brew Method Section -->
	<div class="mb-6 rounded-lg bg-surface-panel p-4 ring-1 ring-line">
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<h4 class="mb-1 font-medium text-ink">Brew Method</h4>
				<p class="text-xs text-muted">How was this coffee prepared for tasting?</p>
			</div>
		</div>
		<div class="mt-4">
			<select
				id="brew-method"
				bind:value={formData.brew_method}
				class="w-full rounded-md border border-line bg-surface-canvas px-3 py-2 text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
			>
				{#each brewMethods as method}
					<option value={method.value}>{method.label}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Form Section -->
		<div class="space-y-4">
			{#each dimensions as dimension}
				<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
					<div class="mb-3 flex items-center justify-between">
						<div>
							<h4 class="font-medium text-ink">{dimension.label}</h4>
							<p class="text-xs text-muted">{dimension.description}</p>
						</div>
						<div class="text-right">
							<span class="text-lg font-bold text-accent">
								{formData[dimension.key].score}
							</span>
							<span class="text-xs text-muted">/5</span>
						</div>
					</div>

					<div class="space-y-3">
						<!-- Score Slider -->
						<div>
							<label for="{dimension.key}-score" class="mb-1 block text-xs font-medium text-muted">
								Score (1-5)
							</label>
							<input
								id="{dimension.key}-score"
								type="range"
								min="1"
								max="5"
								step="1"
								bind:value={formData[dimension.key].score}
								class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-panel"
							/>
							<div class="mt-1 flex justify-between text-xs text-muted">
								<span>1</span>
								<span>2</span>
								<span>3</span>
								<span>4</span>
								<span>5</span>
							</div>
						</div>

						<!-- Tag Input -->
						<div>
							<label for="{dimension.key}-tag" class="mb-1 block text-xs font-medium text-muted">
								Descriptive Tag
							</label>
							<input
								id="{dimension.key}-tag"
								type="text"
								bind:value={formData[dimension.key].tag}
								placeholder="e.g., Chocolate, Bright, Full..."
								class="w-full rounded-md border border-line bg-surface-panel px-3 py-2 text-ink placeholder:text-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
							/>
						</div>

						<!-- Color Picker -->
						<div>
							<label for="{dimension.key}-color" class="mb-1 block text-xs font-medium text-muted">
								Color
							</label>
							<div class="flex items-center gap-2">
								<input
									id="{dimension.key}-color"
									type="color"
									bind:value={formData[dimension.key].color}
									class="h-8 w-8 cursor-pointer rounded border border-line"
								/>
								<input
									id="{dimension.key}-color-text"
									type="text"
									bind:value={formData[dimension.key].color}
									class="flex-1 rounded border border-line bg-surface-panel px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
								/>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Live Preview Section -->
		<div class="space-y-4">
			<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
				<h4 class="mb-4 font-medium text-ink">Live Preview</h4>
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
					<p class="mt-2 text-center text-xs text-muted">
						Solid circles: AI assessment • Dashed circles: Your assessment
					</p>
				{/if}
			</div>

			<!-- Quick Actions -->
			<div class="rounded-lg bg-surface-panel p-4 ring-1 ring-line">
				<h4 class="mb-3 font-medium text-ink">Quick Actions</h4>
				<div class="space-y-2">
					<button
						type="button"
						onclick={handleReset}
						class="w-full rounded-md border border-line bg-surface-canvas px-3 py-2 text-muted transition-colors duration-200 hover:bg-accent hover:text-ink"
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
							class="w-full rounded-md border border-line bg-surface-canvas px-3 py-2 text-muted transition-colors duration-200 hover:bg-accent hover:text-ink"
						>
							Start from AI Assessment
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Action Buttons -->
	<div class="mt-6 flex justify-end gap-3 border-t border-line pt-4">
		<button
			type="button"
			onclick={onCancel}
			class="rounded-md border border-line bg-surface-panel px-4 py-2 text-muted transition-colors duration-200 hover:bg-surface-canvas"
		>
			Cancel
		</button>
		<button
			type="button"
			onclick={handleSave}
			disabled={!isValidForm}
			class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
