<script lang="ts">
	export let data: { data: { id: number; name: string }[] };
</script>

{#if data}
	<p>{JSON.stringify(data)}</p>
	<p>{data.data[1].name}</p>
	<p>{data.data[2].name}</p>
{:else}
	<p>Loading or no data available.</p>
{/if}
