<script lang="ts">
	import { navbarActions } from '$lib/stores/navbarStore';
</script>

<button
	class="hover:bg-background-primary-light bg-background-tertiary-light rounded px-4 py-2 text-sm text-zinc-300"
	on:click={() => $navbarActions.onAddNewSale()}
>
	Add Sale
</button>
