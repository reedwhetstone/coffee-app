import { describe, expect, it } from 'vitest';
import { usesStandaloneShell } from './routeShells';

describe('usesStandaloneShell', () => {
	it.each(['/auth/cli', '/auth/cli/confirm'])('isolates CLI authorization route %s', (pathname) => {
		expect(usesStandaloneShell(pathname)).toBe(true);
	});

	it.each(['/auth', '/auth/cli-callback', '/catalog', '/'])('does not isolate route %s', (pathname) => {
		expect(usesStandaloneShell(pathname)).toBe(false);
	});
});
