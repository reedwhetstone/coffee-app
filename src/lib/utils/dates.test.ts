import { describe, expect, it } from 'vitest';
import { formatBlogDate, prepareDateForAPI } from './dates';

describe('formatBlogDate', () => {
	it('keeps ISO date-only values on their calendar day', () => {
		expect(formatBlogDate('2026-08-18')).toBe('August 18, 2026');
	});
});

describe('prepareDateForAPI', () => {
	it('normalizes timestamp values for date-only API contracts', () => {
		expect(prepareDateForAPI('2026-09-01T19:29:00.000Z')).toBe('2026-09-01');
	});
});
