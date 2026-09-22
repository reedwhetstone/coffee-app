import { describe, expect, it } from 'vitest';
import {
	buildProfileStudioHandoffPrompt,
	buildReferenceAttachmentPrompt,
	readProfileStudioHandoff
} from './chatAttachment';

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

	it('asks for explicit intent on attachment-only sends', () => {
		const prompt = buildReferenceAttachmentPrompt('', {
			id: 'profile-123',
			title: 'Artisan chat reference'
		});

		expect(prompt).toContain('leave it saved');
		expect(prompt).toContain('compare it with another profile');
		expect(prompt).toContain('import it as an executed roast');
	});

	it('keeps selected comparison identities in transport context, not the visible seed', () => {
		const handoff = readProfileStudioHandoff(
			new URLSearchParams(
				'source=profile-studio&left_kind=executed_roast&left_id=42&right_kind=reference_profile&right_id=profile-7'
			)
		);
		expect(handoff).toEqual({
			leftKind: 'executed_roast',
			leftId: '42',
			rightKind: 'reference_profile',
			rightId: 'profile-7'
		});
		expect(buildProfileStudioHandoffPrompt('Explain this comparison.', handoff!)).toContain(
			'left executed_roast 42; right reference_profile profile-7'
		);
	});
});
