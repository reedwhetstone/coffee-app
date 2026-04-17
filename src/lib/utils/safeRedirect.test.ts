import { describe, expect, it } from 'vitest';
import { sanitizeNextPath } from './safeRedirect';

describe('sanitizeNextPath', () => {
	it('returns the fallback for null, undefined, and empty strings', () => {
		expect(sanitizeNextPath(null)).toBe('/dashboard');
		expect(sanitizeNextPath(undefined)).toBe('/dashboard');
		expect(sanitizeNextPath('')).toBe('/dashboard');
	});

	it('respects a custom fallback when provided', () => {
		expect(sanitizeNextPath(null, '/catalog')).toBe('/catalog');
	});

	it('accepts simple internal paths', () => {
		expect(sanitizeNextPath('/dashboard')).toBe('/dashboard');
		expect(sanitizeNextPath('/subscription?plan=intelligence-monthly&intent=checkout')).toBe(
			'/subscription?plan=intelligence-monthly&intent=checkout'
		);
		expect(sanitizeNextPath('/analytics#pricing')).toBe('/analytics#pricing');
	});

	it('rejects absolute URLs with a scheme', () => {
		expect(sanitizeNextPath('https://attacker.example/path')).toBe('/dashboard');
		expect(sanitizeNextPath('http://attacker.example')).toBe('/dashboard');
		expect(sanitizeNextPath('javascript:alert(1)')).toBe('/dashboard');
		expect(sanitizeNextPath('data:text/html,<script>1</script>')).toBe('/dashboard');
	});

	it('rejects protocol-relative URLs', () => {
		expect(sanitizeNextPath('//attacker.example')).toBe('/dashboard');
		expect(sanitizeNextPath('//attacker.example/path')).toBe('/dashboard');
	});

	it('rejects backslash-smuggled URLs that browsers may normalize', () => {
		expect(sanitizeNextPath('/\\attacker.example')).toBe('/dashboard');
		expect(sanitizeNextPath('/\\/attacker.example')).toBe('/dashboard');
	});

	it('rejects paths with control characters or whitespace', () => {
		expect(sanitizeNextPath('/foo\nbar')).toBe('/dashboard');
		expect(sanitizeNextPath('/foo\tbar')).toBe('/dashboard');
		expect(sanitizeNextPath('/foo bar')).toBe('/dashboard');
		expect(sanitizeNextPath('/foo\x00bar')).toBe('/dashboard');
	});

	it('rejects non-string input defensively', () => {
		expect(sanitizeNextPath(123 as unknown as string)).toBe('/dashboard');
		expect(sanitizeNextPath({} as unknown as string)).toBe('/dashboard');
	});
});
