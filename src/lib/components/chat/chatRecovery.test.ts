import { describe, expect, it } from 'vitest';
import { classifyChatFailure, rollbackFailedTurn } from './chatRecovery';

describe('rollbackFailedTurn', () => {
	it('removes the failed user turn so a revised prompt replaces it', () => {
		const messages = [
			{ id: 'assistant-1', role: 'assistant' },
			{ id: 'user-failed', role: 'user' },
			{ id: 'assistant-partial', role: 'assistant' }
		];

		expect(rollbackFailedTurn(messages, 1)).toEqual([messages[0]]);
	});

	it('leaves messages unchanged when no submission is being tracked', () => {
		const messages = [{ id: 'user-1', role: 'user' }];
		expect(rollbackFailedTurn(messages, null)).toBe(messages);
	});
});

describe('classifyChatFailure', () => {
	it('makes timeouts recoverable', () => {
		expect(classifyChatFailure(new Error('request timed out'))).toMatchObject({
			kind: 'timeout',
			retryable: true
		});
	});

	it('does not offer blind retries for access failures', () => {
		expect(classifyChatFailure(new Error('403 forbidden'))).toMatchObject({
			kind: 'access',
			retryable: false
		});
	});

	it('distinguishes tool, persistence, and no-results failures', () => {
		expect(classifyChatFailure(new Error('tool execution failed')).kind).toBe('tool');
		expect(classifyChatFailure(new Error('workspace save failed')).kind).toBe('persistence');
		expect(classifyChatFailure(new Error('no results found')).kind).toBe('no-results');
	});
});
