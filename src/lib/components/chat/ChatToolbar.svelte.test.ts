import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import ChatToolbar from './ChatToolbar.svelte';

describe('ChatToolbar progressive disclosure', () => {
	it('groups secondary and destructive controls under workspace actions', async () => {
		const onExport = vi.fn();
		const onClear = vi.fn();
		render(ChatToolbar, {
			variant: 'page',
			canvasOpen: false,
			hasMessages: true,
			onOpenMemory: vi.fn(),
			onToggleMobileCanvas: vi.fn(),
			onToggleDesktopCanvas: vi.fn(),
			onExport,
			onClear
		});

		expect(screen.getByText('Workspace actions')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Export research' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Clear conversation' }));
		expect(onExport).toHaveBeenCalledOnce();
		expect(onClear).toHaveBeenCalledOnce();
	});
});
