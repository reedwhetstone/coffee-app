<script lang="ts">
	import { formatDateForInput, prepareDateForAPI, formatDateForDisplay } from '$lib/utils/dates';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let profile: any;
	export let onUpdate: (profile: any) => void;
	export let onDelete: (id: number) => void;
	export let profiles: any[] = [];
	export let currentIndex: number = 0;

	let isEditing = false;
	let editedProfile: any = {};
	let previousIndex = 0;

	$: {
		// Update these values when props change
		editedProfile = { ...profile };
		previousIndex = currentIndex;
	}

	function slideTransition(_: Element, { duration = 300, direction = 1, delay = 0 }) {
		return {
			duration,
			delay,
			css: (t: number) => `
				transform: translateX(${direction * (1 - t) * 100}%);
				position: relative;
				z-index: 0;
			`
		};
	}

	function toggleEdit() {
		if (isEditing) {
			saveChanges();
		} else {
			editedProfile = { ...profile };
			isEditing = true;
		}
	}

	async function saveChanges() {
		try {
			const cleanedProfile = Object.fromEntries(
				Object.entries(editedProfile).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			cleanedProfile.last_updated = new Date().toISOString();

			const response = await fetch(`/api/roast-profiles?id=${profile.roast_id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(cleanedProfile)
			});

			if (response.ok) {
				const updatedProfile = await response.json();
				profile = updatedProfile;
				isEditing = false;
				onUpdate(updatedProfile);
			} else {
				const data = await response.json();
				alert(`Failed to update roast profile: ${data.error}`);
			}
		} catch (error) {
			console.error('Error updating roast profile:', error);
		}
	}

	async function deleteProfile() {
		if (confirm('Are you sure you want to delete this roast profile?')) {
			try {
				const response = await fetch(`/api/roast-profiles?id=${profile.roast_id}`, {
					method: 'DELETE'
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to delete profile');
				}

				// Dispatch event to parent for state update
				dispatch('profileDeleted');
			} catch (error) {
				console.error('Error deleting roast profile:', error);
				alert(error instanceof Error ? error.message : 'Failed to delete roast profile');
			}
		}
	}

	function goToProfile(index: number) {
		previousIndex = currentIndex;
		currentIndex = index;
		profile = profiles[currentIndex];
		onUpdate(profile);
	}

	async function deleteBatch() {
		try {
			if (!profile?.batch_name) {
				throw new Error('No batch name available');
			}

			if (
				!confirm(`Are you sure you want to delete all profiles in batch "${profile.batch_name}"?`)
			) {
				return;
			}

			const response = await fetch(
				`/api/roast-profiles?name=${encodeURIComponent(profile.batch_name)}`,
				{
					method: 'DELETE'
				}
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to delete batch profiles');
			}

			// Dispatch event to parent for state update
			dispatch('batchDeleted');
		} catch (error) {
			console.error('Error deleting batch:', error);
			alert(error instanceof Error ? error.message : 'Failed to delete batch profiles');
		}
	}

	$: slideDirection = currentIndex > previousIndex ? 1 : -1;
</script>

<div class="bg-coffee-brown mx-2 mt-4 rounded-lg p-3 sm:mx-8 sm:mt-8 sm:p-6">
	<div class="mb-4">
		<div class="flex flex-col items-center justify-between gap-2 sm:flex-row sm:gap-0">
			<div class="flex-1 text-center sm:text-left">
				<h1 class="text-xl font-bold text-zinc-400 sm:text-2xl">
					{profile.batch_name} // {formatDateForDisplay(profile.roast_date)}
				</h1>
			</div>
			<button
				class="w-full rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900 sm:w-auto"
				on:click={deleteBatch}
			>
				Delete Batch
			</button>
		</div>
		<div class="mt-2 flex items-center justify-center sm:justify-start">
			<h3 class="text-l font-bold text-zinc-500">
				{profile.coffee_name}
			</h3>
		</div>
	</div>

	<div class="relative h-auto min-h-[400px]">
		<div class="overflow-hidden">
			{#key currentIndex}
				<div
					class="grid grid-cols-1 gap-4 sm:grid-cols-2"
					in:slideTransition={{ direction: slideDirection, delay: 50 }}
				>
					{#each Object.entries(profile) as [key, value]}
						{#if !['roast_id', 'coffee_id'].includes(key)}
							<div
								class="rounded bg-zinc-700 p-3 {['roast_notes', 'roast_targets'].includes(key)
									? 'col-span-1 sm:col-span-2'
									: ''}"
							>
								<div class="flex flex-col">
									<span class="mb-1 font-medium text-zinc-400"
										>{key.replace(/_/g, ' ').toUpperCase()}:</span
									>
									{#if isEditing && key !== 'last_updated'}
										{#if ['roast_notes', 'roast_targets'].includes(key)}
											<textarea
												class="bg-light-cream relative z-0 min-h-[80px] w-full rounded px-2 py-1 text-zinc-300"
												rows="4"
												bind:value={editedProfile[key]}
											></textarea>
										{:else if ['oz_in', 'oz_out'].includes(key)}
											<input
												type="number"
												step="0.1"
												min="0"
												class="bg-light-cream relative z-0 h-[36px] w-full rounded px-2 py-1 text-zinc-300"
												bind:value={editedProfile[key]}
											/>
										{:else if key === 'roast_date'}
											<input
												type="date"
												class="bg-light-cream relative z-0 h-[36px] w-full rounded px-2 py-1 text-zinc-300"
												value={formatDateForInput(editedProfile[key])}
												on:input={(e) =>
													(editedProfile[key] = prepareDateForAPI(e.currentTarget.value))}
											/>
										{:else}
											<input
												type="text"
												class="bg-light-cream relative z-0 h-[36px] w-full rounded px-2 py-1 text-zinc-300"
												bind:value={editedProfile[key]}
											/>
										{/if}
									{:else}
										<span
											class="text-zinc-300 {['roast_notes', 'roast_targets'].includes(key)
												? 'space-pre-wrap block'
												: ''}"
										>
											{key === 'roast_date' || key === 'last_updated'
												? formatDateForDisplay(value as string)
												: value}
										</span>
									{/if}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/key}
		</div>
	</div>
	<div>
		<div class="mt-4 flex items-center justify-center gap-2">
			{#each profiles as _, i}
				<button
					class="h-3 w-3 rounded-full transition-all duration-300 {i === currentIndex
						? 'scale-110 bg-blue-500'
						: 'bg-light-cream hover:bg-zinc-500'}"
					on:click={() => goToProfile(i)}
					aria-label="Go to profile {i + 1}"
				></button>
			{/each}
		</div>
		<div class="mt-4 flex flex-col justify-end gap-2 sm:flex-row sm:space-x-2">
			<button
				class="w-full rounded sm:w-auto {isEditing
					? 'border-2 border-green-800 hover:bg-green-900'
					: 'border-2 border-blue-800 hover:bg-blue-900'} px-3 py-1 text-zinc-500"
				on:click={toggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
			</button>
			<button
				class="w-full rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900 sm:w-auto"
				on:click={deleteProfile}
			>
				Delete
			</button>
		</div>
	</div>
</div>
