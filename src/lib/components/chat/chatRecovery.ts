import type { UIMessage } from 'ai';
import {
	coffeeEvidenceCacheThroughPart,
	isCompletedCoffeeSearch,
	validCoffeeEvidence as validCoffee
} from '$lib/services/coffeeEvidence';

export type InterruptedTurnStatus = 'stopped' | 'error';
const TURN_STATUS_PART = 'data-cherry-turn-status';
const COFFEE_TOOLS = new Set(['coffee_catalog_search', 'catalog_rank']);

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function getInterruptedTurnStatus(parts: unknown[]): InterruptedTurnStatus | null {
	for (const part of parts) {
		const candidate = record(part);
		const data = record(candidate?.data);
		if (
			candidate?.type === TURN_STATUS_PART &&
			data?.version === 1 &&
			(data.status === 'stopped' || data.status === 'error')
		) {
			return data.status;
		}
	}
	return null;
}

function isCompletedCoffeeEvidence(
	part: UIMessage['parts'][number],
	messages: UIMessage[],
	messageIndex: number,
	partIndex: number
): boolean {
	const candidate = record(part);
	if (!candidate || !part.type.startsWith('tool-') || candidate.state !== 'output-available') {
		return false;
	}
	const output = record(candidate.output);
	if (!output || output.success === false || output.error || output.action_card) return false;
	const tool = candidate.toolName ?? part.type.slice('tool-'.length);
	if (typeof tool !== 'string') return false;
	if (COFFEE_TOOLS.has(tool)) return isCompletedCoffeeSearch(part);
	if (tool !== 'present_results') return false;
	const presentation = record(output.presentation);
	if (
		!presentation ||
		typeof presentation.source_tool !== 'string' ||
		!COFFEE_TOOLS.has(presentation.source_tool) ||
		presentation.canvas_action === 'clear' ||
		!Array.isArray(presentation.items) ||
		presentation.items.length === 0
	) {
		return false;
	}
	const cache = coffeeEvidenceCacheThroughPart(messages, messageIndex, partIndex).get(
		presentation.source_tool
	);
	return presentation.items.every((value) => {
		const item = record(value);
		return typeof item?.id === 'number' && validCoffee(cache?.get(item.id));
	});
}

/** Finalize an unsaved attempt once the transport has settled, never while it is streaming. */
export function recoverInterruptedTurn(
	messages: UIMessage[],
	boundary: number | null,
	status: InterruptedTurnStatus,
	options: { allowRetention?: boolean } = {}
): UIMessage[] {
	if (boundary === null) return messages;
	const prefix = messages.slice(0, boundary);
	if (options.allowRetention === false) return prefix;
	let hasEvidence = false;
	const recovered = messages.slice(boundary).map((message, offset) => {
		if (message.role !== 'assistant') return message;
		const parts: UIMessage['parts'] = [];
		for (const [partIndex, part] of message.parts.entries()) {
			if (part.type === 'text') {
				parts.push({ ...part, state: 'done' });
			} else if (isCompletedCoffeeEvidence(part, messages, boundary + offset, partIndex)) {
				parts.push(part);
				hasEvidence = true;
			}
		}
		parts.push({ type: TURN_STATUS_PART, data: { version: 1, status } });
		return { ...message, parts };
	});
	return status === 'error' && !hasEvidence ? prefix : [...prefix, ...recovered];
}

/** Request-only projection: preserve durable history, but never replay unfinished tool calls. */
export function prepareChatRequestMessages(messages: UIMessage[]): UIMessage[] {
	return messages.map((message) => {
		const status = getInterruptedTurnStatus(message.parts);
		const parts = message.parts.filter((part) => {
			if (part.type === TURN_STATUS_PART) return false;
			if (!part.type.startsWith('tool-') && part.type !== 'dynamic-tool') return true;
			const state = record(part)?.state;
			return state === 'output-available' || state === 'output-error' || state === 'output-denied';
		});
		if (status && message.role === 'assistant') {
			parts.push({
				type: 'text',
				text:
					status === 'stopped'
						? '[This response was stopped before completion. Retained results are partial.]'
						: '[This response was interrupted by an error. Retained results are partial.]'
			});
		}
		return { ...message, parts };
	});
}

/** An unload can be canceled: never bind an unfinished attempt's IDs to a mutable payload. */
export function finalizedMessagesForUnload(
	messages: UIMessage[],
	boundary: number | null,
	isActive: boolean
): UIMessage[] {
	if (!isActive) return messages;
	return boundary === null ? [] : messages.slice(0, boundary);
}

export type ChatFailureKind =
	| 'timeout'
	| 'access'
	| 'tool'
	| 'persistence'
	| 'no-results'
	| 'unknown';

export function rollbackFailedTurn<T>(
	messages: T[],
	messageCountBeforeSubmission: number | null
): T[] {
	if (messageCountBeforeSubmission === null) return messages;
	return messages.slice(0, messageCountBeforeSubmission);
}

export function classifyChatFailure(error: unknown): {
	kind: ChatFailureKind;
	message: string;
	retryable: boolean;
} {
	const raw = error instanceof Error ? error.message : String(error || '');
	const value = raw.toLowerCase();
	if (/401|403|unauthor|forbidden|access|entitlement/.test(value)) {
		return {
			kind: 'access',
			message: 'This request needs access you do not currently have.',
			retryable: false
		};
	}
	if (/abort|timeout|timed out|deadline/.test(value)) {
		return {
			kind: 'timeout',
			message: 'The response took too long. Retry, or revise the prompt.',
			retryable: true
		};
	}
	if (/persist|workspace|save/.test(value)) {
		return {
			kind: 'persistence',
			message: 'The response could not be saved. Retry before leaving this page.',
			retryable: true
		};
	}
	if (/no results|not found|empty result/.test(value)) {
		return {
			kind: 'no-results',
			message: 'No matching evidence was found. Broaden the request and try again.',
			retryable: false
		};
	}
	if (/tool|function/.test(value)) {
		return {
			kind: 'tool',
			message: 'A data tool failed while building this response. Retry the request.',
			retryable: true
		};
	}
	return {
		kind: 'unknown',
		message: raw || 'The response failed. Please try again.',
		retryable: true
	};
}
