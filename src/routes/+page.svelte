<!-- <script lang="ts">
	export let data: { data: { id: number; name: string }[] };
</script>

{#if data}
	<p>{JSON.stringify(data)}</p>
	<p>{data.data[1].name}</p>
	<p>{data.data[2].name}</p>
{:else}
	<p>Loading or no data available.</p>
{/if}
 -->

<script lang="ts">
	export let data: { data: { id: number; name: string }[] };
</script>

<div class="m-4 overflow-x-auto p-3">
	<table class="table-auto border-collapse rounded-sm border border-gray-200">
		<thead>
			<tr class="bg-gray-800">
				<th class="border border-transparent px-4 py-2 font-semibold text-gray-400"> ID </th>
				<th class="border border-transparent px-4 py-2 font-semibold text-gray-400">Name </th>
			</tr>
		</thead>
		<tbody>
			{#each data.data as bean}
				<tr class="bg-gray-700">
					<td class="border border-transparent px-4 py-2 text-gray-400">{bean.id}</td>
					<td class="border border-transparent px-4 py-2 text-gray-400">{bean.name}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
