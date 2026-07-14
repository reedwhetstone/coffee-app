import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import GenUIBlockRenderer from './GenUIBlockRenderer.svelte';
import type { ActionCardBlock, CoffeeCardsBlock, ErrorBlock } from '$lib/types/genui';

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

	it.each([
		['desktop', false],
		['mobile', true]
	])('renders only the compact error preview in chat on %s', (_viewport, matches) => {
		setMobileViewport(matches);
		const block: ErrorBlock = {
			type: 'error',
			version: 1,
			data: { message: 'Catalog lookup failed', retryable: true }
		};

		const { container } = render(GenUIBlockRenderer, {
			block,
			renderMode: 'chat'
		});

		expect(container.querySelector('.genui-preview')).toHaveClass('inline-block');
		expect(container.querySelector('.genui-inline-evidence')).not.toBeInTheDocument();
		expect(container.querySelector('.genui-block')).not.toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getAllByText('Catalog lookup failed')).toHaveLength(1);
	});

	it('renders a compact coffee link on mobile and focuses its canvas block', async () => {
		setMobileViewport(true);
		const onAction = vi.fn();
		const block: CoffeeCardsBlock = {
			type: 'coffee-cards',
			version: 1,
			data: [{ id: 7, name: 'Test Coffee', country: 'Ethiopia' } as never]
		};

		const { container } = render(GenUIBlockRenderer, {
			block,
			renderMode: 'chat',
			canvasBlockId: 'coffee-1',
			onAction
		});

		expect(container.querySelector('.genui-preview')).toBeInTheDocument();
		expect(container.querySelector('.genui-inline-evidence')).not.toBeInTheDocument();
		expect(container.querySelector('.genui-block')).not.toBeInTheDocument();
		expect(screen.queryByText('View in catalog')).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /Test Coffee Ethiopia/ }));

		expect(onAction).toHaveBeenCalledWith({
			type: 'focus-canvas-block',
			blockId: 'coffee-1'
		});
	});

	it('keeps action execution in the shared canvas and focuses it from the mobile preview', async () => {
		setMobileViewport(true);
		const onAction = vi.fn();
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
			canvasBlockId: 'action-1',
			onAction
		});

		expect(container.querySelector('.genui-preview')).toBeInTheDocument();
		expect(container.querySelector('.genui-inline-evidence')).not.toBeInTheDocument();
		expect(container.querySelector('.genui-block')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: /Record this sale/ }));

		expect(onAction).toHaveBeenCalledOnce();
		expect(onAction).toHaveBeenCalledWith({ type: 'focus-canvas-block', blockId: 'action-1' });
	});
});
