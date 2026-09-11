<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { onDestroy } from 'svelte';
	import ChatMessageList from '../ChatMessageList.svelte';

	let { transportFetch }: { transportFetch: typeof fetch } = $props();
	let failure = $state('');
	const chat = new Chat({
		transport: new DefaultChatTransport({
			api: '/api/chat',
			fetch: (...args) => transportFetch(...args)
		}),
		onError: (error) => {
			failure = error.message;
		}
	});
	let active = $derived(chat.status === 'submitted' || chat.status === 'streaming');
	onDestroy(() => void chat.stop());
</script>

<button onclick={() => void chat.sendMessage({ text: 'Compare stocked coffees' })}>Send</button>
<button onclick={() => void chat.stop()}>Stop</button>
<output data-testid="chat-status">{chat.status}</output>
{#if failure}<p role="alert">{failure}</p>{/if}
<ChatMessageList
	agentName="Cherry Green Agent"
	{chat}
	isActive={active}
	canUseMallardWorkspaces={false}
	onScroll={() => {}}
	onBlockAction={() => {}}
	onExecuteAction={async () => undefined}
	onExampleSelect={() => {}}
	onAskAgainMessage={() => {}}
/>
