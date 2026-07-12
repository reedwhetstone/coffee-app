import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import GenUIBlockRenderer from './GenUIBlockRenderer.svelte';
import type { ErrorBlock } from '$lib/types/genui';

describe('GenUIBlockRenderer chat evidence', () => {
	it('renders full mobile evidence and a compact desktop preview', () => {
		const block: ErrorBlock = {
			type: 'error',
			version: 1,
			data: { message: 'Catalog lookup failed', retryable: true }
		};

		const { container } = render(GenUIBlockRenderer, {
			block,
			renderMode: 'chat'
		});

		expect(container.querySelector('.genui-inline-evidence')).toHaveClass('md:hidden');
		expect(container.querySelector('.genui-preview')).toHaveClass('hidden', 'md:inline-block');
		expect(screen.getByRole('alert')).toHaveTextContent('Catalog lookup failed');
		expect(screen.getAllByText('Catalog lookup failed')).toHaveLength(2);
	});
});
