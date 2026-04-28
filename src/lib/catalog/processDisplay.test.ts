import { describe, expect, it } from 'vitest';
import {
	formatProcessDisplayValue,
	isPublicProcessFacetOption,
	normalizeProcessDisplayValue
} from './processDisplay';

describe('public process display helpers', () => {
	it.each([
		'unknown',
		'not specified',
		'None Stated',
		'not stated',
		'not disclosed',
		'unspecified',
		'n/a',
		''
	])('treats placeholder process value %j as missing', (value) => {
		expect(normalizeProcessDisplayValue(value)).toBeNull();
		expect(isPublicProcessFacetOption(value)).toBe(false);
	});

	it('preserves meaningful process facet values and explicit additive none semantics', () => {
		expect(normalizeProcessDisplayValue('anaerobic')).toBe('anaerobic');
		expect(normalizeProcessDisplayValue('none')).toBe('none');
		expect(isPublicProcessFacetOption('raised_bed')).toBe(true);
	});

	it('formats canonical values for display', () => {
		expect(formatProcessDisplayValue('raised_bed')).toBe('Raised Bed');
		expect(formatProcessDisplayValue('high_detail')).toBe('High Detail');
	});
});
