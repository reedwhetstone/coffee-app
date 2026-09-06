import { json } from '@sveltejs/kit';
import { OPENROUTER_API_KEY } from '$env/static/private';
import { CHERRY_RUNTIME_MODEL } from '$lib/server/cherryRuntime';
import { requireChatAccess } from '$lib/server/auth';
import { createParchmentServerClient, ParchmentConfigError } from '$lib/server/parchmentClient';
import {
	getConversationCompactionInputs,
	legacyConversationError,
	ParchmentConversationError,
	updateConversationSummary
} from '$lib/server/parchmentConversation';
import type { RequestHandler } from './$types';

const WORKSPACE_SUMMARY_MAX_LENGTH = 2000;
const WORKSPACE_SUMMARY_COOLDOWN_MS = 5 * 60 * 1000;
const workspaceSummaryAttempts = new Map<string, number>();

function textFromParts(parts: unknown): string {
	if (!Array.isArray(parts)) return '';
	return parts
		.map((part) =>
			part &&
			typeof part === 'object' &&
			'type' in part &&
			part.type === 'text' &&
			'text' in part &&
			typeof part.text === 'string'
				? part.text
				: ''
		)
		.filter(Boolean)
		.join('\n');
}

export function _workspaceSummaryMessageText(message: {
	content: string | null;
	parts?: unknown;
}): string {
	return textFromParts(message.parts) || message.content || '';
}

export function _clampWorkspaceContextSummary(summary: string): string {
	return summary.length > WORKSPACE_SUMMARY_MAX_LENGTH
		? summary.slice(0, WORKSPACE_SUMMARY_MAX_LENGTH)
		: summary;
}

export function _workspaceSummaryCooldownRemainingMs(
	workspaceId: string,
	now = Date.now()
): number {
	const lastAttemptAt = workspaceSummaryAttempts.get(workspaceId);
	if (!lastAttemptAt) return 0;
	return Math.max(0, WORKSPACE_SUMMARY_COOLDOWN_MS - (now - lastAttemptAt));
}

function reserveWorkspaceSummaryAttempt(workspaceId: string, now = Date.now()): number {
	const remainingMs = _workspaceSummaryCooldownRemainingMs(workspaceId, now);
	if (remainingMs > 0) return remainingMs;
	workspaceSummaryAttempts.set(workspaceId, now);
	return 0;
}

function failure(error: unknown) {
	if (error instanceof ParchmentConversationError) {
		return json(legacyConversationError(error.body), { status: error.status });
	}
	if (error instanceof ParchmentConfigError) {
		return json({ error: 'Conversation state is temporarily unavailable' }, { status: 503 });
	}
	const status = (error as { status?: number }).status || 500;
	return json({ error: (error as Error).message }, { status });
}

export const POST: RequestHandler = async (event) => {
	const workspaceId = event.params.id;
	try {
		await requireChatAccess(event);
		const client = await createParchmentServerClient(event, { mode: 'session' });
		const inputs = await getConversationCompactionInputs(client, workspaceId, 30);
		const cooldownRemainingMs = reserveWorkspaceSummaryAttempt(workspaceId);
		if (cooldownRemainingMs > 0) {
			return json({
				summary: inputs.contextSummary,
				skipped: true,
				retry_after_ms: cooldownRemainingMs
			});
		}
		if (inputs.messages.length < 4) {
			workspaceSummaryAttempts.delete(workspaceId);
			return json({ summary: inputs.contextSummary, skipped: true });
		}
		const conversationText = inputs.messages
			.map((message) => `${message.role}: ${_workspaceSummaryMessageText(message)}`)
			.join('\n');
		const prompt = `CHERRY RUNTIME WORKSPACE COMPACTION
Compact a coffee business workspace for future Cherry Runtime context.
${inputs.contextSummary ? `Previous summary:\n${inputs.contextSummary}\n` : ''}
Recent conversation:
${conversationText}

Produce a concise summary (max 500 words) that captures key facts, preferences, decisions, ongoing work, and future-relevant context. Drop pleasantries and resolved questions.`;
		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${OPENROUTER_API_KEY}`
			},
			body: JSON.stringify({
				model: CHERRY_RUNTIME_MODEL,
				messages: [{ role: 'user', content: prompt }],
				max_tokens: 800,
				temperature: 0.3
			})
		});
		if (!response.ok) {
			workspaceSummaryAttempts.delete(workspaceId);
			return json({ error: `OpenRouter error: ${await response.text()}` }, { status: 502 });
		}
		const result = await response.json();
		const summary = _clampWorkspaceContextSummary(result.choices?.[0]?.message?.content || '');
		const updated = await updateConversationSummary(client, workspaceId, {
			expectedResetEpoch: inputs.resetEpoch,
			expectedSummaryVersion: inputs.summaryVersion,
			expectedMessageHighWater: inputs.messageHighWater,
			contextSummary: summary
		});
		return json({ summary: updated.contextSummary });
	} catch (error) {
		workspaceSummaryAttempts.delete(workspaceId);
		return failure(error);
	}
};
