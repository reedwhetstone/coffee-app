import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GenUIBlockRenderer from './GenUIBlockRenderer.svelte';
import type { ActionCardBlock, ErrorBlock } from '$lib/types/genui';

describe('GenUIBlockRenderer chat evidence', () => {
	function setMobileViewport(matches: boolean) {
		vi.stubGlobal('matchMedia', (query: string) => ({
			matches,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn()
		}));
	}

	beforeEach(() => {
		setMobileViewport(false);
	});

	it('mounts full evidence only on mobile', async () => {
		setMobileViewport(true);
		const block: ErrorBlock = {
			type: 'error',
			version: 1,
			data: { message: 'Catalog lookup failed', retryable: true }
		};

		const { container } = render(GenUIBlockRenderer, {
			block,
			renderMode: 'chat'
		});

		await waitFor(() => {
			expect(container.querySelector('.genui-inline-evidence')).toHaveClass('md:hidden');
		});
		expect(container.querySelector('.genui-preview')).not.toBeInTheDocument();
		expect(screen.getByRole('alert')).toHaveTextContent('Catalog lookup failed');
		expect(screen.getAllByText('Catalog lookup failed')).toHaveLength(1);
	});

	it('does not mount full evidence on desktop', () => {
		const block: ErrorBlock = {
			type: 'error',
			version: 1,
			data: { message: 'Catalog lookup failed', retryable: true }
		};

		const { container } = render(GenUIBlockRenderer, {
			block,
			renderMode: 'chat'
		});

		expect(container.querySelector('.genui-inline-evidence')).not.toBeInTheDocument();
		expect(container.querySelector('.genui-preview')).toHaveClass('hidden', 'md:inline-block');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getAllByText('Catalog lookup failed')).toHaveLength(1);
	});

	it('keeps action execution in the shared canvas', async () => {
		setMobileViewport(true);
		const block: ActionCardBlock = {
			type: 'action-card',
			version: 1,
			data: {
				actionType: 'record_sale',
				summary: 'Record this sale',
				fields: [],
				status: 'proposed'
			}
		};

		const { container } = render(GenUIBlockRenderer, {
			block,
			renderMode: 'chat',
			canvasBlockId: 'action-1'
		});

		await waitFor(() => {
			expect(container.querySelector('.genui-inline-evidence')).toBeInTheDocument();
		});
		expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
		expect(screen.getAllByRole('button', { name: /Record this sale/ })).toHaveLength(1);
	});
});
