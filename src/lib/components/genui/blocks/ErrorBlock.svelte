<script lang="ts">
	import type { ErrorBlock } from '$lib/types/genui';

	let { block } = $props<{
		block: ErrorBlock;
	}>();
</script>

<div class="my-4">
	<div class="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
		<svg
			class="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
		<div>
			<p class="text-sm font-medium text-red-800">Something went wrong</p>
			<p class="mt-1 text-sm text-red-700">{block.data.message}</p>
		</div>
	</div>
</div>
