<script lang="ts">
	let { 
		show = true, 
		message = 'Loading...' 
	} = $props<{
		show?: boolean;
		message?: string;
	}>();
</script>

{#if show}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background-primary-light">
		<div class="flex flex-col items-center space-y-4">
			<!-- Simple spinning circle using your color scheme -->
			<div class="h-12 w-12 animate-spin rounded-full border-4 border-background-secondary-light border-t-primary-light"></div>
			
			<!-- Loading message -->
			<p class="text-lg font-medium text-primary-light">{message}</p>
		</div>
	</div>
{/if}