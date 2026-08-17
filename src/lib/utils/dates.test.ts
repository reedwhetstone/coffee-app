import { describe, expect, it } from 'vitest';
import { formatBlogDate } from './dates';

describe('formatBlogDate', () => {
	it('keeps ISO date-only values on their calendar day', () => {
		expect(formatBlogDate('2026-08-18')).toBe('August 18, 2026');
	});
});
