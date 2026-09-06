<script lang="ts">
	import ExpandablePanel from '../ExpandablePanel.svelte';

	let count = $state(0);
</script>

<ExpandablePanel title="Stateful panel" showGradient={false}>
	<button type="button" onclick={() => (count += 1)}>Count {count}</button>
</ExpandablePanel>
