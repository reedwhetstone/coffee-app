<script lang="ts">
	import { navbarActions } from '$lib/stores/navbarStore';
</script>

<button
	class="hover:bg-background-primary-light rounded bg-zinc-700 px-4 py-2 text-sm text-zinc-300"
	on:click={() => $navbarActions.onAddNewSale()}
>
	Add Sale
</button>
