<script lang="ts">
	// Component imports
	import { onMount } from 'svelte';
	import { prepareDateForAPI } from '$lib/utils/dates';
	// import RoastChart from './RoastChart.svelte';
	import RoastProfileForm from './RoastProfileForm.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import { page } from '$app/state';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		profileLogs,
		msToMySQLTime,
		mysqlTimeToMs
	} from './stores';

	import RoastHistoryTable from './RoastHistoryTable.svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import SimpleLoadingScreen from '$lib/components/SimpleLoadingScreen.svelte';

	// Lazy load the heavy chart component
	let RoastChartInterface = $state<any>(null);
	let chartComponentLoading = $state(true);

	onMount(async () => {
		// Dynamically import the chart component to reduce initial bundle size
		const module = await import('./RoastChartInterface.svelte');
		RoastChartInterface = module.default;
		chartComponentLoading = false;
	});
	import type { PageData } from './$types';

	// Roast profile state management
	let currentRoastProfile = $state<any>(null);

	// Main state variables
	let isFormVisible = $state(false);
	let selectedBean = $state<{ id?: number; name: string }>({ name: 'No Bean Selected' });
	let isRoasting = $state(false);
	let isPaused = $state(false);
	let fanValue = $state(8);
	let heatValue = $state(1);
	let selectedEvent = $state<string | null>(null);

	// Roast profile state management
	let sortField = $state<string | null>('roast_id');
	let sortDirection = $state<'asc' | 'desc' | null>('asc');

	// Profile grouping and sorting state
	let sortedBatchNames = $state<string[]>([]);
	let sortedGroupedProfiles = $state<Record<string, any[]>>({});
	let expandedBatches = $state<Set<string>>(new Set());
	let currentProfileIndex = $state<number>(0);

	// Page data
	let { data } = $props<{ data: PageData }>();

	// Track initialization and processing
	let updatingProfileGroups = $state(false);
	let initializing = $state(false);

	// // Debug data in the component
	// $effect(() => {
	// 	//console.log('Roast page data:', data);
	// 	//console.log('FilteredData store value:', $filteredData.length, 'items');
	// 	//console.log('Sorted batch names:', sortedBatchNames.length, 'batches');
	// 	//console.log(
	// 		'Sorted grouped profiles:',
	// 		Object.keys(sortedGroupedProfiles).length,
	// 		'batch keys'
	// 	);
	// });

	// Initialize filter store
	$effect(() => {
		const currentRoute = page.url.pathname;
		// If we have page data but filtered data is empty, initialize it
		if (
			data?.data?.length > 0 &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute) &&
			!initializing
		) {
			//console.log('Initializing filter store with roast page data:', data.data.length, 'items');
			initializing = true;
			// Use setTimeout to break potential update cycles
			setTimeout(() => {
				filterStore.initializeForRoute(currentRoute, data.data);
				initializing = false;

				// Force an update of grouped profiles after initialization
				setTimeout(() => {
					if ($filteredData.length > 0 && !updatingProfileGroups) {
						//console.log('Forcing update of grouped profiles after filter store initialization');
						updateGroupedProfiles([...$filteredData]);
					}
				}, 100);
			}, 0);
		}
	});

	// Update grouped profiles when filtered data changes - completely restructured to prevent loops

	let initialLoadComplete = $state(false);

	// Replace the existing effect with a more robust version that uses the filterChangeNotifier
	let lastFilteredDataLength = $state(0);

	$effect(() => {
		// Only process if the filtered data length has actually changed
		if (lastFilteredDataLength !== $filteredData.length) {
			// console.log(
			// 	'Filtered data changed in roast page, from',
			// 	lastFilteredDataLength,
			// 	'to',
			// 	$filteredData.length
			// );
			lastFilteredDataLength = $filteredData.length;

			// Skip if we're already updating
			if (updatingProfileGroups) {
				//console.log('Already updating profile groups, skipping');
				return;
			}

			// Skip if no data
			if (!$filteredData.length) {
				// Clear the sorted batch names and grouped profiles when there's no data
				if (sortedBatchNames.length > 0 || Object.keys(sortedGroupedProfiles).length > 0) {
					//console.log('No filtered data, clearing sorted batch names and grouped profiles');
					sortedBatchNames = [];
					sortedGroupedProfiles = {};
				}
				return;
			}

			// Process the data with a guard to prevent loops
			//console.log('Filter change detected, updating grouped profiles');
			updatingProfileGroups = true;
			try {
				// Create a snapshot of the current filtered data to avoid reactivity issues
				const dataSnapshot = [...$filteredData];
				updateGroupedProfiles(dataSnapshot);
			} finally {
				updatingProfileGroups = false;
			}
		}
	});

	// Update selectedBean when currentRoastProfile changes
	$effect(() => {
		if (currentRoastProfile && !processing) {
			// Check if the selectedBean actually needs to be updated
			if (
				!selectedBean ||
				selectedBean.id !== currentRoastProfile.coffee_id ||
				selectedBean.name !== currentRoastProfile.coffee_name
			) {
				processing = true;
				try {
					// console.log(
					// 	'Updating selectedBean from currentRoastProfile:',
					// 	currentRoastProfile.coffee_id
					// );
					selectedBean = {
						id: currentRoastProfile.coffee_id,
						name: currentRoastProfile.coffee_name
					};
				} finally {
					// Use setTimeout to break potential update cycles
					setTimeout(() => {
						processing = false;
					}, 50);
				}
			}
		}
	});

	// Ensure the data object always has the callback and selectedBean
	$effect(() => {
		if (data) {
			// Always ensure the callback is attached
			data.selectedBean = selectedBean;
			data.onAddNewRoast = showRoastForm;
		}
	});

	// Function to update grouped profiles from filtered data
	function updateGroupedProfiles(profiles: any[]) {
		//	console.log('Updating grouped profiles with', profiles.length, 'profiles');

		// Skip update if profiles array is empty
		if (!profiles.length) {
			//	console.log('No profiles to update, clearing groupings');
			sortedBatchNames = [];
			sortedGroupedProfiles = {};
			return;
		}

		// Group profiles by batch name
		const newGroupedProfiles: Record<string, any[]> = {};

		// Process each profile
		profiles.forEach((profile) => {
			const batchName = profile.batch_name || 'Unknown Batch';
			if (!newGroupedProfiles[batchName]) {
				newGroupedProfiles[batchName] = [];
			}
			newGroupedProfiles[batchName].push(profile);
		});

		// Sort profiles within each batch by date (newest first)
		Object.keys(newGroupedProfiles).forEach((batchName) => {
			newGroupedProfiles[batchName].sort((a, b) => {
				const dateA = new Date(a.roast_date);
				const dateB = new Date(b.roast_date);
				return dateB.getTime() - dateA.getTime();
			});
		});

		// Get sorted batch names
		const batchNames = Object.keys(newGroupedProfiles).sort((a, b) => {
			// Get the latest date from each batch
			const latestA = newGroupedProfiles[a][0]?.roast_date
				? new Date(newGroupedProfiles[a][0].roast_date)
				: new Date(0);
			const latestB = newGroupedProfiles[b][0]?.roast_date
				? new Date(newGroupedProfiles[b][0].roast_date)
				: new Date(0);
			return latestB.getTime() - latestA.getTime();
		});

		// Store the current expanded batches before updating
		const currentExpandedBatches = new Set(expandedBatches);

		// Update state
		sortedBatchNames = batchNames;
		sortedGroupedProfiles = newGroupedProfiles;

		// Preserve expanded batches that still exist in the new data
		const newExpandedBatches = new Set<string>();
		for (const batchName of currentExpandedBatches) {
			if (batchNames.includes(batchName)) {
				newExpandedBatches.add(batchName);
			}
		}

		// If this is the first load and there are batches, expand the first one
		if (batchNames.length > 0 && newExpandedBatches.size === 0 && !initialLoadComplete) {
			newExpandedBatches.add(batchNames[0]);
			initialLoadComplete = true;
		}

		// Update the expanded batches
		expandedBatches = newExpandedBatches;

		//console.log('Updated sorted batch names:', batchNames);
		//console.log('Updated sorted grouped profiles keys:', Object.keys(sortedGroupedProfiles));
		//console.log('Updated expanded batches:', Array.from(expandedBatches));
	}

	// Effect to handle sort changes - make this more efficient
	let processing = $state(false);
	// Removed the sort effect since it's redundant - the filtered data effect will handle updates

	// Fetches all roast profiles from the API and sets the current profile
	async function loadRoastProfiles() {
		try {
			const response = await fetch('/api/roast-profiles');
			if (response.ok) {
				const result = await response.json();
				if (result.data && Array.isArray(result.data)) {
					// Update the page data
					data.data = result.data;

					// Force an update of the filter store
					const currentRoute = page.url.pathname;
					filterStore.initializeForRoute(currentRoute, result.data);

					// Force an update of grouped profiles after a short delay
					setTimeout(() => {
						if ($filteredData.length > 0) {
							//console.log('Forcing update of grouped profiles after loading roast profiles');
							updateGroupedProfiles([...$filteredData]);
						}
					}, 150);
				}
			}
		} catch (error) {
			console.error('Error loading roast profiles:', error);
		}
	}

	onMount(() => {
		let shouldShowForm = false;
		let profileIdToLoad: string | null = null;

		if (typeof window !== 'undefined' && !currentRoastProfile) {
			const params = new URLSearchParams(window.location.search);
			const beanId = params.get('beanId');
			const beanName = params.get('beanName');
			const profileId = params.get('profileId');

			// Check for profileId parameter to load existing profile
			if (profileId) {
				profileIdToLoad = profileId;
				console.log('Found profileId in URL params:', profileId);
			}
			// Check for beanId/beanName to create new roast
			else if (beanId && beanName) {
				selectedBean = {
					id: parseInt(beanId),
					name: decodeURIComponent(beanName)
				};
				console.log('Set selectedBean from URL params:', selectedBean);
				shouldShowForm = true; // Auto-show form when URL params are present
			}
		}

		// Check if we should show the roast form based on navigation state
		const state = page.state as any;
		console.log('Page state on mount:', state);

		if (state?.showRoastForm) {
			console.log('Should show roast form based on state flag');

			// If a bean was passed in the state, use it
			if (state.selectedBean) {
				console.log('Found selectedBean in state:', state.selectedBean);
				selectedBean = state.selectedBean;
			}
			shouldShowForm = true;
		}

		// Show the form if either URL params or state indicate we should
		if (shouldShowForm) {
			setTimeout(() => {
				isFormVisible = true;
			}, 100);
		}

		// Load roast profiles and ensure they're displayed
		loadRoastProfiles().then(() => {
			// Force an update of the grouped profiles if they're not already populated
			if (sortedBatchNames.length === 0 && $filteredData.length > 0) {
				//console.log('Forcing update of grouped profiles on mount');
				updateGroupedProfiles([...$filteredData]);
			}

			// Load specific profile if profileId was provided in URL
			if (profileIdToLoad && data?.data?.length > 0) {
				const targetProfile = data.data.find(
					(p: { roast_id: number }) => p.roast_id === parseInt(profileIdToLoad)
				);
				if (targetProfile) {
					console.log('Loading profile from URL parameter:', targetProfile);
					selectProfile(targetProfile);
				} else {
					console.warn(`Profile with ID ${profileIdToLoad} not found`);
				}
			}
		});

		// Initialize filter store with roast data if needed
		const currentRoute = page.url.pathname;
		if (
			data?.data?.length > 0 &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute)
		) {
			//console.log('Initializing filter store with roast page data:', data.data.length, 'items');
			filterStore.initializeForRoute(currentRoute, data.data);

			// Force an update of the grouped profiles after initialization
			setTimeout(() => {
				if ($filteredData.length > 0 && sortedBatchNames.length === 0) {
					//console.log('Forcing update of grouped profiles after filter store initialization');
					updateGroupedProfiles([...$filteredData]);
				}

				// Also check for profileId to load after filter store initialization
				if (profileIdToLoad && data?.data?.length > 0 && !currentRoastProfile) {
					const targetProfile = data.data.find(
						(p: { roast_id: number }) => p.roast_id === parseInt(profileIdToLoad)
					);
					if (targetProfile) {
						console.log('Loading profile from URL parameter (delayed):', targetProfile);
						selectProfile(targetProfile);
					}
				}
			}, 150);
		}

		// Add event listener for the custom show-roast-form event
		window.addEventListener('show-roast-form', showRoastForm);

		// Clean up the event listener when the component is destroyed
		return () => {
			window.removeEventListener('show-roast-form', showRoastForm);
		};
	});

	// Form submission handler for new roast profiles
	async function handleFormSubmit(profileData: any) {
		try {
			// The form now sends data with batch_beans format, use it directly
			const response = await fetch('/api/roast-profiles', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(profileData)
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to create roast profiles');
			}

			const result = await response.json();
			const profiles = result.profiles || result; // Handle both new and legacy response formats

			if (profiles && profiles.length > 0) {
				// Update the selected bean and current profile
				selectedBean = {
					id: profiles[0].coffee_id,
					name: profiles[0].coffee_name
				};

				// First refresh the profiles list
				await loadRoastProfiles();

				// Then find and select the newly created profile
				const newProfile = data.data.find(
					(p: { roast_id: number }) => p.roast_id === profiles[0].roast_id
				);
				if (newProfile) {
					await selectProfile(newProfile);
				}

				isFormVisible = false;

				// Return the result for Artisan file upload (already has roast_ids if using new format)
				return result.roast_ids
					? result
					: {
							roast_ids: profiles.map((p: any) => p.roast_id),
							profiles: profiles
						};
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
			const profile = data.data.find(
				(p: { roast_id: number }) => p.roast_id === updatedProfile.roast_id
			);
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

	async function handleProfileDelete() {
		// Reset state
		currentRoastProfile = null;
		selectedBean = { name: 'No Bean Selected' };
		// Refresh profiles list
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

	// Function to toggle batch expansion
	function toggleBatch(batchName: string) {
		//console.log('Toggling batch:', batchName);
		//console.log('Current expanded batches:', Array.from(expandedBatches));

		// Validate batch name
		if (!batchName || typeof batchName !== 'string') {
			//console.error('Invalid batch name:', batchName);
			return;
		}

		// Ensure the batch exists in the sorted grouped profiles
		if (!sortedGroupedProfiles[batchName]) {
			//console.error('Batch not found in sorted grouped profiles:', batchName);
			//console.log('Available batches:', Object.keys(sortedGroupedProfiles));
			return;
		}

		// Create a new Set to ensure reactivity
		const newExpandedBatches = new Set(expandedBatches);

		// Toggle the batch expansion
		if (newExpandedBatches.has(batchName)) {
			//console.log('Collapsing batch:', batchName);
			newExpandedBatches.delete(batchName);
		} else {
			//console.log('Expanding batch:', batchName);
			newExpandedBatches.add(batchName);
		}

		// Update the state with the new Set
		expandedBatches = newExpandedBatches;
		//console.log('Updated expanded batches:', Array.from(expandedBatches));

		// Force a UI update by triggering a state change
		// This ensures Svelte recognizes the change to the Set
		setTimeout(() => {
			// Create a temporary copy to force reactivity
			const tempSet = new Set(expandedBatches);
			expandedBatches = tempSet;
			//console.log('Batch toggle complete, expanded batches:', Array.from(expandedBatches));
		}, 10);
	}

	// Function to select a profile
	async function selectProfile(profile: any) {
		if (processing) return;

		processing = true;
		try {
			// Find the batch and index of the profile
			const batchName = profile.batch_name || 'Unknown Batch';
			const profiles = sortedGroupedProfiles[batchName] || [];
			const index = profiles.findIndex((p) => p.roast_id === profile.roast_id);

			// Make a copy of the profile to avoid reference issues
			currentRoastProfile = { ...profile };
			currentProfileIndex = index;

			// Update selected bean
			selectedBean = {
				id: profile.coffee_id,
				name: profile.coffee_name
			};

			// Ensure the batch is expanded
			if (!expandedBatches.has(batchName)) {
				expandedBatches.add(batchName);
			}

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
					fan: log.fan_setting,
					bean_temp: log.bean_temp
				}));

				// Convert profile log entries to roast events
				$roastEvents = data.data
					.filter(
						(log: any) =>
							log.start ||
							log.charge ||
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
							: log.charge
								? 'Charge'
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
														: log.end
															? 'Cool End'
															: 'Unknown'
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
		} finally {
			setTimeout(() => {
				processing = false;
			}, 50);
		}
	}

	// Add saveRoastProfile function with comprehensive loading states
	async function saveRoastProfile() {
		// Import the loading store
		const { loadingStore } = await import('$lib/stores/loadingStore');
		const operationId = 'save-roast-profile';

		try {
			// Start loading state
			loadingStore.start(operationId, 'Preparing roast profile...');

			if (!selectedBean?.id) {
				throw new Error(
					'No coffee selected. Please select a coffee before saving the roast profile.'
				);
			}

			if (isRoasting && !isPaused) {
				throw new Error('Please stop the roast before saving.');
			}

			// Prepare the logs with end time before saving
			loadingStore.update(operationId, 'Preparing roast data...');
			const preparedLogs = prepareProfileLogsForSave();

			let profileResponse;
			let profile;

			if (currentRoastProfile?.roast_id) {
				// Update existing profile
				loadingStore.update(operationId, 'Updating roast profile...');
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
				loadingStore.update(operationId, 'Creating new roast profile...');
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
				loadingStore.update(operationId, 'Clearing old roast data...');
				await fetch(`/api/profile-log?roast_id=${currentRoastProfile.roast_id}`, {
					method: 'DELETE'
				});
			}

			// Save new log entries with prepared logs
			loadingStore.update(operationId, 'Saving roast timeline data...');
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
			loadingStore.update(operationId, 'Refreshing profile list...');
			await loadRoastProfiles();
			const savedProfile = data.data.find(
				(p: { roast_id: number }) => p.roast_id === profile.roast_id
			);
			if (savedProfile) {
				loadingStore.update(operationId, 'Loading saved profile...');
				await selectProfile(savedProfile);
			}

			// Complete the loading operation
			loadingStore.complete(operationId);
			alert('Roast profile saved successfully!');
		} catch (error: unknown) {
			// Complete loading even on error
			loadingStore.complete(operationId);
			console.error('Error saving roast profile:', error);
			alert(error instanceof Error ? error.message : 'Failed to save roast profile');
		}
	}

	function showRoastForm() {
		console.log('showRoastForm called with selectedBean:', selectedBean);
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

	// Update this function to handle batch deletion
	async function handleBatchDelete() {
		// Reset state
		currentRoastProfile = null;
		selectedBean = { name: 'No Bean Selected' };
		// Refresh profiles list
		await loadRoastProfiles();
	}
</script>

{#if isFormVisible}
	<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4">
		<div class="w-full max-w-2xl rounded-lg bg-background-secondary-light p-4 shadow-xl sm:p-6">
			<RoastProfileForm {selectedBean} onClose={hideRoastForm} onSubmit={handleFormSubmit} />
		</div>
	</div>
{/if}

<!-- Global Loading Overlay -->
<SimpleLoadingScreen show={false} overlay={true} />

<div class="mx-auto w-full max-w-[100vw] overflow-x-hidden">
	<!-- Current roast profile display -->
	{#if currentRoastProfile}
		<div
			class="mb-3 w-full overflow-x-hidden rounded-lg border border-border-light bg-background-secondary-light p-3 shadow-md"
		>
			<div class="mb-6">
				<RoastProfileDisplay
					profile={currentRoastProfile}
					profiles={currentRoastProfile
						? sortedGroupedProfiles[currentRoastProfile.batch_name] || []
						: []}
					currentIndex={currentProfileIndex}
					onUpdate={handleProfileUpdate}
					onDelete={handleProfileDelete}
					on:profileDeleted={handleProfileDelete}
					on:batchDeleted={handleBatchDelete}
				/>
			</div>

			<!-- Main roasting interface -->
			<div class="mb-6 rounded-lg bg-background-secondary-light p-4">
				{#if chartComponentLoading}
					<div class="flex items-center justify-center p-8">
						<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
						<span class="ml-2 text-sm text-gray-600">Loading chart interface...</span>
					</div>
				{:else if RoastChartInterface}
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
				{/if}
			</div>
		</div>
	{/if}

	<!-- Replace the old table with this component -->
	<div class="w-full">
		<RoastHistoryTable
			{sortedBatchNames}
			{sortedGroupedProfiles}
			{expandedBatches}
			{currentRoastProfile}
			onToggleBatch={toggleBatch}
			onSelectProfile={selectProfile}
		/>
	</div>

	{#if !$filteredData || $filteredData.length === 0}
		<p class="p-4 text-text-primary-light">
			No roast profiles available ({data?.data?.length || 0} items in raw data)
		</p>
	{:else}
		<!-- Existing content -->
	{/if}
</div>
