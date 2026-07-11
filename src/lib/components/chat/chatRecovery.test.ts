import { describe, expect, it } from 'vitest';
import { classifyChatFailure } from './chatRecovery';

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
