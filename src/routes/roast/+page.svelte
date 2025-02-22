<script lang="ts">
	// Component imports
	import { onMount } from 'svelte';
	import { prepareDateForAPI } from '$lib/utils/dates';
	// import RoastChart from './RoastChart.svelte';
	import RoastProfileForm from './RoastProfileForm.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import { page } from '$app/stores';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		profileLogs,
		msToMySQLTime,
		mysqlTimeToMs
	} from './stores';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { get } from 'svelte/store';
	import RoastHistoryTable from './RoastHistoryTable.svelte';
	import RoastChartInterface from './RoastChartInterface.svelte';

	// Roast profile state management
	let currentRoastProfile: any = null;

	// Main state variables
	let selectedBean = currentRoastProfile
		? {
				id: currentRoastProfile.coffee_id,
				name: currentRoastProfile.coffee_name
			}
		: ($page.state as any)?.selectedBean || {};
	let isRoasting = false;
	let isPaused = false;
	let fanValue = 8;
	let heatValue = 1;
	let selectedEvent: string | null = null;
	let isFormVisible = ($page.state as any)?.showRoastForm || false;

	// Roast profile state management
	let allRoastProfiles: any[] = [];
	let sortField: string | null = 'roast_date';
	let sortDirection: 'asc' | 'desc' | null = 'desc';

	// Profile grouping and sorting state
	let groupedProfiles: Record<string, any[]> = {};
	let sortedBatchNames: string[] = [];
	let sortedGroupedProfiles: Record<string, any[]> = {};
	let expandedBatches: Set<string> = new Set();
	let currentProfileIndex = 0;

	// Fetches all roast profiles from the API and sets the current profile
	async function loadRoastProfiles() {
		try {
			const response = await fetch('/api/roast-profiles');
			if (response.ok) {
				const data = await response.json();
				allRoastProfiles = data.data;
				console.log('Fetched Roast Profiles:', allRoastProfiles); // Debugging line

				// Only set currentRoastProfile if we have a selectedBean
				if (selectedBean?.id) {
					const matchingProfiles = allRoastProfiles
						.filter((profile: any) => profile.coffee_id === selectedBean.id)
						.sort(
							(a: any, b: any) =>
								new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
						);
					currentRoastProfile = matchingProfiles.length > 0 ? matchingProfiles[0] : null;
				} else {
					currentRoastProfile = null;
				}
			}
		} catch (error) {
			console.error('Error loading roast profiles:', error);
		}
	}

	onMount(() => {
		loadRoastProfiles();

		// Add search navigation handling
		const searchState = $page.state as any;
		if (searchState?.searchType === 'roast' && searchState?.searchId) {
			loadRoastProfiles().then(() => {
				const foundProfile = allRoastProfiles.find(
					(profile) => profile.roast_id === searchState.searchId
				);
				if (foundProfile) {
					// Set the selectedBean first
					selectedBean = {
						id: foundProfile.coffee_id,
						name: foundProfile.coffee_name
					};
					// Then select the profile
					selectProfile(foundProfile);
				}
			});
		}

		// Set navbar actions
		navbarActions.set({
			...get(navbarActions),
			onShowRoastForm: () => (isFormVisible = true),
			onSearchSelect: async (type, id) => {
				if (type === 'roast') {
					await loadRoastProfiles();
					const foundProfile = allRoastProfiles.find((profile) => profile.roast_id === id);
					if (foundProfile) {
						selectProfile(foundProfile);
					}
				}
			}
		});

		return () => {
			navbarActions.set({
				...get(navbarActions),
				onShowRoastForm: () => {},
				onSearchSelect: () => {}
			});
		};
	});

	// Reactive statement to handle profile grouping and sorting
	$: {
		// Group profiles by batch_name
		groupedProfiles = allRoastProfiles.reduce((groups: Record<string, any[]>, profile) => {
			const batchName = profile.batch_name || 'No Batch';
			if (!groups[batchName]) {
				groups[batchName] = [];
			}
			groups[batchName].push(profile);
			return groups;
		}, {});

		// Sort batch names by most recent roast date
		sortedBatchNames = Object.keys(groupedProfiles).sort((a, b) => {
			const latestA = Math.max(...groupedProfiles[a].map((p) => new Date(p.roast_date).getTime()));
			const latestB = Math.max(...groupedProfiles[b].map((p) => new Date(p.roast_date).getTime()));
			return sortDirection === 'asc' ? latestA - latestB : latestB - latestA;
		});

		// Sort profiles within each batch group
		sortedGroupedProfiles = {};
		sortedBatchNames.forEach((batch) => {
			sortedGroupedProfiles[batch] = [...groupedProfiles[batch]].sort((a, b) => {
				if (!sortField || sortField === 'batch_name') return 0;

				const aVal = a[sortField];
				const bVal = b[sortField];

				if (sortField === 'roast_date' || sortField === 'last_updated') {
					return sortDirection === 'asc'
						? new Date(aVal).getTime() - new Date(bVal).getTime()
						: new Date(bVal).getTime() - new Date(aVal).getTime();
				}

				if (typeof aVal === 'string' && typeof bVal === 'string') {
					return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
				}

				return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
			});
		});
	}

	// Form submission handler for new roast profiles
	async function handleFormSubmit(profileData: any) {
		try {
			const dataForAPI = profileData.batch_beans.map((bean: any) => ({
				batch_name: profileData.batch_name,
				coffee_id: bean.coffee_id,
				coffee_name: bean.coffee_name,
				roast_date: prepareDateForAPI(profileData.roast_date),
				last_updated: new Date().toISOString(),
				oz_in: bean.oz_in,
				oz_out: bean.oz_out,
				roast_notes: profileData.roast_notes,
				roast_targets: profileData.roast_targets
			}));

			const response = await fetch('/api/roast-profiles', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataForAPI)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to create roast profiles');
			}

			const profiles = await response.json();

			if (profiles && profiles.length > 0) {
				// Update the selected bean and current profile
				selectedBean = {
					id: profiles[0].coffee_id,
					name: profiles[0].coffee_name
				};

				// First refresh the profiles list
				await loadRoastProfiles();

				// Then find and select the newly created profile
				const newProfile = allRoastProfiles.find((p) => p.roast_id === profiles[0].roast_id);
				if (newProfile) {
					await selectProfile(newProfile);
				}

				isFormVisible = false;
			} else {
				throw new Error('No profiles were created');
			}
		} catch (error: unknown) {
			console.error('Error creating roast profiles:', error);
			alert(error instanceof Error ? error.message : 'Failed to create roast profiles');
		}
	}

	// Update the fan control handler to work even before roasting starts
	function updateFan(value: number) {
		fanValue = value;
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		$roastData = [
			...$roastData,
			{
				time: currentTime,
				heat: heatValue,
				fan: value
			}
		];
	}

	// Update the heat control handler to work even before roasting starts
	function updateHeat(value: number) {
		heatValue = value;
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		$roastData = [
			...$roastData,
			{
				time: currentTime,
				heat: value,
				fan: fanValue
			}
		];
	}

	// Profile management handlers
	async function handleProfileUpdate(updatedProfile: any) {
		try {
			await loadRoastProfiles(); // Refresh the profiles list first
			const profile = allRoastProfiles.find((p) => p.roast_id === updatedProfile.roast_id);
			if (profile) {
				await selectProfile(profile);
			} else {
				throw new Error('Updated profile not found');
			}
		} catch (error) {
			console.error('Error updating profile:', error);
			alert('Failed to update roast profile');
		}
	}

	async function handleProfileDelete(id: number) {
		currentRoastProfile = null;
		await loadRoastProfiles();
	}

	// Table sorting handler
	function toggleSort(field: string) {
		if (sortField === field) {
			if (sortDirection === 'asc') sortDirection = 'desc';
			else if (sortDirection === 'desc') {
				sortField = null;
				sortDirection = null;
			}
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	// Profile selection handler with smooth scroll
	async function selectProfile(profile: any) {
		try {
			// Make a copy of the profile to avoid reference issues
			currentRoastProfile = { ...profile };
			selectedBean = {
				id: profile.coffee_id,
				name: profile.coffee_name
			};

			// Find the index of the selected profile in its batch
			const batchProfiles = groupedProfiles[profile.batch_name] || [];
			currentProfileIndex = batchProfiles.findIndex((p) => p.roast_id === profile.roast_id);

			// Reset roasting state
			isRoasting = false;
			isPaused = false;

			// Fetch and load profile log data
			const response = await fetch(`/api/profile-log?roast_id=${profile.roast_id}`);
			if (!response.ok) {
				throw new Error('Failed to fetch profile log data');
			}

			const data = await response.json();

			if (data.data.length > 0) {
				// Convert profile log entries to roast data points
				$roastData = data.data.map((log: any) => ({
					time: mysqlTimeToMs(log.time),
					heat: log.heat_setting,
					fan: log.fan_setting
				}));

				// Convert profile log entries to roast events
				$roastEvents = data.data
					.filter(
						(log: any) =>
							log.start ||
							log.maillard ||
							log.fc_start ||
							log.fc_rolling ||
							log.fc_end ||
							log.sc_start ||
							log.drop ||
							log.end
					)
					.map((log: any) => ({
						time: mysqlTimeToMs(log.time),
						name: log.start
							? 'Start'
							: log.maillard
								? 'Maillard'
								: log.fc_start
									? 'FC Start'
									: log.fc_rolling
										? 'FC Rolling'
										: log.fc_end
											? 'FC End'
											: log.sc_start
												? 'SC Start'
												: log.drop
													? 'Drop'
													: 'End'
					}));
			} else {
				// Clear all data for new roast
				$roastData = [];
				$roastEvents = [];
				$profileLogs = [];
				$startTime = null;
				$accumulatedTime = 0;
			}

			// Smooth scroll to top
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} catch (error) {
			console.error('Error selecting profile:', error);
			alert('Failed to load profile data');
		}
	}

	// Batch expansion toggle for table groups
	function toggleBatch(batchName: string) {
		if (expandedBatches.has(batchName)) {
			expandedBatches.delete(batchName);
		} else {
			expandedBatches.add(batchName);
		}
		expandedBatches = expandedBatches; // trigger reactivity
	}

	// Add saveRoastProfile function
	async function saveRoastProfile() {
		try {
			if (!selectedBean?.id) {
				throw new Error(
					'No coffee selected. Please select a coffee before saving the roast profile.'
				);
			}

			if (isRoasting && !isPaused) {
				throw new Error('Please stop the roast before saving.');
			}

			// Prepare the logs with end time before saving
			const preparedLogs = prepareProfileLogsForSave();

			let profileResponse;
			let profile;

			if (currentRoastProfile?.roast_id) {
				// Update existing profile
				profileResponse = await fetch(`/api/roast-profiles?id=${currentRoastProfile.roast_id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						...currentRoastProfile,
						last_updated: new Date()
					})
				});

				if (!profileResponse.ok) {
					const errorData = await profileResponse.json();
					throw new Error(errorData.error || 'Failed to update roast profile');
				}
				profile = await profileResponse.json();
			} else {
				// Create new profile
				profileResponse = await fetch('/api/roast-profiles', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						batch_name: `${selectedBean.name} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
						coffee_id: selectedBean.id,
						coffee_name: selectedBean.name,
						roast_date: new Date(),
						last_updated: new Date(),
						oz_in: null,
						oz_out: null,
						roast_notes: null,
						roast_targets: null
					})
				});

				if (!profileResponse.ok) {
					const errorData = await profileResponse.json();
					throw new Error(errorData.error || 'Failed to save roast profile');
				}
				profile = await profileResponse.json();
			}

			// Delete existing log entries if updating
			if (currentRoastProfile?.roast_id) {
				await fetch(`/api/profile-log?roast_id=${currentRoastProfile.roast_id}`, {
					method: 'DELETE'
				});
			}

			// Save new log entries with prepared logs
			const logEntries = preparedLogs.map(
				(entry: {
					time: number;
					fan_setting: number;
					heat_setting: number;
					start: boolean;
					maillard: boolean;
					fc_start: boolean;
					fc_rolling: boolean;
					fc_end: boolean;
					sc_start: boolean;
					drop: boolean;
					end: boolean;
				}) => ({
					...entry,
					roast_id: profile.roast_id,
					time: msToMySQLTime(entry.time)
				})
			);

			const logResponse = await fetch('/api/profile-log', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(logEntries)
			});

			if (!logResponse.ok) {
				const errorData = await logResponse.json();
				throw new Error(errorData.error || 'Failed to save profile logs');
			}

			// Reload profiles and select the saved one
			await loadRoastProfiles();
			const savedProfile = allRoastProfiles.find((p) => p.roast_id === profile.roast_id);
			if (savedProfile) {
				await selectProfile(savedProfile);
			}

			alert('Roast profile saved successfully!');
		} catch (error: unknown) {
			console.error('Error saving roast profile:', error);
			alert(error instanceof Error ? error.message : 'Failed to save roast profile');
		}
	}

	function showRoastForm() {
		isFormVisible = true;
	}

	function hideRoastForm() {
		isFormVisible = false;
	}

	function prepareProfileLogsForSave() {
		if ($profileLogs.length === 0) return $profileLogs;

		const lastTime = $roastData[$roastData.length - 1]?.time || 0;

		// Update the last log entry or create a new one with end=true
		const lastLog = $profileLogs[$profileLogs.length - 1];
		if (lastLog && lastLog.drop) {
			lastLog.end = true;
			lastLog.time = lastTime;
		} else {
			$profileLogs = [
				...$profileLogs,
				{
					fan_setting: fanValue,
					heat_setting: heatValue,
					start: false,
					maillard: false,
					fc_start: false,
					fc_rolling: false,
					fc_end: false,
					sc_start: false,
					drop: false,
					end: true,
					time: lastTime
				}
			];
		}

		return $profileLogs;
	}

	async function handleClearRoastData(roastId: number) {
		try {
			await fetch(`/api/profile-log?roast_id=${currentRoastProfile.roast_id}`, {
				method: 'DELETE'
			});
			await selectProfile(currentRoastProfile); // Reload the profile
		} catch (error) {
			console.error('Error clearing roast data:', error);
			alert('Failed to clear roast data');
		}
	}
