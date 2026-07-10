import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ProfitPage from './+page.svelte';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://app.test/profit') }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	pageState.url = new URL('https://app.test/profit');
});

describe('profit page loading states', () => {
	it('replaces the initial skeleton with a true empty state', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url === '/api/profit') return jsonResponse({ sales: [], profit: [] });
				return jsonResponse({ data: [] });
			})
		);

		render(ProfitPage, { data: { role: 'member' } });

		await waitFor(() => expect(screen.getByText('No profit activity yet')).toBeInTheDocument());
		expect(screen.queryByText('Profit data could not be loaded')).not.toBeInTheDocument();
	});

	it('replaces the initial skeleton with an actionable error state', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url === '/api/profit') return jsonResponse({ error: 'unavailable' }, 503);
				return jsonResponse({ data: [] });
			})
		);

		render(ProfitPage, { data: { role: 'member' } });

		await waitFor(() =>
			expect(screen.getByText('Profit data could not be loaded')).toBeInTheDocument()
		);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		expect(screen.queryByText('No profit activity yet')).not.toBeInTheDocument();
	});
});
