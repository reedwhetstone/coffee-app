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
		temperatureEntries,
		eventEntries,
		controlChanges,
		msToSeconds,
		secondsToMs
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

		const controlPoint = {
			time: currentTime,
			heat: heatValue,
			fan: value
		};

		// Add to live visualization data (for chart rendering)
		$roastData = [...$roastData, controlPoint];

		// Add to control changes (for backend persistence)
		$controlChanges = [...$controlChanges, controlPoint];
	}

	// Update the heat control handler to work even before roasting starts
	function updateHeat(value: number) {
		heatValue = value;
		if ($startTime === null) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		const controlPoint = {
			time: currentTime,
			heat: value,
			fan: fanValue
		};

		// Add to live visualization data (for chart rendering)
		$roastData = [...$roastData, controlPoint];

		// Add to control changes (for backend persistence)
		$controlChanges = [...$controlChanges, controlPoint];
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

			// Fetch and load roast data using new API structure
			const response = await fetch(`/api/profile-log?roast_id=${profile.roast_id}`);
			if (!response.ok) {
				throw new Error('Failed to fetch roast data');
			}

			const data = await response.json();

			if (data.data.length > 0) {
				// Convert response data to roast data points
				$roastData = data.data.map((entry: any) => {
					const timeInMs = entry.time_seconds ? secondsToMs(entry.time_seconds) : 0;

					return {
						time: timeInMs,
						heat: entry.heat_setting || 0,
						fan: entry.fan_setting || 0,
						bean_temp: entry.bean_temp,
						environmental_temp: entry.environmental_temp,
						ambient_temp: entry.ambient_temp,
						ror_bean_temp: entry.ror_bean_temp,
						data_source: entry.data_source,
						// Include milestone flags for charge detection
						charge: entry.charge || false,
						start: entry.start || false,
						maillard: entry.maillard || false,
						fc_start: entry.fc_start || false,
						drop: entry.drop || false,
						end: entry.end || false
					};
				});

				// Convert to roast events for chart display
				$roastEvents = data.data
					.filter(
						(entry: any) =>
							entry.start ||
							entry.charge ||
							entry.maillard ||
							entry.fc_start ||
							entry.fc_rolling ||
							entry.fc_end ||
							entry.sc_start ||
							entry.drop ||
							entry.end
					)
					.map((entry: any) => {
						const timeInMs = entry.time_seconds ? secondsToMs(entry.time_seconds) : 0;

						let eventName = 'Unknown';
						if (entry.start) eventName = 'Start';
						else if (entry.charge) eventName = 'Charge';
						else if (entry.maillard) eventName = 'Maillard';
						else if (entry.fc_start) eventName = 'FC Start';
						else if (entry.fc_rolling) eventName = 'FC Rolling';
						else if (entry.fc_end) eventName = 'FC End';
						else if (entry.sc_start) eventName = 'SC Start';
						else if (entry.drop) eventName = 'Drop';
						else if (entry.end) eventName = 'Cool End';

						return { time: timeInMs, name: eventName };
					});
			} else {
				// Clear all data for new roast
				$roastData = [];
				$roastEvents = [];
				$temperatureEntries = [];
				$eventEntries = [];
				$controlChanges = [];
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
			const preparedLogs = prepareRoastDataForSave();

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

			// Handle API response format - single profile creation returns an array
			const actualProfile = Array.isArray(profile) ? profile[0] : profile;

			if (!actualProfile || !actualProfile.roast_id) {
				console.error('No valid profile with roast_id in response:', profile);
				throw new Error('Failed to get roast_id from profile creation');
			}

			const roastId = actualProfile.roast_id;

			// Delete existing log entries if updating
			if (currentRoastProfile?.roast_id) {
				loadingStore.update(operationId, 'Clearing old roast data...');
				await fetch(`/api/profile-log?roast_id=${currentRoastProfile.roast_id}`, {
					method: 'DELETE'
				});
			}

			// Save new roast data with temperature and event entries
			loadingStore.update(operationId, 'Saving roast data...');

			// Convert control changes to the format expected by the API (only meaningful changes, not every-second data)
			const logEntries = $controlChanges.map((point, index) => {
				const timeSeconds = msToSeconds(point.time);

				// Find events at this time point
				const eventsAtTime = $roastEvents.filter(
					(event) => Math.abs(event.time - point.time) < 1000 // Within 1 second
				);

				return {
					roast_id: roastId,
					time_seconds: timeSeconds,
					fan_setting: point.fan || 0,
					heat_setting: point.heat || 0,
					bean_temp: point.bean_temp,
					environmental_temp: point.environmental_temp,
					ambient_temp: point.ambient_temp,
					// Convert events back to boolean flags for API compatibility
					start: eventsAtTime.some((e) => e.name === 'Start'),
					charge: eventsAtTime.some((e) => e.name === 'Charge'),
					maillard: eventsAtTime.some((e) => e.name === 'Maillard'),
					fc_start: eventsAtTime.some((e) => e.name === 'FC Start'),
					fc_rolling: eventsAtTime.some((e) => e.name === 'FC Rolling'),
					fc_end: eventsAtTime.some((e) => e.name === 'FC End'),
					sc_start: eventsAtTime.some((e) => e.name === 'SC Start'),
					drop: eventsAtTime.some((e) => e.name === 'Drop'),
					end: eventsAtTime.some((e) => e.name === 'Cool End')
				};
			});

			const logResponse = await fetch('/api/profile-log', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(logEntries)
			});

			if (!logResponse.ok) {
				const errorData = await logResponse.json();
				throw new Error(errorData.error || 'Failed to save roast data');
			}

			// Reload profiles and select the saved one
			loadingStore.update(operationId, 'Refreshing profile list...');
			await loadRoastProfiles();
			const savedProfile = data.data.find((p: { roast_id: number }) => p.roast_id === roastId);
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

	function prepareRoastDataForSave() {
		if ($controlChanges.length === 0) return [];

		const lastTime = $roastData[$roastData.length - 1]?.time || 0;

		// Check if we need to add an end event
		const hasDropEvent = $roastEvents.some((e) => e.name === 'Drop');
		const hasEndEvent = $roastEvents.some((e) => e.name === 'Cool End');

		if (hasDropEvent && !hasEndEvent) {
			// Add end event
			$roastEvents = [
				...$roastEvents,
				{
					time: lastTime,
					name: 'Cool End'
				}
			];
		}

		return $controlChanges;
	}

	async function handleClearRoastData(roastId: number) {
		try {
			const response = await fetch(`/api/clear-roast?roast_id=${currentRoastProfile.roast_id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to clear roast data');
			}

			const result = await response.json();
			console.log('Clear roast result:', result);

			// Show success message with details
			alert(`Successfully cleared roast data: ${result.message}`);

			await selectProfile(currentRoastProfile); // Reload the profile
		} catch (error) {
			console.error('Error clearing roast data:', error);
			alert(error instanceof Error ? error.message : 'Failed to clear roast data');
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
						clearRoastData={() => handleClearRoastData(currentRoastProfile.roast_id)}
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
