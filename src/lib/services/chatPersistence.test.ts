import { describe, expect, it } from 'vitest';

import { buildPersistedChatMessages } from './chatPersistence';

describe('buildPersistedChatMessages', () => {
	it('omits synthetic client timestamps when messages do not carry real createdAt values', () => {
		const payload = buildPersistedChatMessages([
			{ id: 'msg-user', role: 'user', parts: [{ type: 'text', text: 'Find naturals' }] },
			{ id: 'msg-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Here are some.' }] }
		]);

		expect(payload).toEqual([
			expect.objectContaining({
				client_message_id: 'msg-user',
				content: 'Find naturals'
			}),
			expect.objectContaining({
				client_message_id: 'msg-assistant',
				content: 'Here are some.'
			})
		]);
		expect(payload[0]).not.toHaveProperty('client_created_at');
		expect(payload[1]).not.toHaveProperty('client_created_at');
	});

	it('preserves real message creation timestamps when present', () => {
		const payload = buildPersistedChatMessages([
			{
				id: 'msg-user',
				role: 'user',
				parts: [{ type: 'text', text: 'Find naturals' }],
				createdAt: new Date('2026-06-14T17:18:39.123Z')
			}
		]);

		expect(payload[0].client_created_at).toBe('2026-06-14T17:18:39.123Z');
	});
});
