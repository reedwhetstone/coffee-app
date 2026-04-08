<script lang="ts">
	import MobileOverlayShell from '../MobileOverlayShell.svelte';

	let { open = true, onClose = () => {} } = $props<{
		open?: boolean;
		onClose?: () => void;
	}>();
</script>

<MobileOverlayShell {open} variant="sheet" {onClose} label="App menu" labelledBy="dialog-title">
	<div class="p-4">
		<h2 id="dialog-title">App menu</h2>
		<button type="button">First action</button>
		<button type="button">Second action</button>
	</div>
</MobileOverlayShell>
