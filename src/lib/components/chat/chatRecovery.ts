export type ChatFailureKind =
	| 'timeout'
	| 'access'
	| 'tool'
	| 'persistence'
	| 'no-results'
	| 'unknown';

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
