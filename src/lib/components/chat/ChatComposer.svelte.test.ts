import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import ChatComposer from './ChatComposer.svelte';

function props(overrides: Record<string, unknown> = {}) {
	return {
		inputMessage: 'Find stocked Ethiopias',
		isActive: false,
		canUseMallardWorkspaces: false,
		suggestions: [],
		slashCompletions: [],
		chatError: null,
		chatCanRetry: false,
		workspaceError: null,
		workspaceReady: true,
		initializingWorkspace: false,
		onSend: vi.fn(),
		onStop: vi.fn(),
		onRetry: vi.fn(),
		onRetryWorkspace: vi.fn(),
		onDismissError: vi.fn(),
		...overrides
	};
}

describe('ChatComposer recovery controls', () => {
	it('frames the action and context controls with the product naming hierarchy', () => {
		render(
			ChatComposer,
			props({
				contextChips: [
					{ id: 'page', label: 'Current view', detail: 'Catalog filters', active: true }
				]
			})
		);
		expect(screen.getByText(/Using 1 of 1 context source/)).toBeInTheDocument();
		expect(screen.getByText(/Ask Parchment/)).toBeInTheDocument();
	});

	it('keeps context toggles behind a labeled disclosure', async () => {
		const onToggleChip = vi.fn();
		render(
			ChatComposer,
			props({
				contextChips: [
					{ id: 'page', label: 'Current view', detail: 'Catalog filters', active: true }
				],
				onToggleChip
			})
		);
		const summary = screen.getByText(/Using 1 of 1 context source/);
		const disclosure = summary.closest('details');
		expect(disclosure).not.toHaveAttribute('open');
		await fireEvent.click(summary);
		await fireEvent.click(screen.getByRole('button', { name: 'Current view' }));
		expect(onToggleChip).toHaveBeenCalledWith('page');
	});

	it('replaces send with an accessible stop control during a turn', async () => {
		const onStop = vi.fn();
		render(ChatComposer, props({ isActive: true, onStop }));
		await fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
		expect(onStop).toHaveBeenCalledOnce();
	});

	it('offers retry only for recoverable chat failures', () => {
		const { rerender } = render(
			ChatComposer,
			props({ chatError: 'The response took too long.', chatCanRetry: true })
		);
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
		rerender(props({ chatError: 'This request needs access.', chatCanRetry: false }));
		expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
	});

	it('gates sending and exposes workspace setup retry when persistence is unavailable', async () => {
		const onRetryWorkspace = vi.fn();
		render(
			ChatComposer,
			props({
				workspaceReady: false,
				workspaceError: 'Failed to create workspace',
				onRetryWorkspace
			})
		);
		expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry setup' }));
		expect(onRetryWorkspace).toHaveBeenCalledOnce();
	});
});
