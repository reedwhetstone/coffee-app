<script lang="ts">
	import BeanProfileTabs from './BeanProfileTabs.svelte';
	import type { InventoryWithCatalog } from '$lib/types/component.types';
	import type { UserRole } from '$lib/types/auth.types';
	let {
		selectedBean,
		role,
		canManagePortfolio,
		embedded = true,
		onUpdate,
		onDelete
	} = $props<{
		selectedBean: InventoryWithCatalog;
		role: UserRole;
		canManagePortfolio: boolean;
		embedded?: boolean;
		onUpdate: (bean: InventoryWithCatalog) => void;
		onDelete: (id: number) => Promise<void>;
	}>();
	let detail = $state<InventoryWithCatalog | null>(null);
	let error = $state(false);
	let retry = $state(0);
	$effect(() => {
		const id = selectedBean.id;
		void retry;
		const controller = new AbortController();
		detail = null;
		error = false;
		void fetch(`/api/beans?id=${id}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error('Detail failed');
				const result = await response.json();
				const row = result.data?.find((row: InventoryWithCatalog) => row.id === id);
				if (!row) throw new Error('Missing portfolio item');
				if (!controller.signal.aborted) detail = row;
			})
			.catch(() => {
				if (!controller.signal.aborted) error = true;
			});
		return () => controller.abort();
	});
</script>

{#if detail}
	<BeanProfileTabs
		selectedBean={detail}
		{role}
		{canManagePortfolio}
		{embedded}
		{onUpdate}
		{onDelete}
	/>
{:else if error}
	<p role="alert" class="text-sm text-danger">Unable to load coffee details.</p>
	<button class="text-sm text-accent" onclick={() => retry++}>Try again</button>
{:else}
	<p role="status" class="text-sm text-muted">Loading coffee details…</p>
{/if}
