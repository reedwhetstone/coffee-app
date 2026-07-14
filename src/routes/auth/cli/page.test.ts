import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import type { PageData } from './$types';

const TOKEN = 'signed.request.token'.padEnd(80, 'x');
const mockFetch = vi.fn();

const data: PageData = {
	session: null,
	user: { id: 'user-1', email: 'user@example.com', role: 'authenticated' },
	role: 'viewer',
	ppiAccess: false,
	supabase: {} as PageData['supabase'],
	requestToken: TOKEN,
	request: {
		machineName: 'roaster-host',
		expiresAt: '2026-07-14T23:00:00.000Z',
		scopes: ['catalog:read']
	},
	failure: null
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('fetch', mockFetch);
});

describe('/auth/cli consent page', () => {
	it('uses the JSON approval endpoint instead of a native form POST', async () => {
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ approved: true, signedOut: false, terminal: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		const { container } = render(Page, { props: { data } });

		expect(container.querySelector('form')).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Authorize CLI' }));

		expect(mockFetch).toHaveBeenCalledWith('/auth/cli/approve', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ request: TOKEN })
		});
		await waitFor(() => expect(screen.getByTestId('cli-auth-approved')).toBeInTheDocument());
	});
});
