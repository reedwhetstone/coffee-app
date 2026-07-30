import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnifiedHeader from './UnifiedHeader.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: {
		url: new URL('http://localhost/analytics')
	}
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('$lib/types/auth.types', async (importOriginal) => {
	const original = await importOriginal<typeof import('$lib/types/auth.types')>();
	return {
		...original,
		checkRole: () => false
	};
});

describe('UnifiedHeader', () => {
	beforeEach(() => {
		goto.mockReset();
		pageState.url = new URL('http://localhost/analytics');
	});

	it('keeps anonymous desktop report navigation access-aware', () => {
		render(UnifiedHeader, { session: null, role: 'viewer' });

		expect(screen.getByRole('navigation', { name: 'Market Index report sections' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Read' }).getAttribute('href')).toBe(
			'/analytics#market-read'
		);
		expect(screen.queryByRole('link', { name: 'Disclosure Index' })).toBeNull();
	});

	it('includes signed-in report depth when that section can render', () => {
		render(UnifiedHeader, {
			session: { user: { email: 'viewer@example.com' } },
			role: 'viewer'
		});

		expect(screen.getByRole('link', { name: 'Disclosure Index' }).getAttribute('href')).toBe(
			'/analytics#disclosure-index'
		);
	});

	it('does not add report navigation to unrelated public pages', () => {
		pageState.url = new URL('http://localhost/catalog');

		render(UnifiedHeader, { session: null, role: 'viewer' });

		expect(screen.queryByRole('navigation', { name: 'Market Index report sections' })).toBeNull();
	});
});
