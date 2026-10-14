import { describe, expect, it } from 'vitest';
import { getDecafPresentation } from './decafPresentation';

describe('getDecafPresentation', () => {
	it('uses the structured decaf flag and method independently of farm processing', () => {
		expect(
			getDecafPresentation({
				decaffeinated: true,
				decafMethod: { label: 'Swiss Water' },
				processing: 'Washed'
			})
		).toEqual({ isDecaffeinated: true, methodLabel: 'Swiss Water' });
	});

	it('lets an explicit false override a stale legacy label and method', () => {
		expect(
			getDecafPresentation({
				decaffeinated: false,
				decafMethod: { label: 'Swiss Water' },
				processing: 'Swiss Water Decaf'
			})
		).toEqual({ isDecaffeinated: false, methodLabel: null });
	});

	it('falls back to an old decaf processing label and its named method', () => {
		expect(getDecafPresentation({ processing: 'Mountain Water Decaf' })).toEqual({
			isDecaffeinated: true,
			methodLabel: 'Mountain Water'
		});
	});

	it('recognizes a legacy decaf label when no method is disclosed', () => {
		expect(getDecafPresentation({ processing: 'Pulped Natural, Decaf' })).toEqual({
			isDecaffeinated: true,
			methodLabel: null
		});
	});

	it('does not inspect coffee or supplier names for decaf', () => {
		expect(getDecafPresentation({ processing: 'Washed' })).toEqual({
			isDecaffeinated: false,
			methodLabel: null
		});
	});

	it('treats a disclosed null method as authoritative instead of re-reading the label', () => {
		expect(
			getDecafPresentation({
				decaffeinated: true,
				decafMethod: null,
				processing: 'Swiss Water Decaf'
			})
		).toEqual({ isDecaffeinated: true, methodLabel: null });
	});
});
