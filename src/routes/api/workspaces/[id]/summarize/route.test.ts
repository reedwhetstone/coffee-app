import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({ OPENROUTER_API_KEY: 'test-key' }));
vi.mock('$lib/server/auth', () => ({ requireChatAccess: vi.fn() }));

import { _workspaceSummaryMessageText } from './+server';

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
