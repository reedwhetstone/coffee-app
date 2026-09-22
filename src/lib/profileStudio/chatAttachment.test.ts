import { describe, expect, it } from 'vitest';
import { buildReferenceAttachmentPrompt } from './chatAttachment';

describe('Profile Studio chat attachments', () => {
	it('persists only a safe reference label and opaque profile id', () => {
		const prompt = buildReferenceAttachmentPrompt('What changed?', {
			id: 'profile-123',
			title: 'Artisan chat reference'
		});

		expect(prompt).toContain('What changed?');
		expect(prompt).toContain('Reference profile ID: profile-123');
		expect(prompt).toContain('not an executed roast');
		expect(prompt).not.toContain('.alog');
	});

	it('supplies a bounded discovery prompt for attachment-only sends', () => {
		expect(
			buildReferenceAttachmentPrompt('', {
				id: 'profile-123',
				title: 'Artisan chat reference'
			})
		).toContain('help me decide what to preserve or change');
	});
});
