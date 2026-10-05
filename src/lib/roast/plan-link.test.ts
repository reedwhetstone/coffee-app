import { describe, expect, it } from 'vitest';
import { planHref, readPlanLink, savedPlanHref } from './plan-link';

describe('plan links', () => {
	it('reads roast, reference, and saved-plan links', () => {
		expect(readPlanLink(new URLSearchParams('from=roast:4531'))).toEqual({
			kind: 'from',
			side: { type: 'roast', id: 4531 }
		});
		expect(readPlanLink(new URLSearchParams('from=ref=bad'))).toEqual({ kind: 'new' });
		expect(
			readPlanLink(new URLSearchParams('from=ref:aaaaaaaa-0000-4000-8000-000000000003'))
		).toEqual({ kind: 'from', side: { type: 'ref', id: 'aaaaaaaa-0000-4000-8000-000000000003' } });
		expect(
			readPlanLink(new URLSearchParams('plan=aaaaaaaa-0000-4000-8000-000000000003&from=roast:4531'))
		).toEqual({ kind: 'plan', id: 'aaaaaaaa-0000-4000-8000-000000000003' });
		expect(readPlanLink(new URLSearchParams('plan=bad'))).toEqual({ kind: 'new' });
	});
	it('writes direct URLs', () => {
		expect(planHref({ type: 'roast', id: 4531 })).toBe('/roast/plan?from=roast:4531');
		expect(savedPlanHref('aaaaaaaa-0000-4000-8000-000000000003')).toBe(
			'/roast/plan?plan=aaaaaaaa-0000-4000-8000-000000000003'
		);
	});
});
