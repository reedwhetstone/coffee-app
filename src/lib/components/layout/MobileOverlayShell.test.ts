import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import MobileOverlayShellHarness from './__test-fixtures__/MobileOverlayShellHarness.svelte';

describe('MobileOverlayShell', () => {
	it('moves focus into the dialog, traps tab navigation, and restores focus on close', async () => {
		Object.defineProperty(HTMLElement.prototype, 'animate', {
			configurable: true,
			value: vi.fn(() => ({
				finished: Promise.resolve(),
				cancel: vi.fn(),
				play: vi.fn()
			}))
		});
		const opener = document.createElement('button');
		opener.textContent = 'Open menu';
		document.body.appendChild(opener);
		opener.focus();

		const onClose = vi.fn();
		const view = render(MobileOverlayShellHarness, { open: true, onClose });
		await tick();

		const dialog = screen.getByRole('dialog', { name: 'App menu' });
		const firstAction = screen.getByRole('button', { name: 'First action' });
		const secondAction = screen.getByRole('button', { name: 'Second action' });

		expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
		expect(dialog.closest('.fixed')).toHaveClass('z-[60]');
		expect(document.body.style.overflow).toBe('hidden');
		await waitFor(() => expect(firstAction).toHaveFocus());

		secondAction.focus();
		await fireEvent.keyDown(dialog, { key: 'Tab' });
		expect(firstAction).toHaveFocus();

		firstAction.focus();
		await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
		expect(secondAction).toHaveFocus();

		await fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledTimes(1);

		await view.rerender({ open: false, onClose });
		await tick();
		expect(document.body.style.overflow).toBe('');
		expect(opener).toHaveFocus();
		opener.remove();
	});

	it('focuses a visible summary, skips collapsed actions, and gives its disclosure Escape ownership', async () => {
		const onClose = vi.fn();
		render(MobileOverlayShellHarness, { open: true, disclosure: true, onClose });
		const summary = screen.getByLabelText('Conversation controls');
		await waitFor(() => expect(summary).toHaveFocus());
		await fireEvent.keyDown(summary, { key: 'Tab', shiftKey: true });
		expect(screen.getByRole('button', { name: 'Second action' })).toHaveFocus();
		summary.focus();
		await fireEvent.click(summary);
		const hiddenAction = screen.getByRole('button', { name: 'Hidden action' });
		hiddenAction.focus();
		await fireEvent.keyDown(hiddenAction, { key: 'Escape' });
		expect(summary.closest('details')).not.toHaveAttribute('open');
		expect(summary).toHaveFocus();
		expect(onClose).not.toHaveBeenCalled();
		await fireEvent.keyDown(summary, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('provides an internal scroll region for tall mobile sheet content', async () => {
		render(MobileOverlayShellHarness, { open: true, onClose: vi.fn() });
		await tick();

		const dialog = screen.getByRole('dialog', { name: 'App menu' });
		const scrollRegion = dialog.querySelector('[data-mobile-overlay-scroll-region]');

		expect(scrollRegion).not.toBeNull();
		expect(scrollRegion).toHaveClass('overflow-y-auto');
		expect(scrollRegion).toHaveClass('overscroll-contain');
		expect(scrollRegion).toHaveClass('flex-1');
	});
});
