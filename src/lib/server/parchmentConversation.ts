import type {
	ConversationCanvasUpdateRequest,
	ConversationMemoryUpdateRequest,
	ConversationMessageAppendRequest,
	ConversationSummaryUpdateRequest,
	ConversationWorkspaceCreateRequest,
	ConversationWorkspaceMetadataRequest,
	ParchmentClient,
	components
} from '@purveyors/sdk';

type ApiResult<T> = {
	data?: T;
	error?: unknown;
	response: Response;
};

export type ConversationWorkspace = components['schemas']['ConversationWorkspace'];
export type ConversationMessage = components['schemas']['ConversationWorkspaceMessage'];
export type ConversationCompactionInputs =
	components['schemas']['ConversationCompactionInputsResponse']['data'];
export type ConversationSummaryCompaction =
	components['schemas']['ConversationSummaryCompactionResponse']['data'];
export type ConversationMemory = components['schemas']['ConversationMemory'];

export class ParchmentConversationError extends Error {
	constructor(
		public readonly status: number,
		public readonly body: unknown
	) {
		super('Parchment conversation request failed');
		this.name = 'ParchmentConversationError';
	}
}

export function legacyConversationError(body: unknown): { error: string; code?: string } {
	if (body && typeof body === 'object' && 'error' in body) {
		const nested = body.error;
		if (nested && typeof nested === 'object') {
			const message =
				'message' in nested && typeof nested.message === 'string'
					? nested.message
					: 'Conversation state request failed';
			const code = 'code' in nested && typeof nested.code === 'string' ? nested.code : undefined;
			return code ? { error: message, code } : { error: message };
		}
		if (typeof nested === 'string') return { error: nested };
	}
	return { error: 'Conversation state request failed' };
}

function unwrap<T>(result: ApiResult<T>): T {
	if (result.error !== undefined || result.data === undefined) {
		throw new ParchmentConversationError(result.response.status, result.error);
	}
	return result.data;
}

export function legacyWorkspace(workspace: ConversationWorkspace) {
	return {
		id: workspace.id,
		title: workspace.title,
		type: workspace.type,
		context_summary: workspace.contextSummary,
		canvas_state: workspace.canvasState,
		created_at: workspace.createdAt,
		last_accessed_at: workspace.lastAccessedAt,
		reset_epoch: workspace.resetEpoch,
		canvas_version: workspace.canvasVersion,
		summary_version: workspace.summaryVersion,
		next_message_sequence: workspace.nextMessageSequence
	};
}

export function legacyMessage(message: ConversationMessage) {
	return {
		id: message.id,
		workspace_id: message.workspaceId,
		role: message.role,
		content: message.content,
		parts: message.parts,
		canvas_mutations: message.canvasMutations,
		client_message_id: message.clientMessageId,
		client_created_at: message.clientCreatedAt,
		created_at: message.createdAt,
		message_sequence: message.messageSequence
	};
}

export async function getOrCreateConversationWorkspace(
	client: ParchmentClient,
	body: ConversationWorkspaceCreateRequest
) {
	const result = await client.conversation.workspaces.getOrCreate(body);
	return legacyWorkspace(unwrap(result).data);
}

export async function getConversationWorkspace(
	client: ParchmentClient,
	workspaceId: string,
	messageLimit = 50
) {
	const result = await client.conversation.workspaces.get(workspaceId, messageLimit);
	const data = unwrap(result).data;
	return {
		workspace: legacyWorkspace(data.workspace),
		messages: data.messages.map(legacyMessage)
	};
}

export async function updateConversationWorkspace(
	client: ParchmentClient,
	workspaceId: string,
	body: ConversationWorkspaceMetadataRequest
) {
	const result = await client.conversation.workspaces.update(workspaceId, body);
	return legacyWorkspace(unwrap(result).data);
}

export async function appendConversationMessages(
	client: ParchmentClient,
	workspaceId: string,
	body: ConversationMessageAppendRequest
) {
	const result = await client.conversation.workspaces.messages.append(workspaceId, body);
	return unwrap(result).data;
}

export async function clearConversationMessages(
	client: ParchmentClient,
	workspaceId: string,
	expectedResetEpoch: number
) {
	const result = await client.conversation.workspaces.messages.clear(workspaceId, {
		expectedResetEpoch
	});
	return unwrap(result).data;
}

export async function updateConversationCanvas(
	client: ParchmentClient,
	workspaceId: string,
	body: ConversationCanvasUpdateRequest
) {
	const result = await client.conversation.workspaces.updateCanvas(workspaceId, body);
	return unwrap(result).data;
}

export async function getConversationCompactionInputs(
	client: ParchmentClient,
	workspaceId: string,
	messageLimit = 30
) {
	const result = await client.conversation.workspaces.getCompactionInputs(
		workspaceId,
		messageLimit
	);
	return unwrap(result).data;
}

export async function updateConversationSummary(
	client: ParchmentClient,
	workspaceId: string,
	body: ConversationSummaryUpdateRequest
) {
	const result = await client.conversation.workspaces.updateSummary(workspaceId, body);
	return unwrap(result).data;
}

export async function compactConversationSummary(
	client: ParchmentClient,
	workspaceId: string
): Promise<ConversationSummaryCompaction> {
	const result = await client.conversation.workspaces.compactSummary(workspaceId);
	return unwrap(result).data;
}

export async function getConversationMemory(client: ParchmentClient) {
	const result = await client.conversation.memory.get();
	return unwrap(result).data;
}

export async function updateConversationMemory(
	client: ParchmentClient,
	body: ConversationMemoryUpdateRequest
) {
	const result = await client.conversation.memory.update(body);
	return unwrap(result).data;
}
