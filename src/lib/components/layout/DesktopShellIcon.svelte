<script lang="ts">
	let { name } = $props<{
		name: 'chat' | 'navigation' | 'actions' | 'filters' | 'admin';
	}>();
</script>

<svg class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
	{#if name === 'chat'}
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M8 10h8m-8 4h5m-9.5 5.5L4 16.06A8.96 8.96 0 0 1 3 12a9 9 0 1 1 9 9 8.96 8.96 0 0 1-4.06-1z"
		/>
	{:else if name === 'navigation'}
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M4 6h16M4 12h16M4 18h16"
		/>
	{:else if name === 'actions'}
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 5v14M5 12h14" />
	{:else if name === 'filters'}
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M4 6h10m4 0h2M10 12h10M4 12h2m-2 6h14m2 0h0"
		/>
		<circle cx="16" cy="6" r="2" fill="currentColor" stroke="none" />
		<circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
		<circle cx="18" cy="18" r="2" fill="currentColor" stroke="none" />
	{:else}
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
		/>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="1.5"
			d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
		/>
	{/if}
</svg>
