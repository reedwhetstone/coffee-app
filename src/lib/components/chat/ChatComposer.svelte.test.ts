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
