import { describe, expect, it } from 'vitest';
import { formatSourceName } from './formatters';

describe('formatSourceName', () => {
	it('turns database source slugs into standard display labels', () => {
		expect(formatSourceName('smokin_beans')).toBe('Smokin Beans');
		expect(formatSourceName('prime-green-coffee')).toBe('Prime Green Coffee');
		expect(formatSourceName('  cafe   imports  ')).toBe('Cafe Imports');
	});

	it('preserves canonical punctuation and brand capitalization where the slug cannot express it', () => {
		expect(formatSourceName('sweet_maria')).toBe("Sweet Maria's");
		expect(formatSourceName('bc_green_coffee')).toBe('BC Green Coffee');
		expect(formatSourceName('tm_ward_coffee')).toBe('T.M. Ward Coffee');
		expect(formatSourceName('stonex_specialty')).toBe('StoneX Specialty');
	});

	it('returns an empty label when no source is available', () => {
		expect(formatSourceName(null)).toBe('');
		expect(formatSourceName(undefined)).toBe('');
		expect(formatSourceName('   ')).toBe('');
	});
});
