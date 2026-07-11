<script lang="ts">
	import { formatDateForDisplay } from '$lib/utils/dates';
	import { ROAST_PROFILES_COLUMNS, pickColumns } from '$lib/utils/dbColumns.js';
	import type { RoastProfile } from '$lib/types/component.types';

	let {
		profile,
		onUpdate,
		onProfileDeleted,
		onBatchDeleted,
		currentIndex = 0
	} = $props<{
		profile: RoastProfile;
		onUpdate: (profile: RoastProfile) => void;
		onProfileDeleted: () => void;
		onBatchDeleted: () => void;
		currentIndex?: number;
	}>();

	function formatMilestoneTime(s: number | null): string {
		if (s == null) return '—';
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, '0')}`;
	}

	let isEditing = $state(false);
	let editedProfile = $state<RoastProfile>({} as RoastProfile);

	// Sync editedProfile when profile prop changes
	$effect(() => {
		editedProfile = { ...profile };
	});

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
			const nulled = Object.fromEntries(
				Object.entries(editedProfile).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			nulled.last_updated = new Date().toISOString();

			// Use allowlist to strip computed/joined fields — forward-safe vs. denylist
			const cleanedProfile = pickColumns(nulled, ROAST_PROFILES_COLUMNS);

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

				// Notify parent via callback
				onProfileDeleted();
			} catch (error) {
				console.error('Error deleting roast profile:', error);
				alert(error instanceof Error ? error.message : 'Failed to delete roast profile');
			}
		}
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

			// Notify parent via callback
			onBatchDeleted();
		} catch (error) {
			console.error('Error deleting batch:', error);
			alert(error instanceof Error ? error.message : 'Failed to delete batch profiles');
		}
	}
</script>

<div class="overflow-hidden rounded-lg bg-surface-panel p-3 sm:p-6">
	<div class="mb-4">
		<div class="flex flex-col items-center justify-between gap-2 sm:flex-row sm:gap-0">
			<div class="flex-1 text-center sm:text-left">
				<h1 class="break-words text-lg font-bold text-ink sm:text-xl">
					{profile.coffee_name}
				</h1>
				{#if profile.roast_id}
					<div class="mt-1 text-sm text-muted">
						Roast ID: {profile.roast_id} • {formatDateForDisplay(profile.roast_date)}
					</div>
				{/if}
			</div>
			<div class="flex gap-2">
				<button
					class="rounded border-2 border-danger-strong px-3 py-1 text-sm text-ink hover:bg-danger-subtle"
					onclick={deleteBatch}
				>
					Delete batch
				</button>
			</div>
		</div>
	</div>

	<div class="relative">
		<div class="overflow-hidden">
			{#key currentIndex}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					{#each Object.entries(profile) as [key, value]}
						{#if ['oz_in', 'oz_out', 'roast_notes', 'roast_targets'].includes(key)}
							<div
								class="rounded border border-accent p-3 {['roast_notes', 'roast_targets'].includes(
									key
								)
									? 'col-span-1 sm:col-span-2'
									: ''}"
							>
								<div class="flex flex-col">
									<span class="mb-1 font-medium text-ink"
										>{key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}:</span
									>
									{#if isEditing}
										{#if ['roast_notes', 'roast_targets'].includes(key)}
											<textarea
												class="relative z-0 min-h-[80px] w-full rounded bg-surface-canvas px-2 py-1 text-ink"
												rows="4"
												bind:value={
													(editedProfile as Record<string, string | number | null | undefined>)[key]
												}
											></textarea>
										{:else if ['oz_in', 'oz_out'].includes(key)}
											<input
												type="number"
												step="0.1"
												min="0"
												class="relative z-0 h-[36px] w-full rounded bg-surface-canvas px-2 py-1 text-ink"
												bind:value={
													(editedProfile as Record<string, string | number | null | undefined>)[key]
												}
											/>
										{:else}
											<input
												type="text"
												class="relative z-0 h-[36px] w-full rounded bg-surface-canvas px-2 py-1 text-ink"
												bind:value={
													(editedProfile as Record<string, string | number | null | undefined>)[key]
												}
											/>
										{/if}
									{:else}
										<span
											class="break-words text-ink {['roast_notes', 'roast_targets'].includes(key)
												? 'block whitespace-pre-wrap'
												: ''}"
										>
											{value}
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
	<!-- Milestones Section (read-only) -->
	{#if profile.tp_time != null || profile.fc_start_time != null || profile.drop_time != null || profile.total_roast_time != null}
		<div class="mt-4">
			<h2 class="mb-2 text-sm font-semibold text-ink">Milestones</h2>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{#if profile.tp_time != null}
					<div class="rounded border border-accent p-3">
						<div class="mb-1 text-xs font-medium text-muted">TP</div>
						<div class="text-sm text-ink">
							{formatMilestoneTime(profile.tp_time)}{profile.tp_temp != null
								? ` @ ${profile.tp_temp}°${profile.temperature_unit || 'F'}`
								: ''}
						</div>
					</div>
				{/if}
				{#if profile.fc_start_time != null}
					<div class="rounded border border-accent p-3">
						<div class="mb-1 text-xs font-medium text-muted">FC</div>
						<div class="text-sm text-ink">
							{formatMilestoneTime(profile.fc_start_time)}{profile.fc_start_temp != null
								? ` @ ${profile.fc_start_temp}°${profile.temperature_unit || 'F'}`
								: ''}
						</div>
					</div>
				{/if}
				{#if profile.fc_end_time != null}
					<div class="rounded border border-accent p-3">
						<div class="mb-1 text-xs font-medium text-muted">FC end</div>
						<div class="text-sm text-ink">
							{formatMilestoneTime(profile.fc_end_time)}{profile.fc_end_temp != null
								? ` @ ${profile.fc_end_temp}°${profile.temperature_unit || 'F'}`
								: ''}
						</div>
					</div>
				{/if}
				{#if profile.drop_time != null}
					<div class="rounded border border-accent p-3">
						<div class="mb-1 text-xs font-medium text-muted">Drop</div>
						<div class="text-sm text-ink">
							{formatMilestoneTime(profile.drop_time)}{profile.drop_temp != null
								? ` @ ${profile.drop_temp}°${profile.temperature_unit || 'F'}`
								: ''}
						</div>
					</div>
				{/if}
				{#if profile.total_roast_time != null}
					<div class="rounded border border-accent p-3">
						<div class="mb-1 text-xs font-medium text-muted">Total</div>
						<div class="text-sm text-ink">
							{formatMilestoneTime(profile.total_roast_time)}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div>
		<div class="mt-4 flex flex-col justify-end gap-2 sm:flex-row sm:space-x-2">
			<button
				class="w-full rounded sm:w-auto {isEditing
					? 'border-2 border-success-strong hover:bg-success-subtle'
					: 'border-2 border-info hover:bg-info-subtle'} px-3 py-1 text-ink"
				onclick={toggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
			</button>
			<button
				class="w-full rounded border-2 border-danger-strong px-3 py-1 text-ink hover:bg-danger-subtle sm:w-auto"
				onclick={deleteProfile}
			>
				Delete
			</button>
		</div>
	</div>
</div>
