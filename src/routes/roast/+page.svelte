<script lang="ts">
	// Component imports
	import { onMount } from 'svelte';
	import { prepareDateForAPI } from '$lib/utils/dates';
	// import RoastChart from './RoastChart.svelte';
	import RoastProfileForm from './RoastProfileForm.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		roastData,
		roastEvents,
		startTime,
		accumulatedTime,
		temperatureEntries,
		eventEntries,
		msToSeconds
	} from './stores';

	import RoastProfileTabs from './RoastProfileTabs.svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import RoastPageSkeleton from '$lib/components/RoastPageSkeleton.svelte';
	import SimpleLoadingScreen from '$lib/components/SimpleLoadingScreen.svelte';

	// Lazy load the heavy chart component
	let RoastChartInterface = $state<any>(null);
	let chartComponentLoading = $state(true);

	// Load chart component after initial render
	$effect(() => {
		// Use setTimeout to defer loading until after page renders
		setTimeout(async () => {
			try {
				const module = await import('./RoastChartInterface.svelte');
				RoastChartInterface = module.default;
				chartComponentLoading = false;
			} catch (error) {
				console.error('Failed to load chart component:', error);
				chartComponentLoading = false;
			}
		}, 100); // Small delay to ensure page renders first
	});
	import type { PageData } from './$types';
	import type { RoastProfile, CoffeeCatalog, RoastFormData } from '$lib/types/component.types';
	import type { ComponentType } from 'svelte';

	// Roast profile state management
	let currentRoastProfile = $state<RoastProfile | null>(null);

	// Main state variables
	let isFormVisible = $state(false);
	let selectedBean = $state<{ id?: number; name: string }>({ name: 'No Bean Selected' });
	let isRoasting = $state(false);
	let isPaused = $state(false);
	let fanValue = $state(8);
	let heatValue = $state(1);
	let selectedEvent = $state<string | null>(null);

	// Roast profile state management (removed unused sort variables)

	// Profile grouping and sorting state
	let expandedBatches = $state<Set<string>>(new Set());
	let currentProfileIndex = $state<number>(0);

	// Page data
	let { data = { data: [], role: 'viewer' } } = $props<{ data?: Partial<PageData> }>();

	// Client-side data state
	let clientData = $state<any[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Profile operation errors
	let profileError = $state<string | null>(null);
	let operationInProgress = $state<string | null>(null);

	// Track processing state
	let selectionState = $state({
		processing: false,
		lastSelectedId: null as number | null,
		selectionInProgress: false
	});
	let initialLoadComplete = $state(false);

	// Available coffees for form
	let availableCoffees = $state<CoffeeCatalog[]>([]);
	let coffeesLoading = $state(false);

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

	// Data loading is handled by onMount to avoid race conditions

	// Error handling utilities
	function setProfileError(message: string) {
		profileError = message;
		setTimeout(() => {
			profileError = null;
		}, 5000); // Clear error after 5 seconds
	}

	function clearProfileError() {
		profileError = null;
	}

	function setOperation(operation: string | null) {
		operationInProgress = operation;
	}

	// Unified function to sync data from API and update filter store
	async function syncData() {
		isLoading = true;
		error = null;

		try {
			const response = await fetch('/api/roast-profiles');
			if (!response.ok) {
				throw new Error('Failed to fetch roast profiles');
			}
			const result = await response.json();

			if (result.data && Array.isArray(result.data)) {
				clientData = result.data;
				// Re-initialize FilterStore with fresh data
				const currentRoute = page.url.pathname;
				filterStore.initializeForRoute(currentRoute, clientData);
			}
		} catch (err) {
			console.error('Error syncing roast data:', err);
			error = err instanceof Error ? err.message : 'Failed to load roast data';
		} finally {
			isLoading = false;
		}
	}

	// Derived values for grouped profiles - directly computed from $filteredData
	let sortedGroupedProfiles = $derived(() => {
		if (!$filteredData || $filteredData.length === 0) {
			return {};
		}

		// Group profiles by batch name
		const newGroupedProfiles: Record<string, any[]> = {};

		// Process each profile
		$filteredData.forEach((profile) => {
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

		return newGroupedProfiles;
	});

	let sortedBatchNames = $derived(() => {
		const groupedProfiles = sortedGroupedProfiles();
		const batchNames = Object.keys(groupedProfiles).sort((a, b) => {
			// Get the latest date from each batch
			const latestA = groupedProfiles[a][0]?.roast_date
				? new Date(groupedProfiles[a][0].roast_date)
				: new Date(0);
			const latestB = groupedProfiles[b][0]?.roast_date
				? new Date(groupedProfiles[b][0].roast_date)
				: new Date(0);
			return latestB.getTime() - latestA.getTime();
		});
		return batchNames;
	});

	// Effect to handle first-time expansion of batches
	$effect(() => {
		const batchNames = sortedBatchNames();

		// Only auto-expand if no profile is currently selected and this is truly the first load
		if (
			batchNames.length > 0 &&
			expandedBatches.size === 0 &&
			!initialLoadComplete &&
			!currentRoastProfile &&
			!selectionState.selectionInProgress
		) {
			expandedBatches.add(batchNames[0]);
			initialLoadComplete = true;
		}
	});

	// Update selectedBean when currentRoastProfile changes
	$effect(() => {
		// Only update if we have a profile and we're not in the middle of profile selection
		if (currentRoastProfile && !selectionState.selectionInProgress) {
			// Update selectedBean if it's different
			if (
				!selectedBean ||
				selectedBean.id !== currentRoastProfile.coffee_id ||
				selectedBean.name !== currentRoastProfile.coffee_name
			) {
				selectedBean = {
					id: currentRoastProfile.coffee_id,
					name: currentRoastProfile.coffee_name
				};
			}
		}
	});

	// Remove selectedBean from data object - use URL params for navigation instead

	// Removed the sort effect since it's redundant - the filtered data effect will handle updates

	// Function to fetch available coffees
	async function fetchAvailableCoffees() {
		try {
			coffeesLoading = true;
			const response = await fetch('/api/beans');
			if (response.ok) {
				const result = await response.json();
				// Filter for stocked coffees only
				const stockedCoffees = (result.data || []).filter(
					(coffee: CoffeeCatalog) => coffee.stocked === true
				);
				availableCoffees = stockedCoffees;
			} else {
				console.error('Failed to fetch available coffees');
				availableCoffees = [];
			}
		} catch (error) {
			console.error('Error fetching available coffees:', error);
			availableCoffees = [];
		} finally {
			coffeesLoading = false;
		}
	}

	onMount(() => {
		let shouldShowForm = false;
		let profileIdToLoad: string | null = null;

		// Fetch available coffees immediately on mount
		fetchAvailableCoffees();

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

		// Load roast profiles and handle URL-based profile selection
		syncData().then(() => {
			// Wait a bit for the filter store to process the data
			setTimeout(() => {
				// Only proceed if we have a profileId to load and no profile is currently selected
				if (profileIdToLoad && !currentRoastProfile) {
					const targetProfileId = parseInt(profileIdToLoad);

					// Use filtered data to ensure consistency with the UI
					const filteredProfiles = $filteredData || [];
					let targetProfile = filteredProfiles.find(
						(p: { roast_id: number }) => p.roast_id === targetProfileId
					);

					// Fallback to client data if not found in filtered data
					if (!targetProfile && clientData.length > 0) {
						targetProfile = clientData.find(
							(p: { roast_id: number }) => p.roast_id === targetProfileId
						);
					}

					if (targetProfile) {
						console.log('Loading profile from URL parameter:', targetProfile);
						selectProfile(targetProfile);
					} else {
						console.warn(`Profile with ID ${profileIdToLoad} not found in available data`);
					}
				}
			}, 100); // Small delay to ensure filter store is ready
		});

		// Add event listener for the custom show-roast-form event
		window.addEventListener('show-roast-form', showRoastForm);

		// Clean up the event listener when the component is destroyed
		return () => {
			window.removeEventListener('show-roast-form', showRoastForm);
		};
	});

	// Form submission handler for new roast profiles
	async function handleFormSubmit(profileData: RoastFormData) {
		setOperation('Creating roast profile...');
		clearProfileError();

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

			// Close form immediately on successful response
			isFormVisible = false;

			// Refresh data to get updated profiles
			await syncData();

			if (profiles && profiles.length > 0) {
				// Update the selected bean and current profile
				selectedBean = {
					id: profiles[0].coffee_id,
					name: profiles[0].coffee_name
				};

				// First refresh the profiles list
				await syncData();

				// Then find and select the newly created profile
				const newProfile = (data?.data || []).find(
					(p: { roast_id: number }) => p.roast_id === profiles[0].roast_id
				);
				if (newProfile) {
					await selectProfile(newProfile);
				}

				// Return the result for Artisan file upload (already has roast_ids if using new format)
				return result.roast_ids
					? result
					: {
							roast_ids: profiles.map((p: RoastProfile) => p.roast_id),
							profiles: profiles
						};
			} else {
				throw new Error('No profiles were created');
			}
		} catch (error: unknown) {
			console.error('Error creating roast profiles:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to create roast profiles');
		} finally {
			setOperation(null);
		}
	}

	// Update the fan control handler
	function updateFan(value: number) {
		fanValue = value;
		if ($startTime === null || !currentRoastProfile?.roast_id) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		// Add control event to normalized structure
		const timeSeconds = msToSeconds(currentTime);
		const controlEvent = {
			roast_id: currentRoastProfile.roast_id,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: value.toString(),
			event_string: 'fan_setting',
			category: 'control' as const,
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		};

		$eventEntries = [...$eventEntries, controlEvent];
	}

	// Update the heat control handler
	function updateHeat(value: number) {
		heatValue = value;
		if ($startTime === null || !currentRoastProfile?.roast_id) return;

		const currentTime = isPaused
			? $accumulatedTime
			: performance.now() - $startTime + $accumulatedTime;

		// Add control event to normalized structure
		const timeSeconds = msToSeconds(currentTime);
		const controlEvent = {
			roast_id: currentRoastProfile.roast_id,
			time_seconds: timeSeconds,
			event_type: 1,
			event_value: value.toString(),
			event_string: 'heat_setting',
			category: 'control' as const,
			subcategory: 'machine_setting',
			user_generated: true,
			automatic: false
		};

		$eventEntries = [...$eventEntries, controlEvent];
	}

	// Profile management handlers
	async function handleProfileUpdate(updatedProfile: RoastProfile) {
		setOperation('Updating profile...');
		clearProfileError();

		try {
			await syncData(); // Refresh the profiles list first
			const profile = (data?.data || []).find(
				(p: { roast_id: number }) => p.roast_id === updatedProfile.roast_id
			);
			if (profile) {
				await selectProfile(profile);
			} else {
				throw new Error('Updated profile not found in refreshed data');
			}
		} catch (error) {
			console.error('Error updating profile:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to update roast profile');
		} finally {
			setOperation(null);
		}
	}

	async function handleProfileDelete() {
		// Reset state
		currentRoastProfile = null;
		selectedBean = { name: 'No Bean Selected' };
		// Refresh profiles list
		await syncData();
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
		if (!sortedGroupedProfiles()[batchName]) {
			//console.error('Batch not found in sorted grouped profiles:', batchName);
			//console.log('Available batches:', Object.keys(sortedGroupedProfiles()));
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

		// Force reactivity by reassigning the Set
		expandedBatches = new Set(expandedBatches);
	}

	// Function to select a profile
	async function selectProfile(profile: RoastProfile) {
		// Prevent concurrent calls and duplicate selections
		if (selectionState.processing || selectionState.selectionInProgress) {
			console.log('Profile selection already in progress, skipping');
			return;
		}

		// Check if we're trying to select the same profile again
		if (selectionState.lastSelectedId === profile.roast_id) {
			console.log('Profile already selected, skipping');
			return;
		}

		// Defensive check: ensure profile has required data
		if (!profile || !profile.roast_id) {
			console.error('Invalid profile provided to selectProfile:', profile);
			return;
		}

		selectionState.selectionInProgress = true;
		selectionState.processing = true;

		try {
			console.log('Selecting profile:', profile.roast_id, profile.coffee_name);

			// Find the batch and index of the profile - with fallback for data consistency
			const batchName = profile.batch_name || 'Unknown Batch';
			const groupedProfiles = sortedGroupedProfiles();
			const profiles = groupedProfiles[batchName] || [];
			const index = profiles.findIndex((p) => p.roast_id === profile.roast_id);

			// If not found in grouped profiles, it might be a timing issue
			if (index === -1) {
				console.warn('Profile not found in grouped profiles, using index 0 as fallback');
			}

			// Make a copy of the profile to avoid reference issues
			currentRoastProfile = { ...profile };
			currentProfileIndex = Math.max(0, index);
			selectionState.lastSelectedId = profile.roast_id;

			// Update selected bean
			selectedBean = {
				id: profile.coffee_id,
				name: profile.coffee_name
			};

			// Ensure the batch is expanded
			if (!expandedBatches.has(batchName)) {
				expandedBatches.add(batchName);
				// Force reactivity by reassigning the Set
				expandedBatches = new Set(expandedBatches);
			}

			// Reset roasting state
			isRoasting = false;
			isPaused = false;

			// Update URL to reflect the selected profile
			const currentUrl = new URL(window.location.href);
			currentUrl.searchParams.set('profileId', profile.roast_id.toString());
			goto(currentUrl.pathname + '?' + currentUrl.searchParams.toString(), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});

			// Clear live roasting state when switching to saved profile
			$temperatureEntries = [];
			$eventEntries = [];
			$roastData = [];
			$roastEvents = [];
			$startTime = null;
			$accumulatedTime = 0;

			console.log('Profile selection completed successfully');
		} catch (error) {
			console.error('Error selecting profile:', error);
			setProfileError(
				'Failed to load profile data: ' + (error instanceof Error ? error.message : 'Unknown error')
			);
		} finally {
			// Add a small delay to prevent rapid-fire clicks
			setTimeout(() => {
				selectionState.processing = false;
				selectionState.selectionInProgress = false;
			}, 100);
		}
	}

	// Simplified save function using normalized data structure
	async function saveRoastProfile() {
		setOperation('Saving roast profile...');
		clearProfileError();

		try {
			if (!selectedBean?.id) {
				throw new Error(
					'No coffee selected. Please select a coffee before saving the roast profile.'
				);
			}

			if (isRoasting && !isPaused) {
				throw new Error('Please stop the roast before saving.');
			}

			// Ensure we have a roast profile
			let roastId: number;
			if (currentRoastProfile?.roast_id) {
				roastId = currentRoastProfile.roast_id;
			} else {
				// Create new profile first
				const profileResponse = await fetch('/api/roast-profiles', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						batch_name: `${selectedBean.name} - ${new Date().toLocaleDateString()}`,
						coffee_id: selectedBean.id,
						coffee_name: selectedBean.name,
						roast_date: new Date(),
						last_updated: new Date()
					})
				});

				if (!profileResponse.ok) {
					const errorData = await profileResponse.json();
					throw new Error(errorData.error || 'Failed to save roast profile');
				}

				const profile = await profileResponse.json();
				const actualProfile = Array.isArray(profile) ? profile[0] : profile;
				roastId = actualProfile.roast_id;
				currentRoastProfile = actualProfile;
			}

			// Note: Roast event data is now saved directly during roasting process
			// Legacy data clearing/saving removed - clean slate implementation

			// For active roasting sessions, avoid full data sync that clears state
			if (isRoasting || isPaused) {
				// Just update the current profile with the saved roast_id
				if (currentRoastProfile) {
					currentRoastProfile.roast_id = roastId;
				}
			} else {
				// Only sync data and reload profile if not actively roasting
				await syncData();
				const savedProfile = (data?.data || []).find(
					(p: { roast_id: number }) => p.roast_id === roastId
				);
				if (savedProfile) {
					await selectProfile(savedProfile);
				}
			}

			// Success - no alert needed, just clear any errors
			clearProfileError();
		} catch (error: unknown) {
			console.error('Error saving roast profile:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to save roast profile');
		} finally {
			setOperation(null);
		}
	}

	function showRoastForm() {
		console.log('showRoastForm called with selectedBean:', selectedBean);
		// Coffee data is already fetched on mount, just show the form
		// Only fetch again if we don't have any coffees loaded
		if (availableCoffees.length === 0 && !coffeesLoading) {
			fetchAvailableCoffees();
		}
		isFormVisible = true;
	}

	function hideRoastForm() {
		isFormVisible = false;
	}

	async function handleClearRoastData() {
		setOperation('Clearing roast data...');
		clearProfileError();

		try {
			if (!currentRoastProfile) {
				throw new Error('No roast profile selected');
			}
			const response = await fetch(`/api/clear-roast?roast_id=${currentRoastProfile.roast_id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to clear roast data');
			}

			const result = await response.json();
			console.log('Clear roast result:', result);

			// Clear data successful - reload the profile
			if (currentRoastProfile) {
				await selectProfile(currentRoastProfile); // Reload the profile
			}
			clearProfileError();
		} catch (error) {
			console.error('Error clearing roast data:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to clear roast data');
		} finally {
			setOperation(null);
		}
	}

	// Update this function to handle batch deletion
	async function handleBatchDelete() {
		// Reset state
		currentRoastProfile = null;
		selectedBean = { name: 'No Bean Selected' };
		selectionState.lastSelectedId = null;

		// Clear URL parameter for deleted profile
		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete('profileId');
		goto(
			currentUrl.pathname +
				(currentUrl.searchParams.toString() ? '?' + currentUrl.searchParams.toString() : ''),
			{
				replaceState: true,
				keepFocus: true,
				noScroll: true
			}
		);

		// Refresh both server data and client data
		await syncData();
	}

	// Function to clear the current profile (for Browse Profiles tab)
	function handleClearProfile() {
		currentRoastProfile = null;
		selectedBean = { name: 'No Bean Selected' };
		selectionState.lastSelectedId = null;

		// Clear roasting state
		isRoasting = false;
		isPaused = false;

		// Clear live roasting data
		$temperatureEntries = [];
		$eventEntries = [];
		$roastData = [];
		$roastEvents = [];
		$startTime = null;
		$accumulatedTime = 0;

		// Clear URL params
		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete('profileId');
		goto(currentUrl.pathname, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

{#if isFormVisible}
	<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 p-4">
		<div class="w-full max-w-2xl rounded-lg bg-background-secondary-light p-4 shadow-xl sm:p-6">
			<RoastProfileForm
				{selectedBean}
				{availableCoffees}
				onClose={hideRoastForm}
				onSubmit={handleFormSubmit}
			/>
		</div>
	</div>
{/if}

<!-- Global Loading Overlay -->
<SimpleLoadingScreen show={false} overlay={true} />

<!-- Profile Operation Status -->
{#if operationInProgress}
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-blue-50 p-4 ring-1 ring-blue-200">
		<div class="flex items-center">
			<div
				class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
			></div>
			<span class="text-sm font-medium text-blue-900">{operationInProgress}</span>
		</div>
	</div>
{/if}

<!-- Profile Operation Error -->
{#if profileError}
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-red-50 p-4 ring-1 ring-red-200">
		<div class="flex items-start">
			<div class="mr-3 mt-0.5 h-4 w-4 text-red-500">⚠️</div>
			<div class="flex-1">
				<p class="text-sm font-medium text-red-900">Operation Failed</p>
				<p class="text-sm text-red-700">{profileError}</p>
			</div>
			<button
				onclick={() => clearProfileError()}
				class="ml-2 rounded-md bg-red-100 p-1 text-red-500 hover:bg-red-200"
			>
				×
			</button>
		</div>
	</div>
{/if}

{#if isLoading}
	<RoastPageSkeleton />
{:else if error}
	<!-- Error state -->
	<div class="rounded-lg bg-red-50 p-6 text-center ring-1 ring-red-200">
		<div class="mb-4 text-6xl opacity-50">⚠️</div>
		<h3 class="mb-2 text-lg font-semibold text-red-900">Failed to load data</h3>
		<p class="mb-4 text-red-700">{error}</p>
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<button
				onclick={async () => {
					error = null;
					await syncData();
				}}
				class="rounded-md bg-red-600 px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
			>
				Try Again
			</button>
			<button
				onclick={() => window.location.reload()}
				class="rounded-md border border-red-600 px-4 py-2 font-medium text-red-600 transition-all duration-200 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
			>
				Reload Page
			</button>
		</div>
	</div>
{:else}
	<!-- New Tab-Based Interface -->
	<RoastProfileTabs
		sortedBatchNames={sortedBatchNames()}
		sortedGroupedProfiles={sortedGroupedProfiles()}
		{expandedBatches}
		{currentRoastProfile}
		{currentProfileIndex}
		{chartComponentLoading}
		{RoastChartInterface}
		onToggleBatch={toggleBatch}
		onSelectProfile={selectProfile}
		onProfileUpdate={handleProfileUpdate}
		onProfileDelete={handleProfileDelete}
		onBatchDelete={handleBatchDelete}
		onClearProfile={handleClearProfile}
		{selectedBean}
		bind:isPaused
		bind:fanValue
		bind:heatValue
		bind:isRoasting
		bind:selectedEvent
		{updateFan}
		{updateHeat}
		{saveRoastProfile}
		clearRoastData={() => handleClearRoastData()}
	/>

	{#if !$filteredData || $filteredData.length === 0}
		<p class="p-4 text-text-primary-light">
			No roast profiles available ({data?.data?.length || 0} items in raw data)
		</p>
	{/if}
{/if}
