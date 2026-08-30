import { describe, expect, it } from 'vitest';
import {
	buildCherryConversationExport,
	cherryConversationExportFilename
} from './cherryConversationExport';

describe('Cherry conversation export', () => {
	const exportedAt = new Date('2026-08-29T12:00:00.000Z');

	it('uses the Cherry system identity for generated responses', () => {
		const markdown = buildCherryConversationExport(
			[
				{ role: 'user', parts: [{ type: 'text', text: 'Compare these coffees.' }] },
				{ role: 'assistant', parts: [{ type: 'text', text: 'Here is the evidence.' }] }
			],
			exportedAt
		);

		expect(markdown).toContain('# Cherry conversation export');
		expect(markdown).toContain('## User');
		expect(markdown).toContain('## Cherry');
		expect(markdown).not.toContain('Parchment Intelligence');
		expect(markdown).not.toContain('## Assistant');
	});

	it('uses a stable Cherry filename', () => {
		expect(cherryConversationExportFilename(exportedAt)).toBe('cherry-conversation-2026-08-29.md');
	});
});
