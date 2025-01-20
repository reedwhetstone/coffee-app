<script lang="ts">
	export let profile: any;
	export let onUpdate: (profile: any) => void;
	export let onDelete: (id: number) => void;
	export let profiles: any[] = [];
	export let currentIndex: number = 0;

	let isEditing = false;
	let editedProfile = { ...profile };

	let previousIndex = currentIndex;

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

				if (response.ok) {
					onDelete(profile.roast_id);
				} else {
					alert(`Failed to delete roast profile: ${profile.roast_id}`);
				}
			} catch (error) {
				console.error('Error deleting roast profile:', error);
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
		if (confirm('Are you sure you want to delete all profiles in this batch?')) {
			try {
				const formattedDate = profile.roast_date.split('T')[0];

				const response = await fetch(`/api/roast-profiles`, {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						batch_name: profile.batch_name,
						roast_date: formattedDate
					})
				});

				if (response.ok) {
					const deletedIds = await response.json();
					profiles.forEach((profile) => onDelete(profile.roast_id));
				} else {
					const errorData = await response.json();
					alert(`Failed to delete batch profiles: ${errorData.error || 'Unknown error'}`);
				}
			} catch (error) {
				console.error('Error deleting batch profiles:', error);
				alert('Failed to delete batch profiles. See console for details.');
			}
		}
	}

	$: slideDirection = currentIndex > previousIndex ? 1 : -1;
</script>

<div class="mx-8 mt-8 rounded-lg bg-zinc-800 p-6">
	<div class="mb-4">
		<div class="flex items-center justify-between">
			<div class="flex-1 text-center">
				<h1 class="text-2xl font-bold text-zinc-400">
					{profile.batch_name}
				</h1>
			</div>
			<button
				class="rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900"
				on:click={deleteBatch}
			>
				Delete Batch
			</button>
		</div>
		<div class="flex items-center justify-center">
			<h3 class="text-l font-bold text-zinc-500">
				{profile.coffee_name}
			</h3>
		</div>
		<div class="mt-4 flex items-center justify-center gap-2">
			{#each profiles as _, i}
				<button
					class="h-3 w-3 rounded-full transition-all duration-300 {i === currentIndex
						? 'scale-110 bg-blue-500'
						: 'bg-zinc-600 hover:bg-zinc-500'}"
					on:click={() => goToProfile(i)}
					aria-label="Go to profile {i + 1}"
				></button>
			{/each}
		</div>
	</div>

	<div class="relative h-auto min-h-[400px]">
		<div class="overflow-hidden">
			{#key currentIndex}
				<div
					class="grid grid-cols-2 gap-4"
					in:slideTransition={{ direction: slideDirection, delay: 50 }}
				>
					{#each Object.entries(profile) as [key, value]}
						{#if !['roast_id', 'coffee_id'].includes(key)}
							<div
								class="rounded bg-zinc-700 p-2 {['roast_notes', 'roast_targets'].includes(key)
									? 'col-span-2'
									: ''}"
							>
								<span class="font-medium text-zinc-400"
									>{key.replace(/_/g, ' ').toUpperCase()}:</span
								>
								{#if isEditing && key !== 'last_updated'}
									{#if ['roast_notes', 'roast_targets'].includes(key)}
										<textarea
											class="relative z-0 ml-2 min-h-[24px] w-full rounded bg-zinc-600 px-2 py-1 text-zinc-300"
											rows="4"
											bind:value={editedProfile[key]}
										></textarea>
									{:else if ['oz_in', 'oz_out'].includes(key)}
										<input
											type="number"
											step="0.1"
											min="0"
											class="relative z-0 ml-2 h-[24px] rounded bg-zinc-600 px-2 py-1 text-zinc-300"
											bind:value={editedProfile[key]}
										/>
									{:else if key === 'roast_date'}
										<input
											type="date"
											class="relative z-0 ml-2 h-[24px] rounded bg-zinc-600 px-2 py-1 text-zinc-300"
											bind:value={editedProfile[key]}
										/>
									{:else}
										<input
											type="text"
											class="relative z-0 ml-2 h-[24px] rounded bg-zinc-600 px-2 py-1 text-zinc-300"
											bind:value={editedProfile[key]}
										/>
									{/if}
								{:else}
									<span
										class="ml-2 h-[24px] leading-[24px] text-zinc-300 {[
											'roast_notes',
											'roast_targets'
										].includes(key)
											? 'space-pre-wrap block'
											: ''}"
									>
										{value}
									</span>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/key}
		</div>
	</div>
	<div>
		<div class="mt-4 flex justify-end space-x-2">
			<button
				class="rounded {isEditing
					? 'border-2 border-green-800 hover:bg-green-900'
					: 'border-2 border-blue-800 hover:bg-blue-900'} px-3 py-1 text-zinc-500"
				on:click={toggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
			</button>
			<button
				class="rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900"
				on:click={deleteProfile}
			>
				Delete
			</button>
		</div>
	</div>
</div>
