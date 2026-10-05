<script lang="ts">
	import {
		filterProfileOptionGroups,
		findProfileOption,
		type ProfileOption,
		type ProfileOptionGroup
	} from '$lib/roast/profile-picker-model';

	let {
		label,
		groups,
		value = $bindable(''),
		unavailableValue = '',
		loading = false
	}: {
		label: string;
		groups: ProfileOptionGroup[];
		value?: string;
		/** The profile chosen on the other side; a profile cannot be compared with itself. */
		unavailableValue?: string;
		loading?: boolean;
	} = $props();

	let inputElement = $state<HTMLInputElement | null>(null);

	/** Move to this picker and open its list. */
	export function focus() {
		inputElement?.focus();
	}

	const uid = $props.id();
	const inputId = `${uid}-input`;
	const listId = `${uid}-list`;

	let open = $state(false);
	let query = $state('');
	let activeValue = $state<string | null>(null);
	let listElement = $state<HTMLDivElement | null>(null);

	const selected = $derived(findProfileOption(groups, value));
	const visibleGroups = $derived(filterProfileOptionGroups(groups, query));
	const selectable = $derived(
		visibleGroups.flatMap((group) =>
			group.options.filter((option) => option.value !== unavailableValue)
		)
	);

	const optionId = (option: ProfileOption) =>
		`${uid}-${option.value.replace(/[^a-z0-9_-]/gi, '-')}`;
	const activeOption = $derived(selectable.find((option) => option.value === activeValue) ?? null);

	function countLabel(group: ProfileOptionGroup): string {
		return query.trim() ? `${group.options.length} of ${group.total}` : String(group.total);
	}

	function emptyLabel(group: ProfileOptionGroup): string {
		if (group.total > 0) {
			return group.key === 'references'
				? 'No saved references match your search.'
				: 'No roasts match your search.';
		}
		if (group.empty && !loading) return group.empty;
		if (group.key === 'references') {
			return loading ? 'Loading saved references…' : 'No saved references yet.';
		}
		return 'No recorded roasts yet.';
	}

	function show() {
		if (open) return;
		open = true;
		query = '';
		activeValue = selected && selected.value !== unavailableValue ? selected.value : null;
	}

	function hide() {
		open = false;
		query = '';
		activeValue = null;
	}

	function choose(option: ProfileOption) {
		if (option.value === unavailableValue) return;
		value = option.value;
		hide();
	}

	function move(step: 1 | -1) {
		if (selectable.length === 0) return;
		const index = selectable.findIndex((option) => option.value === activeValue);
		const next =
			index === -1
				? step === 1
					? 0
					: selectable.length - 1
				: (index + step + selectable.length) % selectable.length;
		activeValue = selectable[next].value;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			show();
			move(event.key === 'ArrowDown' ? 1 : -1);
		} else if (event.key === 'Enter') {
			if (!open) return;
			event.preventDefault();
			if (activeOption) choose(activeOption);
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			hide();
		}
	}

	function handleInput(event: Event) {
		open = true;
		query = (event.currentTarget as HTMLInputElement).value;
		activeValue = null;
	}

	function handleFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return;
		hide();
	}

	$effect(() => {
		if (!open || !activeOption || !listElement) return;
		const element = listElement.querySelector<HTMLElement>(
			`#${CSS.escape(optionId(activeOption))}`
		);
		element?.scrollIntoView?.({ block: 'nearest' });
	});
</script>

<div class="relative" onfocusout={handleFocusOut}>
	<label for={inputId} class="text-sm font-medium text-ink">{label}</label>
	<input
		bind:this={inputElement}
		id={inputId}
		type="text"
		role="combobox"
		autocomplete="off"
		spellcheck="false"
		aria-expanded={open}
		aria-controls={listId}
		aria-autocomplete="list"
		aria-activedescendant={open && activeOption ? optionId(activeOption) : undefined}
		value={open ? query : (selected?.title ?? '')}
		placeholder={open
			? 'Search by coffee, date, batch, or roast number'
			: 'Choose a roast or saved reference'}
		class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
		onfocus={show}
		onclick={show}
		oninput={handleInput}
		onkeydown={handleKeydown}
	/>
	{#if selected && !open}
		<p class="mt-1 text-xs text-muted">{selected.detail}</p>
	{/if}
	{#if open}
		<div
			class="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface-panel shadow-lg"
		>
			<div
				id={listId}
				bind:this={listElement}
				role="listbox"
				aria-label={label}
				class="max-h-80 overflow-y-auto"
			>
				{#each visibleGroups as group (group.key)}
					<div role="group" aria-labelledby={`${uid}-${group.key}`}>
						<p
							id={`${uid}-${group.key}`}
							class="sticky top-0 flex justify-between border-b border-line bg-surface-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted"
						>
							<span>{group.heading}</span>
							<span class="font-normal normal-case tracking-normal">{countLabel(group)}</span>
						</p>
						{#each group.options as option (option.value)}
							{@const unavailable = option.value === unavailableValue}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								id={optionId(option)}
								role="option"
								tabindex="-1"
								aria-selected={option.value === value}
								aria-disabled={unavailable}
								class="cursor-pointer px-3 py-2 {unavailable
									? 'cursor-not-allowed opacity-50'
									: 'hover:bg-accent-subtle'} {option.value === activeValue
									? 'bg-accent-subtle'
									: ''}"
								onmousedown={(event) => event.preventDefault()}
								onclick={() => choose(option)}
							>
								<span class="block text-sm text-ink {option.value === value ? 'font-semibold' : ''}"
									>{option.title}</span
								>
								<span class="block text-xs text-muted"
									>{option.detail}{unavailable ? ' · Chosen on the other side' : ''}</span
								>
							</div>
						{/each}
						{#if group.options.length === 0}
							<p class="px-3 py-2 text-sm text-muted">{emptyLabel(group)}</p>
						{/if}
					</div>
				{/each}
			</div>
			<!-- Renaming, removing, and adding a saved reference are done in the library. -->
			<a
				href="/roast/saved"
				class="block border-t border-line px-3 py-2 text-sm font-semibold text-link hover:bg-accent-subtle hover:text-accent"
				onmousedown={(event) => event.preventDefault()}
			>
				Manage saved references
			</a>
		</div>
	{/if}
</div>
