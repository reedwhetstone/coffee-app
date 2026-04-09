import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileAppMenu from './MobileAppMenu.svelte';

const { goto, pageState, workspaceStore } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: {
		url: new URL('http://localhost/chat')
	},
	workspaceStore: {
		workspaces: [
			{
				id: 'ws-1',
				title: 'General Workspace',
				type: 'general',
				context_summary: '',
				canvas_state: {},
				last_accessed_at: '2026-04-08T00:00:00.000Z',
				created_at: '2026-04-08T00:00:00.000Z'
			}
		],
		currentWorkspaceId: 'ws-1',
		loading: false,
		loadWorkspaces: vi.fn().mockResolvedValue(undefined),
		activateWorkspace: vi.fn().mockResolvedValue(true),
		createAndActivateWorkspace: vi.fn().mockResolvedValue({
			id: 'ws-2',
			title: 'Fresh Workspace',
			type: 'analysis',
			context_summary: '',
			canvas_state: {},
			last_accessed_at: '2026-04-08T00:00:00.000Z',
			created_at: '2026-04-08T00:00:00.000Z'
		}),
		getPersistedWorkspaceId: vi.fn().mockReturnValue('ws-1')
	}
}));

vi.mock('$app/navigation', () => ({
	goto
}));

vi.mock('$app/state', () => ({
	page: pageState
}));

vi.mock('$lib/types/auth.types', () => ({
	checkRole: () => true
}));

vi.mock('$lib/components/layout/appNavigation', () => ({
	getAuthenticatedNavSections: () => [],
	isNavItemActive: () => false
}));

vi.mock('$lib/stores/workspaceStore.svelte', () => ({
	workspaceStore
}));

describe('MobileAppMenu', () => {
	beforeEach(() => {
		pageState.url = new URL('http://localhost/chat');
		goto.mockReset();
		workspaceStore.loadWorkspaces.mockClear();
		workspaceStore.activateWorkspace.mockClear();
		workspaceStore.createAndActivateWorkspace.mockClear();
		workspaceStore.getPersistedWorkspaceId.mockClear();
	});

	it('routes workspace selection through the shared activation helper on /chat', async () => {
		const onClose = vi.fn();
		render(MobileAppMenu, {
			data: { role: 'member', user: { email: 'member@example.com' } },
			onClose
		});

		await fireEvent.click(screen.getByRole('button', { name: /general workspace/i }));

		expect(workspaceStore.activateWorkspace).toHaveBeenCalledWith('ws-1');
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(goto).not.toHaveBeenCalled();
	});

	it('creates a workspace through the shared activation helper and opens chat from other routes', async () => {
		pageState.url = new URL('http://localhost/dashboard');
		const onClose = vi.fn();
		render(MobileAppMenu, {
			data: { role: 'member', user: { email: 'member@example.com' } },
			onClose
		});

		await fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));
		await fireEvent.input(screen.getByPlaceholderText('Workspace name'), {
			target: { value: '  Fresh Workspace  ' }
		});
		const workspaceTypeSelect = screen.getByRole('combobox') as HTMLSelectElement;
		workspaceTypeSelect.value = 'analysis';
		await fireEvent.change(workspaceTypeSelect);
		expect(workspaceTypeSelect.value).toBe('analysis');
		await fireEvent.click(screen.getByRole('button', { name: /^Create workspace$/i }));

		expect(workspaceStore.createAndActivateWorkspace).toHaveBeenCalledTimes(1);
		expect(workspaceStore.createAndActivateWorkspace).toHaveBeenCalledWith(
			'  Fresh Workspace  ',
			expect.any(String)
		);
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith('/chat');
	});
});
