<script lang="ts">
	// Component imports
	import { onMount, untrack } from 'svelte';

	// import RoastChart from './RoastChart.svelte';
	import RoastProfileForm from './RoastProfileForm.svelte';
	import FormShell from '$lib/components/FormShell.svelte';
	import { canUseMallardControls } from '$lib/services/portfolioAccess';

	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { roastData, roastEvents, temperatureEntries, eventEntries, msToSeconds } from './stores';
	import { createRoastTimer } from '$lib/roast';
	import { roastCountLine } from '$lib/roast/roast-summary';
	import { readOpenRoastId } from '$lib/roast/compare-sides';
	import { coffeeFilterName } from '$lib/roast/coffee-links';
	import {
		batchLabel,
		deleteBatchConfirmation,
		groupRoastsByBatch,
		parseBatchId,
		readBatchFilter,
		roastListHref
	} from '$lib/roast/roast-batches';
	import {
		hasRoastListFilters,
		isLastRoastPage,
		NO_ROAST_LIST_FILTERS,
		readRoastListFilters,
		roastListEmptyDetail,
		roastListFilterKey,
		roastListQuery,
		ROAST_PAGE_SIZE,
		writeRoastListFilters,
		type RoastListFilters
	} from '$lib/roast/roast-list-filters';
	import {
		mergeRoasts,
		requestBatchRoasts,
		requestRoast,
		requestRoasts,
		RoastListRequestError,
		type RoastListTotals
	} from '$lib/roast/roast-list-loader';
	import { roastCoffeeOptions } from '$lib/roast/roast-coffee-options';
	import { saveRoastAsReference } from '$lib/roast/save-reference';
	import {
		ARTISAN_BACKGROUND_STEPS,
		downloadFile,
		roastFileHref,
		roastFileReasonCopy
	} from '$lib/roast/artisan-download';
	import { savedHref } from '$lib/roast/saved-library';
	import { trackProfileStudioActivation } from '$lib/profileStudio/analytics';
	import {
		clearRoastCreateOperation,
		readRoastCreateOperation,
		reserveRoastCreateOperation,
		shouldRetainRoastCreateOperation
	} from '$lib/roast/create-operation';

	import RoastProfileTabs, { type RoastActionNotice } from './RoastProfileTabs.svelte';
	import LiveRoastGuard from './LiveRoastGuard.svelte';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
	import { buildRoastPageContext } from '$lib/services/roastPageContext';
	import { prepareDateForAPI } from '$lib/utils/dates';

	import RoastPageSkeleton from '$lib/components/RoastPageSkeleton.svelte';

	// Lazy load the heavy chart component
	import type { ComponentType } from 'svelte';
	let RoastChartInterface = $state<ComponentType | null>(null);
	let chartComponentLoading = $state(true);

	async function loadChartComponent() {
		try {
			const module = await import('./RoastChartInterface.svelte');
			RoastChartInterface = module.default as unknown as ComponentType;
		} catch (error) {
			console.error('Failed to load chart component:', error);
		} finally {
			chartComponentLoading = false;
		}
	}
	import type { PageData } from './$types';
	import type { RoastProfile, CoffeeCatalog } from '$lib/types/component.types';
	import type { RoastCreatePayload } from '$lib/roast/create-operation';

	// Roast profile state management
	let currentRoastProfile = $state<RoastProfile | null>(null);

	// Page data
	let {
		data = {
			auth: { isSignedIn: false, user: null, role: 'viewer', ppiAccess: false }
		}
	} = $props<{ data?: Partial<PageData> }>();
	let canCreateRoastProfiles = $derived(canUseMallardControls(data.auth?.role ?? 'viewer'));

	// Main state variables
	let isFormVisible = $derived(
		canCreateRoastProfiles && page.url.searchParams.get('modal') === 'new'
	);
	let selectedBean = $state<{ id?: number; name: string }>({ name: 'No Bean Selected' });
	const timer = createRoastTimer();
	let isRoasting = $derived(!timer.isIdle);
	let isPaused = $derived(timer.isPaused);

	// A roast in progress (timer running or paused) keeps its readings only on
	// this page until "Save roast" stores them. Anything that would reset the
	// timer or clear the readings asks through the guard first.
	let liveRoastGuard = $state<LiveRoastGuard>();
	let liveRoastInProgress = $derived(isRoasting && currentRoastProfile !== null);

	async function confirmLeaveLiveRoast(): Promise<boolean> {
		return (await liveRoastGuard?.confirmLeave()) ?? true;
	}
	let fanValue = $state(8);
	let heatValue = $state(1);
	let selectedEvent = $state<string | null>(null);

	// Roast profile state management (removed unused sort variables)

	// Profile grouping and sorting state. Batches are open unless the roaster closes them.
	let collapsedBatches = $state<Set<string>>(new Set());

	// The roast list holds one page of roasts at a time for the filters in the address.
	// Every filter runs in Parchment, so what is shown is the newest of everything that matches.
	let filters = $derived(readRoastListFilters(page.url.searchParams));
	let filterKey = $derived(roastListFilterKey(filters));
	let listRoasts = $state<RoastProfile[]>([]);
	// Totals for everything the filters match, not only the roasts loaded so far.
	let listTotals = $state<RoastListTotals | null>(null);
	// Roasts asked for so far, a page at a time. "Load more" continues from here.
	let listOffset = $state(0);
	let hasMoreRoasts = $state(false);
	// The filters the list on screen was loaded for.
	let listKey = $state<string | null>(null);
	// True for the first load and while the page reloads after a roast or batch changed.
	let isLoading = $state(true);
	// True while a change of filters loads; the roasts on screen stay until it arrives.
	let isRefreshing = $state(false);
	let isLoadingMore = $state(false);
	let loadMoreFailed = $state(false);
	let listFailed = $state(false);
	// The search term cannot be used. The page says how to search instead of failing.
	let searchInvalid = $state(false);
	let listStarted = false;
	let listRequest = 0;
	// The day date presets count back from, kept for "Load more" so its pages line up.
	let listDay = new Date();

	// The open roast's whole batch, from its own request: the list may not hold it.
	let openBatchRoasts = $state<RoastProfile[]>([]);
	let openBatchRequest = 0;
	// The batch `?batch=` names, as a whole, when other filters narrow what the list shows.
	let filterBatch = $state<{ id: string; roasts: RoastProfile[] } | null>(null);

	// Profile operation errors
	let profileError = $state<string | null>(null);
	let operationInProgress = $state<string | null>(null);
	// Shown under the open roast's actions after "Save as reference" or a download.
	let actionNotice = $state<{ roastId: number; notice: RoastActionNotice } | null>(null);

	// Track processing state
	let selectionState = $state({
		processing: false,
		lastSelectedId: null as number | null,
		selectionInProgress: false
	});
	let pendingProfileCreatePayload = $state<string | null>(null);

	// The member's portfolio coffees: the choices in the list's coffee control, and, for
	// those in stock, in the new-roast form.
	let portfolioCoffees = $state<CoffeeCatalog[]>([]);
	let coffeesLoaded = false;
	let coffeesLoading = $state(false);
	let availableCoffees = $derived(portfolioCoffees.filter((coffee) => coffee.stocked === true));
	let coffeeOptions = $derived(roastCoffeeOptions(portfolioCoffees));

	// Fetch them once the list or the form is on screen
	$effect(() => {
		if (isFormVisible || (!isLoading && currentRoastProfile === null)) {
			void ensureCoffees();
		}
	});

	// Restore the exact payload for a create that may have committed before its
	// response was lost. The form owns the visible retry and discard controls.
	$effect(() => {
		const ownerId = data.auth?.user?.id ?? null;
		if (!isFormVisible || !ownerId) {
			pendingProfileCreatePayload = null;
			return;
		}

		pendingProfileCreatePayload =
			readRoastCreateOperation(sessionStorage, ownerId, 'profile-form')?.payload ?? null;
	});

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

	// A page can end partway through a batch. The rest of that batch is asked for, so each
	// batch header counts every one of its roasts that matches.
	async function withWholeLastBatch(
		rows: RoastProfile[],
		forFilters: RoastListFilters,
		day: Date
	): Promise<RoastProfile[]> {
		const batchId = parseBatchId(rows.at(-1)?.batch_id);
		if (!batchId || forFilters.batch !== null) return rows;
		try {
			const rest = await requestRoasts(roastListQuery({ ...forFilters, batch: batchId }, null, day));
			return mergeRoasts(rows, rest.data);
		} catch {
			return rows;
		}
	}

	// Load the first page of roasts for the filters in the address. Nothing about the open
	// roast is touched, so a roast that is recording keeps recording.
	async function loadList(initial?: PageData['initialRoasts']) {
		const request = ++listRequest;
		const forFilters = filters;
		const key = filterKey;
		const day = new Date();
		isRefreshing = true;

		try {
			const preloaded = initial ? await initial : null;
			const result =
				preloaded?.data ??
				(await requestRoasts(roastListQuery(forFilters, { limit: ROAST_PAGE_SIZE, offset: 0 }, day)));
			const lastPage = isLastRoastPage(0, result.data.length, result.totals.roasts);
			const rows = lastPage
				? result.data
				: await withWholeLastBatch(result.data, forFilters, day);
			if (request !== listRequest) return;

			listRoasts = rows;
			listTotals = result.totals;
			listOffset = result.data.length;
			hasMoreRoasts = !lastPage;
			listDay = day;
			listFailed = false;
			searchInvalid = false;
		} catch (err) {
			if (request !== listRequest) return;
			console.error('Error loading roasts:', err);
			listRoasts = [];
			listTotals = null;
			listOffset = 0;
			hasMoreRoasts = false;
			searchInvalid = err instanceof RoastListRequestError && err.kind === 'invalid-search';
			listFailed = !searchInvalid;
		} finally {
			if (request === listRequest) {
				listKey = key;
				loadMoreFailed = false;
				isRefreshing = false;
			}
		}
	}

	// "Load more": the next page for the same filters, added under what is shown.
	async function loadMoreRoasts() {
		if (isLoadingMore || !hasMoreRoasts) return;
		const request = listRequest;
		const forFilters = filters;
		const offset = listOffset;
		isLoadingMore = true;
		loadMoreFailed = false;

		try {
			const result = await requestRoasts(
				roastListQuery(forFilters, { limit: ROAST_PAGE_SIZE, offset }, listDay)
			);
			// A page with nothing in it ends the list, whatever the totals say.
			const lastPage =
				result.data.length === 0 ||
				isLastRoastPage(offset, result.data.length, result.totals.roasts);
			const rows = mergeRoasts(listRoasts, result.data);
			const whole = lastPage ? rows : await withWholeLastBatch(rows, forFilters, listDay);
			if (request !== listRequest) return;

			listRoasts = whole;
			listTotals = result.totals;
			listOffset = offset + result.data.length;
			hasMoreRoasts = !lastPage;
		} catch (err) {
			if (request !== listRequest) return;
			console.error('Error loading more roasts:', err);
			loadMoreFailed = true;
		} finally {
			isLoadingMore = false;
		}
	}

	// A change of filters in the address loads its list. The first list is loaded on mount.
	$effect(() => {
		const key = filterKey;
		untrack(() => {
			if (listStarted && key !== listKey) void loadList();
		});
	});

	// Reload the list after a roast or a batch changed. The page shows its skeleton meanwhile.
	async function syncData() {
		isLoading = true;
		try {
			await loadList();
		} finally {
			isLoading = false;
		}
	}

	// The open roast's batch, for "Also in this batch" and "Delete batch". What the list
	// already holds of it is shown at once, and the whole batch replaces it when it arrives.
	async function loadOpenBatch(profile: RoastProfile) {
		const request = ++openBatchRequest;
		const batchId = parseBatchId(profile.batch_id);
		const held = batchId
			? mergeRoasts(
					[profile],
					[...openBatchRoasts, ...listRoasts].filter(
						(roast) => parseBatchId(roast.batch_id) === batchId
					)
				)
			: [profile];
		openBatchRoasts = held;
		if (!batchId) return;

		try {
			const roasts = await requestBatchRoasts(batchId);
			if (request === openBatchRequest) openBatchRoasts = roasts;
		} catch (err) {
			// The roast stays open with the batch roasts already known.
			console.error('Error loading the batch of the open roast:', err);
		}
	}

	// Single source of truth for reloading a profile after any mutation.
	// Reads the roast again by its number and reloads the list, then re-selects the roast so
	// the chart reloads from the database (input mode → display mode transition). The roast
	// is asked for on its own because the list's filters may leave it out.
	async function reloadProfile(roastId: number): Promise<RoastProfile | null> {
		let profile: RoastProfile | null = null;
		isLoading = true;
		try {
			[profile] = await Promise.all([requestRoast(roastId).catch(() => null), loadList()]);
		} finally {
			isLoading = false;
		}
		if (!profile) return null;

		// Reset the selection guard so selectProfile actually runs even if
		// we're re-selecting the same profile (the whole point of a reload).
		selectionState.lastSelectedId = null;
		await selectProfile(profile, true);
		return profile;
	}

	async function refreshProfileAfterArtisanImport(roastId: number): Promise<void> {
		await reloadProfile(roastId);
	}

	function discardPendingProfileCreate() {
		const ownerId = data.auth?.user?.id ?? null;
		clearRoastCreateOperation(sessionStorage, ownerId, 'profile-form');
		pendingProfileCreatePayload = null;
	}

	// Batches are worked out from the roasts by batch ID. A name can repeat from week to
	// week, and a batch can hold roasts from more than one day.
	let batches = $derived(groupRoastsByBatch(listRoasts));
	// The open roast's batch as a whole: a batch is named and deleted as a whole.
	let openBatch = $derived(groupRoastsByBatch(openBatchRoasts)[0] ?? null);
	let currentProfileIndex = $derived(
		Math.max(
			0,
			openBatchRoasts.findIndex((roast) => roast.roast_id === currentRoastProfile?.roast_id)
		)
	);

	// `/roast?coffee=<inventory id>` narrows the list to one portfolio coffee, and
	// `/roast?batch=<batch id>` to one batch. Both are named in a chip that removes them.
	let coffeeFilter = $derived(
		filters.coffee === null
			? null
			: {
					id: filters.coffee,
					name:
						coffeeOptions.find((option) => option.id === filters.coffee)?.name ??
						coffeeFilterName(listRoasts, filters.coffee)
				}
	);
	// A batch keeps its own name and date whatever else narrows the list. On its own, the
	// list is that batch; with other filters, the batch is asked for as a whole.
	let batchOnlyFilter = $derived(
		filters.batch !== null && !hasRoastListFilters({ ...filters, batch: null })
	);
	$effect(() => {
		const batchId = filters.batch;
		if (batchId === null || batchOnlyFilter) return;
		if (untrack(() => filterBatch?.id) === batchId) return;
		let current = true;
		requestBatchRoasts(batchId)
			.then((roasts) => {
				if (current) filterBatch = { id: batchId, roasts };
			})
			.catch((err) => console.error('Error loading the batch the list is narrowed to:', err));
		return () => {
			current = false;
		};
	});
	let batchFilter = $derived.by(() => {
		if (filters.batch === null) return null;
		const whole = batchOnlyFilter
			? listKey === filterKey
				? listRoasts
				: []
			: filterBatch?.id === filters.batch
				? filterBatch.roasts
				: [];
		const batch = groupRoastsByBatch(whole).find((candidate) => candidate.id === filters.batch);
		return { id: filters.batch, label: batch ? batchLabel(batch) : null };
	});

	function setFilters(next: RoastListFilters) {
		const search = writeRoastListFilters(next, page.url.searchParams).toString();
		goto(page.url.pathname + (search ? '?' + search : ''), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	// The count line reads the totals for everything the filters match.
	let countLine = $derived(
		listTotals && listTotals.roasts > 0
			? roastCountLine({
					roasts: listTotals.roasts,
					batches: listTotals.batches,
					averageLoss: listTotals.average_loss_percent
				})
			: ''
	);
	let emptyDetail = $derived(
		roastListEmptyDetail(filters, { coffee: coffeeFilter?.name, batch: batchFilter?.label })
	);

	// Publish the actual selection, not just the route name. Cherry receives
	// canonical roast IDs so its read tool can retrieve the complete profiles.
	$effect(() => {
		const visible = isLoading ? [] : listRoasts;
		pageChatContext.set(buildRoastPageContext(visible, currentRoastProfile, isLoading));
		return () => pageChatContext.clear();
	});

	// Update selectedBean when currentRoastProfile changes
	$effect(() => {
		// Only update if we have a profile and we're not in the middle of profile selection
		if (currentRoastProfile && !selectionState.selectionInProgress) {
			const normalizedCoffeeId = currentRoastProfile.coffee_id ?? undefined;
			const normalizedCoffeeName = currentRoastProfile.coffee_name ?? 'Unknown Coffee';

			// Update selectedBean if it's different
			if (
				!selectedBean ||
				selectedBean.id !== normalizedCoffeeId ||
				selectedBean.name !== normalizedCoffeeName
			) {
				selectedBean = {
					id: normalizedCoffeeId,
					name: normalizedCoffeeName
				};
			}
		}
	});

	// Remove selectedBean from data object - use URL params for navigation instead

	// Removed the sort effect since it's redundant - the filtered data effect will handle updates

	async function ensureCoffees() {
		if (coffeesLoaded || coffeesLoading) return;
		coffeesLoading = true;
		try {
			const response = await fetch('/api/beans');
			if (response.ok) {
				const result = await response.json();
				portfolioCoffees = result.data || [];
				coffeesLoaded = true;
			}
		} catch (err) {
			console.error('Error fetching available coffees:', err);
		} finally {
			coffeesLoading = false;
		}
	}

	// The first list and, when the address names one, the open roast. The roast is asked for
	// by its number, so it opens whether or not the list's first page holds it.
	async function openPage() {
		listStarted = true;
		const targetProfileId = readOpenRoastId(page.url.searchParams);
		const initial = data.initialRoastsKey === filterKey ? data.initialRoasts : undefined;
		try {
			const [target] = await Promise.all([
				targetProfileId === null ? null : requestRoast(targetProfileId).catch(() => null),
				loadList(initial)
			]);
			if (target && !currentRoastProfile) await selectProfile(target);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		void loadChartComponent();

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

		// `?roast=<id>` names the open roast; `?profileId=<id>` is the earlier name.
		void openPage();
	});

	// Form submission handler for new roast profiles
	async function handleFormSubmit(profileData: RoastCreatePayload, exactPayload?: string) {
		// A new roast opens as soon as it is created, which replaces the one recording.
		if (!(await confirmLeaveLiveRoast())) return;

		setOperation('Creating roast profile...');
		clearProfileError();
		const ownerId = data.auth?.user?.id ?? null;
		const payload = exactPayload ?? JSON.stringify(profileData);

		try {
			const idempotencyKey = reserveRoastCreateOperation(
				sessionStorage,
				ownerId,
				'profile-form',
				payload
			);
			// The form now sends data with batch_beans format, use it directly
			const response = await fetch('/api/roast-profiles', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': idempotencyKey
				},
				body: payload
			});

			if (!response.ok) {
				if (!shouldRetainRoastCreateOperation(response.status)) {
					clearRoastCreateOperation(sessionStorage, ownerId, 'profile-form');
					pendingProfileCreatePayload = null;
				}
				const error = await response.json();
				throw new Error(error.error || 'Failed to create roast profiles');
			}

			const result = await response.json();
			const profiles = result.profiles || result; // Handle both new and legacy response formats

			// Close form immediately on successful response
			hideRoastForm();

			if (profiles && profiles.length > 0) {
				clearRoastCreateOperation(sessionStorage, ownerId, 'profile-form');
				pendingProfileCreatePayload = null;
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
		// Reloading resets the timer and clears the readings. When the details of
		// the roast being recorded are edited, keep the saved fields (including
		// last_updated, which "Save roast" sends as If-Match) and keep recording.
		if (liveRoastInProgress && currentRoastProfile?.roast_id === updatedProfile.roast_id) {
			Object.assign(currentRoastProfile, updatedProfile);
			return;
		}

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
		openBatchRoasts = [];
		selectedBean = { name: 'No Bean Selected' };
		// Refresh profiles list
		await syncData();
	}

	// Function to toggle batch expansion
	function toggleBatch(batchKey: string) {
		if (!batches.some((batch) => batch.key === batchKey)) return;

		// A new Set, so the change is seen
		const next = new Set(collapsedBatches);
		if (next.has(batchKey)) {
			next.delete(batchKey);
		} else {
			next.add(batchKey);
		}
		collapsedBatches = next;
	}

	// Function to select a profile. `afterMutation` marks the reload that follows a
	// save, create, or import: the live readings are already stored or replaced.
	async function selectProfile(profile: RoastProfile, afterMutation = false) {
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

		// Selecting a roast resets the timer and clears the readings below.
		if (!afterMutation && !(await confirmLeaveLiveRoast())) return;

		selectionState.selectionInProgress = true;
		selectionState.processing = true;

		try {
			console.log('Selecting profile:', profile.roast_id, profile.coffee_name);

			// Make a copy of the profile to avoid reference issues
			currentRoastProfile = { ...profile };
			selectionState.lastSelectedId = profile.roast_id;
			void loadOpenBatch(profile);

			// Update selected bean
			selectedBean = {
				id: profile.coffee_id ?? undefined,
				name: profile.coffee_name ?? 'Unknown Coffee'
			};

			// Reset roasting state
			timer.reset();

			// Update URL to reflect the selected profile. Opening a roast lands at the top
			// of the page; reloading the one already open keeps the reader's place.
			const currentUrl = new URL(window.location.href);
			const alreadyOpen = readOpenRoastId(currentUrl.searchParams) === profile.roast_id;
			currentUrl.searchParams.delete('profileId');
			currentUrl.searchParams.set('roast', profile.roast_id.toString());
			goto(currentUrl.pathname + '?' + currentUrl.searchParams.toString(), {
				replaceState: true,
				keepFocus: true,
				noScroll: alreadyOpen
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
				const ownerId = data.auth?.user?.id ?? null;
				const candidatePayload = JSON.stringify({
					batch_name: `${selectedBean.name} - ${new Date().toLocaleDateString()}`,
					coffee_id: selectedBean.id,
					coffee_name: selectedBean.name,
					roast_date: prepareDateForAPI(new Date().toISOString()),
					last_updated: new Date()
				});
				const pendingCreate = readRoastCreateOperation(sessionStorage, ownerId, 'live-roast');
				if (pendingCreate) {
					let pendingCoffeeId: unknown;
					try {
						pendingCoffeeId = (JSON.parse(pendingCreate.payload) as Record<string, unknown>)
							.coffee_id;
					} catch {
						// A malformed pending payload is not safe to replace with a new operation key.
					}
					if (pendingCoffeeId !== selectedBean.id) {
						throw new Error(
							'A previous live roast creation has an unresolved result. Retry that coffee before saving a different one.'
						);
					}
				}
				const createPayload = pendingCreate?.payload ?? candidatePayload;
				const idempotencyKey = reserveRoastCreateOperation(
					sessionStorage,
					ownerId,
					'live-roast',
					createPayload
				);
				const profileResponse = await fetch('/api/roast-profiles', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Idempotency-Key': idempotencyKey
					},
					body: createPayload
				});

				if (!profileResponse.ok) {
					if (!shouldRetainRoastCreateOperation(profileResponse.status)) {
						clearRoastCreateOperation(sessionStorage, ownerId, 'live-roast');
					}
					const errorData = await profileResponse.json();
					throw new Error(errorData.error || 'Failed to save roast profile');
				}

				const profile = await profileResponse.json();
				const actualProfile = Array.isArray(profile) ? profile[0] : profile;
				if (!actualProfile?.roast_id) {
					throw new Error('Roast creation returned an invalid profile');
				}
				clearRoastCreateOperation(sessionStorage, ownerId, 'live-roast');
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
					headers: {
						'Content-Type': 'application/json',
						...(currentRoastProfile?.last_updated
							? { 'If-Match': currentRoastProfile.last_updated }
							: {})
					},
					body: JSON.stringify({
						temperatureEntries: mappedTemps,
						eventEntries: mappedEvents
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

			// Reload so the page shows the cleared roast. A roast that is recording keeps
			// its timer and readings, so it is left as it is.
			if (currentRoastProfile && !liveRoastInProgress) {
				await reloadProfile(currentRoastProfile.roast_id);
			}
			clearProfileError();
		} catch (error) {
			console.error('Error clearing roast data:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to clear roast data');
		} finally {
			setOperation(null);
		}
	}

	// "Save as reference" in the roast's More menu: keeps the roast to compare or plan
	// from later. The roast and anything being recorded are left as they are.
	async function handleSaveReference() {
		const roast = currentRoastProfile;
		if (!roast || operationInProgress) return;
		setOperation('Saving reference...');
		clearProfileError();
		actionNotice = null;
		try {
			const title = await saveRoastAsReference(roast, data.auth?.user?.id ?? null, sessionStorage);
			actionNotice = {
				roastId: roast.roast_id,
				notice: {
					message: `${title} is saved as a reference.`,
					link: { href: savedHref(), label: 'See saved references and plans' }
				}
			};
			trackProfileStudioActivation('reference_profile_saved');
		} catch (error) {
			setProfileError(
				error instanceof Error ? error.message : 'Unable to save this roast as a reference'
			);
		} finally {
			setOperation(null);
		}
	}

	// "Download Artisan file" in the roast's More menu: the Artisan file stored with the
	// roast when it was imported. Nothing on the page changes, so a roast that is recording
	// keeps recording.
	async function handleDownloadArtisanFile() {
		const roast = currentRoastProfile;
		if (!roast || operationInProgress) return;
		setOperation('Downloading Artisan file...');
		clearProfileError();
		actionNotice = null;
		try {
			const result = await downloadFile(
				roastFileHref(roast.roast_id),
				`roast-${roast.roast_id}.alog`
			);
			if (result.ok) {
				actionNotice = {
					roastId: roast.roast_id,
					notice: {
						message: `Downloading ${result.fileName}. It is the Artisan file stored with this roast when it was imported. ${ARTISAN_BACKGROUND_STEPS}`
					}
				};
			} else if (result.reason) {
				actionNotice = {
					roastId: roast.roast_id,
					notice: { message: roastFileReasonCopy(result.reason), tone: 'note' }
				};
			} else {
				setProfileError('This file could not be downloaded. Try again in a moment.');
			}
		} finally {
			setOperation(null);
		}
	}

	// "Delete batch" in the open roast's More menu: one batch, by its ID, with the roasts in
	// it. Another batch that carries the same name is not touched.
	async function deleteBatch(batchKey: string) {
		const batchId = openBatch?.key === batchKey ? openBatch.id : null;
		if (!batchId || operationInProgress) return;

		// The member is told how many roasts go with the batch, so its roasts are read again
		// before asking.
		let batch;
		try {
			batch = groupRoastsByBatch(await requestBatchRoasts(batchId)).find(
				(candidate) => candidate.id === batchId
			);
		} catch (error) {
			console.error('Error reading the batch to delete:', error);
		}
		if (!batch?.id) {
			setProfileError('This batch could not be read. Try again in a moment.');
			return;
		}

		// Deleting the batch of the roast being recorded drops its readings with it.
		const holdsOpenRoast =
			currentRoastProfile !== null &&
			batch.roasts.some((roast) => roast.roast_id === currentRoastProfile?.roast_id);
		if (holdsOpenRoast && !(await confirmLeaveLiveRoast())) return;
		if (!confirm(deleteBatchConfirmation(batch))) return;

		setOperation('Deleting batch...');
		clearProfileError();
		try {
			const response = await fetch(`/api/roast-batches/${batch.id}`, { method: 'DELETE' });
			if (!response.ok) {
				const failure = await response.json().catch(() => null);
				throw new Error(failure?.error || 'Failed to delete this batch');
			}

			if (holdsOpenRoast) {
				currentRoastProfile = null;
				selectedBean = { name: 'No Bean Selected' };
				selectionState.lastSelectedId = null;
				timer.reset();
				$temperatureEntries = [];
				$eventEntries = [];
				$roastData = [];
				$roastEvents = [];
			}

			// The open roast and the batch are gone, so neither stays in the address.
			const currentUrl = new URL(window.location.href);
			if (holdsOpenRoast) {
				currentUrl.searchParams.delete('roast');
				currentUrl.searchParams.delete('profileId');
			}
			if (readBatchFilter(currentUrl.searchParams) === batch.id) {
				currentUrl.searchParams.delete('batch');
			}
			const search = currentUrl.searchParams.toString();
			goto(currentUrl.pathname + (search ? '?' + search : ''), {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});

			if (holdsOpenRoast) openBatchRoasts = [];
			await syncData();
		} catch (error) {
			console.error('Error deleting batch:', error);
			setProfileError(error instanceof Error ? error.message : 'Failed to delete this batch');
		} finally {
			setOperation(null);
		}
	}

	// Function to clear the current profile (for the "← Roasts" back link).
	// Resolves false when a roast is recording and the member keeps roasting.
	async function handleClearProfile(): Promise<boolean> {
		if (!(await confirmLeaveLiveRoast())) return false;

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

		// Back to the list as it was: every filter it was narrowed by stays in the address.
		openBatchRoasts = [];
		goto(roastListHref(filters), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
		return true;
	}
</script>

<FormShell visible={isFormVisible} maxWidth="max-w-4xl">
	<RoastProfileForm
		{selectedBean}
		{availableCoffees}
		initialPayload={pendingProfileCreatePayload}
		onDiscardPending={discardPendingProfileCreate}
		onArtisanImportComplete={refreshProfileAfterArtisanImport}
		onClose={hideRoastForm}
		onSubmit={handleFormSubmit}
	/>
</FormShell>

<LiveRoastGuard bind:this={liveRoastGuard} active={liveRoastInProgress} />

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
{:else}
	<RoastProfileTabs
		{batches}
		{openBatchRoasts}
		{collapsedBatches}
		{currentRoastProfile}
		{currentProfileIndex}
		{chartComponentLoading}
		{RoastChartInterface}
		{countLine}
		{filters}
		{coffeeOptions}
		onFiltersChange={setFilters}
		{emptyDetail}
		loadedRoasts={listRoasts.length}
		matchingRoasts={listTotals?.roasts ?? 0}
		hasMore={hasMoreRoasts}
		{isRefreshing}
		{isLoadingMore}
		{loadMoreFailed}
		{listFailed}
		{searchInvalid}
		onLoadMore={loadMoreRoasts}
		onRetryList={() => loadList()}
		canCreateRoast={canCreateRoastProfiles}
		actionNotice={actionNotice?.roastId === currentRoastProfile?.roast_id
			? (actionNotice?.notice ?? null)
			: null}
		actionInProgress={operationInProgress !== null}
		onSaveReference={handleSaveReference}
		onDownloadArtisan={handleDownloadArtisanFile}
		onToggleBatch={toggleBatch}
		onSelectProfile={selectProfile}
		onProfileUpdate={handleProfileUpdate}
		onProfileDelete={handleProfileDelete}
		onDeleteBatch={deleteBatch}
		onClearProfile={handleClearProfile}
		onClearFilters={() => setFilters(NO_ROAST_LIST_FILTERS)}
		{coffeeFilter}
		onClearCoffeeFilter={() => setFilters({ ...filters, coffee: null })}
		{batchFilter}
		onClearBatchFilter={() => setFilters({ ...filters, batch: null })}
		onProfileRefresh={refreshProfileAfterArtisanImport}
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
{/if}
