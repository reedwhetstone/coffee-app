<script lang="ts" module>
	export interface RowMenuItem {
		label: string;
		/** A link to another page. An item has a link or an action, not both. */
		href?: string;
		run?: () => void;
		disabled?: boolean;
		destructive?: boolean;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';

	// The "more" menu on one row of a list: the same menu the open roast has, behind a
	// "⋯" button named for its row.
	let { label, items }: { label: string; items: RowMenuItem[] } = $props();

	const uid = $props.id();
	const menuId = `${uid}-menu`;

	let open = $state(false);
	// The menu opens upward when it would otherwise run under the bottom of the screen.
	let above = $state(false);
	let trigger = $state<HTMLButtonElement | null>(null);
	let menu = $state<HTMLDivElement | null>(null);

	// Room kept clear at the bottom of the screen for the chat button fixed to the corner,
	// and at the top for the page header.
	const BOTTOM_CLEARANCE = 96;
	const TOP_CLEARANCE = 80;

	const choices = () =>
		Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);

	async function show(focus: 'first' | 'last' = 'first') {
		above = false;
		open = true;
		await tick();
		const box = menu?.getBoundingClientRect();
		const anchor = trigger?.getBoundingClientRect();
		if (
			box &&
			anchor &&
			box.bottom > window.innerHeight - BOTTOM_CLEARANCE &&
			anchor.top - box.height > TOP_CLEARANCE
		) {
			above = true;
			await tick();
		}
		const enabled = choices();
		(focus === 'first' ? enabled[0] : enabled[enabled.length - 1])?.focus();
	}

	function hide(returnFocus = false) {
		open = false;
		if (returnFocus) trigger?.focus();
	}

	function choose(run: (() => void) | undefined) {
		hide(true);
		run?.();
	}

	function handleTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			void show(event.key === 'ArrowDown' ? 'first' : 'last');
		}
	}

	function handleMenuKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			hide(true);
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const enabled = choices();
		if (enabled.length === 0) return;
		const index = enabled.findIndex((choice) => choice === document.activeElement);
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? enabled.length - 1
					: (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
		enabled[next].focus();
	}

	function handleFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return;
		hide();
	}
</script>

<div class="relative" onfocusout={handleFocusOut}>
	<button
		bind:this={trigger}
		type="button"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls={menuId}
		aria-label={label}
		class="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		onclick={() => (open ? hide() : void show())}
		onkeydown={handleTriggerKeydown}
	>
		<span aria-hidden="true">⋯</span>
	</button>
	{#if open}
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div
			bind:this={menu}
			id={menuId}
			role="menu"
			aria-label={label}
			class="absolute right-0 z-20 w-56 rounded-md border border-line bg-surface-panel py-1 shadow-lg {above
				? 'bottom-full mb-1'
				: 'mt-1'}"
			onkeydown={handleMenuKeydown}
		>
			{#each items as item, index (item.label)}
				{#if item.destructive && !items[index - 1]?.destructive}
					<div class="my-1 border-t border-line" role="separator"></div>
				{/if}
				{#if item.href}
					<a
						href={item.href}
						role="menuitem"
						class="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-accent-subtle"
						onclick={() => setTimeout(() => hide())}
					>
						{item.label}
					</a>
				{:else}
					<button
						type="button"
						role="menuitem"
						disabled={item.disabled}
						class="block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50 {item.destructive
							? 'text-danger hover:bg-danger-subtle'
							: 'text-ink hover:bg-accent-subtle'}"
						onclick={() => choose(item.run)}
					>
						{item.label}
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>
