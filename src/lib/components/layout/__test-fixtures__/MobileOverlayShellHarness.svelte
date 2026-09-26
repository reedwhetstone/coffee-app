<script lang="ts">
	import ChatDisclosure from '$lib/components/chat/ChatDisclosure.svelte';
	import MobileOverlayShell from '../MobileOverlayShell.svelte';

	let {
		open = true,
		disclosure = false,
		onClose = () => {}
	} = $props<{
		open?: boolean;
		disclosure?: boolean;
		onClose?: () => void;
	}>();
</script>

<MobileOverlayShell {open} variant="sheet" {onClose} label="App menu" labelledBy="dialog-title">
	<div class="p-4">
		<h2 id="dialog-title">App menu</h2>
		{#if disclosure}
			<ChatDisclosure label="Conversation controls" upward={false}>
				{#snippet trigger()}Controls{/snippet}
				<button type="button">Hidden action</button>
			</ChatDisclosure>
		{/if}
		<button type="button">First action</button>
		<button type="button">Second action</button>
	</div>
</MobileOverlayShell>