</script>

<!-- Modal for adding new roast profiles -->
{#if isFormVisible}
	<div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 p-4">
		<div class="w-full max-w-2xl rounded-lg bg-zinc-800 p-4 sm:p-6">
			<RoastProfileForm {selectedBean} onClose={hideRoastForm} onSubmit={handleFormSubmit} />
		</div>
	</div>
{/if}

<!-- Current roast profile display -->
{#if currentRoastProfile}
	<div class="mx-4 my-6 sm:m-8">
		<div class="mb-4 flex justify-end">
			<button
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				on:click={() => (isFormVisible = true)}
			>
				New Roast
			</button>
		</div>
		<RoastProfileDisplay
			profile={currentRoastProfile}
			profiles={currentRoastProfile ? groupedProfiles[currentRoastProfile.batch_name] || [] : []}
			currentIndex={currentProfileIndex}
			onUpdate={handleProfileUpdate}
			onDelete={handleProfileDelete}
		/>
	</div>
{/if}

<!-- Main roasting interface -->
{#if currentRoastProfile}
	<div class="mx-4 my-6 rounded-lg bg-zinc-800 p-4 sm:m-8 sm:p-8">
		<RoastChartInterface
			{isPaused}
			{currentRoastProfile}
			{fanValue}
			{heatValue}
			{isRoasting}
			{selectedEvent}
			{updateFan}
			{updateHeat}
			{saveRoastProfile}
			{selectedBean}
			clearRoastData={() => handleClearRoastData(currentRoastProfile.id)}
		/>
	</div>
{/if}

<!-- Replace the old table with this component -->
<RoastHistoryTable
	{sortedBatchNames}
	{sortedGroupedProfiles}
	{expandedBatches}
	{currentRoastProfile}
	onToggleBatch={toggleBatch}
	onSelectProfile={selectProfile}
/>

<!-- Move modal to the end of the file and keep it simple -->
{#if isFormVisible}
	<RoastProfileForm {selectedBean} onClose={hideRoastForm} onSubmit={handleFormSubmit} />
{/if}
