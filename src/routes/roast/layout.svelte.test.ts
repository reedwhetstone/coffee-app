import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';

const { pageState } = vi.hoisted(() => ({
	pageState: { data: {} as Record<string, unknown> }
}));

vi.mock('$app/state', () => ({ page: pageState }));

const roastPage = vi.fn(() => '<p>the roast page</p>');
const children = createRawSnippet(() => ({ render: roastPage }));

describe('roast route layout', () => {
	beforeEach(() => {
		roastPage.mockClear();
	});

	it('draws the locked page and never mounts the roast page for a locked account', () => {
		pageState.data = { roastsLocked: true };

		render(Layout, { children });

		expect(screen.getByRole('link', { name: 'Unlock Mallard Studio' })).toBeTruthy();
		expect(screen.queryByText('the roast page')).toBeNull();
		expect(roastPage).not.toHaveBeenCalled();
	});

	it.each([
		{ page: 'the roast page for a member', data: { roastsLocked: false } },
		{ page: 'a child page, which sets no lock', data: {} }
	])('renders $page unchanged', ({ data }) => {
		pageState.data = data;

		render(Layout, { children });

		expect(screen.getByText('the roast page')).toBeTruthy();
		expect(screen.queryByRole('link', { name: 'Unlock Mallard Studio' })).toBeNull();
	});
});
