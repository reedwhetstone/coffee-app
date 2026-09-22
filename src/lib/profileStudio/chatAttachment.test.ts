import { describe, expect, it } from 'vitest';
import {
	buildProfileStudioHandoffRequest,
	buildReferenceAttachmentRequest,
	readProfileStudioHandoff
} from './chatAttachment';

describe('Profile Studio chat attachments', () => {
	it('keeps the opaque profile id in request context, never the visible request', () => {
		const request = buildReferenceAttachmentRequest('What changed?', {
			id: 'profile-123',
			title: 'Artisan chat reference'
		});

		expect(request.text).toBe('What changed?');
		expect(request.context.text).toContain('Reference profile ID: profile-123');
		expect(request.context.text).toContain('not an executed roast');
		expect(request.context.label).toBe('Artisan chat reference · saved reference');
		expect(JSON.stringify(request)).not.toContain('.alog');
	});

	it('asks for explicit intent on attachment-only sends', () => {
		const request = buildReferenceAttachmentRequest('', {
			id: 'profile-123',
			title: 'Artisan chat reference'
		});

		expect(request.text).toContain('leave it saved');
		expect(request.text).toContain('compare it with another profile');
		expect(request.text).toContain('import it as an executed roast');
		expect(request.text).not.toContain('profile-123');
	});

	it('keeps selected comparison identities in transport context, not the visible request', () => {
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
		const request = buildProfileStudioHandoffRequest('Explain this comparison.', handoff!);
		expect(request.text).toBe('Explain this comparison.');
		expect(request.context.text).toContain(
			'left executed_roast 42; right reference_profile profile-7'
		);
		expect(request.context.label).toBeUndefined();
	});
});
