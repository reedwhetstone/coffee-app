import { describe, expect, it } from 'vitest';
import { workspaceMessageClientId } from './workspaceMessageIdentity';

describe('workspaceMessageClientId', () => {
	it('keeps the original message identity across database hydration', () => {
		expect(
			workspaceMessageClientId({
				id: 'workspace-row-uuid',
				client_message_id: 'assistant-original'
			})
		).toBe('assistant-original');
	});

	it('falls back for legacy rows without a client message ID', () => {
		expect(workspaceMessageClientId({ id: 'workspace-row-uuid', client_message_id: null })).toBe(
			'workspace-row-uuid'
		);
	});
});
