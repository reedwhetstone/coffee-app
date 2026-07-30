import { describe, expect, it } from 'vitest';

import { checkoutAdmissionContextFromMetadata } from './checkoutAdmissions';

describe('checkoutAdmissionContextFromMetadata', () => {
	it('returns no context for pre-cutover sessions without admission metadata', () => {
		expect(checkoutAdmissionContextFromMetadata({}, 'cs_legacy')).toBeNull();
	});

	it('returns context for complete admission metadata', () => {
		expect(
			checkoutAdmissionContextFromMetadata(
				{
					supabase_user_id: 'user-123',
					parchment_admission_id: 'admission-123',
					checkout_request_id: 'request-123'
				},
				'cs_managed'
			)
		).toEqual({
			ownerId: 'user-123',
			admissionId: 'admission-123',
			requestId: 'request-123',
			stripeSessionId: 'cs_managed'
		});
	});

	it.each([
		{ supabase_user_id: 'user-123' },
		{ parchment_admission_id: 'admission-123' },
		{ checkout_request_id: 'request-123' }
	])('rejects partial admission metadata: %o', (metadata) => {
		expect(() => checkoutAdmissionContextFromMetadata(metadata, 'cs_partial')).toThrow(
			'Managed checkout session is missing Checkout admission metadata'
		);
	});
});
