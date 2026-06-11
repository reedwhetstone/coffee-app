import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({ OPENROUTER_API_KEY: 'test-key' }));
vi.mock('$lib/server/auth', () => ({ requireChatAccess: vi.fn() }));

import {
	_clampWorkspaceContextSummary,
	_workspaceSummaryCooldownRemainingMs,
	_workspaceSummaryMessageText
} from './+server';

describe('workspace summary message text', () => {
	it('prefers full text parts over truncated duplicate content', () => {
		const longText = 'x'.repeat(13_000);

		expect(
			_workspaceSummaryMessageText({
				content: 'x'.repeat(12_000),
				parts: [{ type: 'text', text: longText }]
			})
		).toBe(longText);
	});

	it('falls back to content when parts do not contain text', () => {
		expect(
			_workspaceSummaryMessageText({
				content: 'fallback content',
				parts: [{ type: 'tool-call', text: 'ignore me' }]
			})
		).toBe('fallback content');
	});
});

describe('workspace context summary clamping', () => {
	it('caps provider output at the database context_summary limit', () => {
		expect(_clampWorkspaceContextSummary('x'.repeat(2_001))).toHaveLength(2_000);
	});

	it('leaves summaries within the limit unchanged', () => {
		const summary = 'short summary';

		expect(_clampWorkspaceContextSummary(summary)).toBe(summary);
	});
});

describe('workspace summary cooldown', () => {
	it('reports no remaining cooldown for an unreserved workspace', () => {
		expect(_workspaceSummaryCooldownRemainingMs('workspace-without-attempt', 1_000)).toBe(0);
	});
});
