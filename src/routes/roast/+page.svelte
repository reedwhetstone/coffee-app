<script lang="ts">
	// Component imports
	import { onMount } from 'svelte';

	// import RoastChart from './RoastChart.svelte';
	import RoastProfileForm from './RoastProfileForm.svelte';
	import FormShell from '$lib/components/FormShell.svelte';
	import MetricTile from '$lib/components/ui/MetricTile.svelte';
	import OperationsHero from '$lib/components/ui/OperationsHero.svelte';
	import { canUseMallardControls } from '$lib/services/portfolioAccess';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { roastData, roastEvents, temperatureEntries, eventEntries, msToSeconds } from './stores';
	import { createRoastTimer } from '$lib/roast';

	import RoastProfileTabs from './RoastProfileTabs.svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';

	// Cast filtered data to the correct type for this page
	let typedFilteredData = $derived($filteredData as unknown as RoastProfile[]);
	import RoastPageSkeleton from '$lib/components/RoastPageSkeleton.svelte';
	import SimpleLoadingScreen from '$lib/components/SimpleLoadingScreen.svelte';

	// Lazy load the heavy chart component
	import type { ComponentType } from 'svelte';
	let RoastChartInterface = $state<ComponentType | null>(null);
	let chartComponentLoading = $state(true);

	// Load chart component after initial render
	$effect(() => {
		// Use setTimeout to defer loading until after page renders
		setTimeout(async () => {
			try {
				const module = await import('./RoastChartInterface.svelte');
				RoastChartInterface = module.default as unknown as ComponentType;
				chartComponentLoading = false;
			} catch (error) {
				console.error('Failed to load chart component:', error);
				chartComponentLoading = false;
			}
		}, 100); // Small delay to ensure page renders first
	});
	import type { PageData } from './$types';
	import type { RoastProfile, CoffeeCatalog, RoastFormData } from '$lib/types/component.types';

	// Roast profile state management
	let currentRoastProfile = $state<RoastProfile | null>(null);

	// Page data
	let { data = { data: [], role: 'viewer' } } = $props<{ data?: Partial<PageData> }>();
	let canCreateRoastProfiles = $derived(canUseMallardControls(data?.role ?? 'viewer'));

	// Main state variables
	let isFormVisible = $derived(
		canCreateRoastProfiles && page.url.searchParams.get('modal') === 'new'
	);
	let selectedBean = $state<{ id?: number; name: string }>({ name: 'No Bean Selected' });
	const timer = createRoastTimer();
	let isRoasting = $derived(!timer.isIdle);
	let isPaused = $derived(timer.isPaused);
	let fanValue = $state(8);
	let heatValue = $state(1);
	let selectedEvent = $state<string | null>(null);

	// Roast profile state management (removed unused sort variables)

	// Profile grouping and sorting state
	let expandedBatches = $state<Set<string>>(new Set());
	let currentProfileIndex = $state<number>(0);

	// Client-side data state
	let clientData = $state<RoastProfile[]>([]);
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

	// Fetch form coffees reactively when the form becomes visible
	$effect(() => {
		if (isFormVisible) {
			ensureFormCoffees();
		}
	});

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

	// Single source of truth for reloading a profile after any mutation.
	// Syncs fresh data from the API and re-selects the profile so the chart
	// reloads from the database (input mode → display mode transition).
	async function reloadProfile(roastId: number): Promise<RoastProfile | null> {
		await syncData();
		const profile = clientData.find((p) => p.roast_id === roastId);
		if (!profile) return null;

		// Reset the selection guard so selectProfile actually runs even if
		// we're re-selecting the same profile (the whole point of a reload).
		selectionState.lastSelectedId = null;
		await selectProfile(profile);
		return profile;
	}

	// Derived values for grouped profiles - directly computed from typedFilteredData
	let sortedGroupedProfiles = $derived(() => {
		if (!typedFilteredData || typedFilteredData.length === 0) {
			return {};
		}

		// Group profiles by batch name + roast date.
		// Same batch name on different days = different batch.
		const newGroupedProfiles: Record<string, RoastProfile[]> = {};

		// Process each profile
		typedFilteredData.forEach((profile) => {
			const name = profile.batch_name || 'Unknown Batch';
			const date = profile.roast_date ? profile.roast_date.split('T')[0] : 'unknown';
			const batchKey = `${name}|||${date}`;
			if (!newGroupedProfiles[batchKey]) {
				newGroupedProfiles[batchKey] = [];
			}
			newGroupedProfiles[batchKey].push(profile);
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

	let roastSummary = $derived.by(() => {
		const profiles = typedFilteredData ?? [];
		const batches = sortedBatchNames();
		const completedProfiles = profiles.filter(
			(profile) =>
				(profile.weight_loss_percent ?? 0) > 0 ||
				(profile.oz_in ?? 0) > 0 ||
				(profile.oz_out ?? 0) > 0
		);
		const profilesWithLossData = profiles.filter(
			(profile) => profile.weight_loss_percent !== null && profile.weight_loss_percent !== undefined
		);
		const avgLoss =
			profilesWithLossData.length > 0
				? profilesWithLossData.reduce(
						(sum, profile) => sum + (Number(profile.weight_loss_percent) || 0),
						0
					) / profilesWithLossData.length
				: 0;

		return {
			profiles: profiles.length,
			batches: batches.length,
			completedProfiles: completedProfiles.length,
			avgLoss
		};
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

	async function ensureFormCoffees() {
		if (availableCoffees.length > 0 || coffeesLoading) return;
		coffeesLoading = true;
		try {
			const response = await fetch('/api/beans');
			if (response.ok) {
				const result = await response.json();
				availableCoffees = (result.data || []).filter(
					(coffee: CoffeeCatalog) => coffee.stocked === true
				);
			}
		} catch (err) {
			console.error('Error fetching available coffees:', err);
			availableCoffees = [];
		} finally {
			coffeesLoading = false;
		}
	}

	onMount(() => {
		// Check URL params for pre-selected bean — always takes priority regardless of
		// currentRoastProfile so navigating from a bean profile always pre-fills the form.
		const beanId = page.url.searchParams.get('beanId');
		const beanName = page.url.searchParams.get('beanName');

		if (beanId) {
			const decodedName = beanName ? decodeURIComponent(beanName) : null;
			if (!decodedName || decodedName === 'undefined') {
				console.warn(
					`[RoastPage] beanId=${beanId} present in URL but beanName is missing or "undefined". ` +
						'The bean name could not be pre-filled. Check the navigation source.'
				);
			}
			selectedBean = {
				id: parseInt(beanId),
				name: decodedName && decodedName !== 'undefined' ? decodedName : 'No Bean Selected'
			};
		}

		// Load roast profiles and handle URL-based profile selection
		syncData().then(() => {
			setTimeout(() => {
				const profileIdParam = page.url.searchParams.get('profileId');
				if (profileIdParam && !currentRoastProfile) {
					const targetProfileId = parseInt(profileIdParam);
					const filteredProfiles = typedFilteredData || [];
					let targetProfile = filteredProfiles.find((p) => p.roast_id === targetProfileId);
					if (!targetProfile && clientData.length > 0) {
						targetProfile = clientData.find((p) => p.roast_id === targetProfileId);
					}
					if (targetProfile) {
						selectProfile(targetProfile);
					}
				}
			}, 100);
		});
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
			hideRoastForm();

			if (profiles && profiles.length > 0) {
				// Update the selected bean and current profile
				selectedBean = {
					id: profiles[0].coffee_id,
					name: profiles[0].coffee_name
				};

				// Reload fresh data and re-select the new profile
				await reloadProfile(profiles[0].roast_id);

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
		if (timer.isIdle || !currentRoastProfile?.roast_id) return;

		const currentTime = timer.elapsed;

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
		if (timer.isIdle || !currentRoastProfile?.roast_id) return;

		const currentTime = timer.elapsed;

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
			const profile = await reloadProfile(updatedProfile.roast_id);
			if (!profile) {
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

			// Find the batch key containing this profile (keys are composite name|||date)
			const groupedProfiles = sortedGroupedProfiles();
			const batchKey =
				Object.keys(groupedProfiles).find((key) =>
					groupedProfiles[key]?.some((p) => p.roast_id === profile.roast_id)
				) || '';
			const profiles = groupedProfiles[batchKey] || [];
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
			if (batchKey && !expandedBatches.has(batchKey)) {
				expandedBatches.add(batchKey);
				// Force reactivity by reassigning the Set
				expandedBatches = new Set(expandedBatches);
			}

			// Reset roasting state
			timer.reset();

			// Update URL to reflect the selected profile
			const currentUrl = new URL(window.location.href);
			currentUrl.searchParams.set('profileId', profile.roast_id.toString());
			goto(currentUrl.pathname + '?' + currentUrl.searchParams.toString(), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});

			// Clear live roasting data when switching to saved profile
			$temperatureEntries = [];
			$eventEntries = [];
			$roastData = [];
			$roastEvents = [];

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

			// Persist temperature + event data to the database via PUT
			const temps = $temperatureEntries;
			const events = $eventEntries;

			if (temps.length > 0 || events.length > 0) {
				// Map entries to use correct roast_id (stores may have roast_id: 0 before profile creation)
				const mappedTemps = temps.map((t) => ({ ...t, roast_id: roastId }));
				const mappedEvents = events.map((e) => ({ ...e, roast_id: roastId }));

				const putResponse = await fetch(`/api/roast-profiles?id=${roastId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						temperatureEntries: mappedTemps,
						eventEntries: mappedEvents,
						last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
					})
				});

				if (!putResponse.ok) {
					const errorData = await putResponse.json();
					throw new Error(errorData.error || 'Failed to save roast data');
				}
			}

			// Save marks completion — always reload to switch to display mode
			await reloadProfile(roastId);

			// Success - no alert needed, just clear any errors
			clearProfileError();
		} catch (error: unknown) {
			console.error('Error saving roast profile:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to save roast profile');
		} finally {
			setOperation(null);
		}
	}

	function hideRoastForm() {
		const url = new URL(page.url);
		url.searchParams.delete('modal');
		url.searchParams.delete('beanId');
		url.searchParams.delete('beanName');
		const search = url.searchParams.toString();
		goto(url.pathname + (search ? '?' + search : ''), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
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
		timer.reset();

		// Clear live roasting data
		$temperatureEntries = [];
		$eventEntries = [];
		$roastData = [];
		$roastEvents = [];

		// Clear URL params
		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete('profileId');
		goto(currentUrl.pathname, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<FormShell visible={isFormVisible} maxWidth="max-w-4xl">
	<RoastProfileForm
		{selectedBean}
		{availableCoffees}
		onClose={hideRoastForm}
		onSubmit={handleFormSubmit}
	/>
</FormShell>

<!-- Global Loading Overlay -->
<SimpleLoadingScreen show={false} overlay={true} />

<!-- Profile Operation Status -->
{#if operationInProgress}
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-info-subtle p-4 ring-1 ring-info/30">
		<div class="flex items-center">
			<div
				class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-info border-t-transparent"
			></div>
			<span class="text-sm font-medium text-info-strong">{operationInProgress}</span>
		</div>
	</div>
{/if}

<!-- Profile Operation Error -->
{#if profileError}
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-danger-subtle p-4 ring-1 ring-danger/30">
		<div class="flex items-start">
			<svg
				class="mr-3 mt-0.5 h-4 w-4 shrink-0 text-danger"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
				/>
			</svg>
			<div class="flex-1">
				<p class="text-sm font-medium text-danger-strong">Operation failed</p>
				<p class="text-sm text-danger">{profileError}</p>
			</div>
			<button
				onclick={() => clearProfileError()}
				class="ml-2 rounded-md bg-danger-subtle p-1 text-danger hover:bg-danger/15"
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
	<div class="rounded-lg bg-danger-subtle p-6 text-center ring-1 ring-danger/30">
		<svg
			class="mx-auto mb-4 h-12 w-12 text-danger opacity-70"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
			/>
		</svg>
		<h3 class="mb-2 text-lg font-semibold text-danger-strong">Failed to load data</h3>
		<p class="mb-4 text-danger">{error}</p>
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<button
				onclick={async () => {
					error = null;
					await syncData();
				}}
				class="rounded-md bg-danger px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-danger-strong focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
			>
				Try again
			</button>
			<button
				onclick={() => window.location.reload()}
				class="rounded-md border border-danger px-4 py-2 font-medium text-danger transition-all duration-200 hover:bg-danger hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
			>
				Reload page
			</button>
		</div>
	</div>
{:else}
	<!-- New Tab-Based Interface -->
	<div class="mb-6 space-y-4">
		<OperationsHero
			kicker="Mallard Studio"
			title="Roast studio"
			description="Run profile logging, batch review, and live roast capture from one focused workspace that keeps production decisions tied to the coffees in portfolio."
			contextLabel="Selected coffee"
			contextValue={currentRoastProfile?.coffee_name ?? selectedBean.name}
			primaryLabel={canCreateRoastProfiles ? 'New roast profile' : ''}
			primaryHref={canCreateRoastProfiles ? '/roast?modal=new' : ''}
			secondaryLabel="Portfolio"
			secondaryHref="/beans"
		/>

		<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<MetricTile
				label="Roast profiles"
				value={roastSummary.profiles}
				detail="Profiles in the current filter set"
				tone="accent"
			/>
			<MetricTile
				label="Batches"
				value={roastSummary.batches}
				detail="Grouped by batch name and roast date"
			/>
			<MetricTile
				label="Logged roasts"
				value={roastSummary.completedProfiles}
				detail="Profiles with recorded roast data"
				tone="success"
			/>
			<MetricTile
				label="Average loss"
				value={`${roastSummary.avgLoss.toFixed(1)}%`}
				detail="Across profiles with weight loss data"
				tone="warning"
			/>
		</div>
	</div>

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
		{timer}
		bind:fanValue
		bind:heatValue
		bind:selectedEvent
		{updateFan}
		{updateHeat}
		{saveRoastProfile}
		clearRoastData={() => handleClearRoastData()}
	/>

	{#if !$filteredData || $filteredData.length === 0}
		<p class="p-4 text-ink">
			No roast profiles available ({data?.data?.length || 0} items in raw data)
		</p>
	{/if}
{/if}
