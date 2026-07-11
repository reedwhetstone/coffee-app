import type { WorkspaceMessage } from '$lib/stores/workspaceStore.svelte';

/** Preserve the AI SDK identity used to derive durable action execution keys. */
export function workspaceMessageClientId(
	message: Pick<WorkspaceMessage, 'id' | 'client_message_id'>
) {
	return message.client_message_id ?? message.id;
}
