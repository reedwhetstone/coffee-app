import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BeforeNavigate } from '@sveltejs/kit';
import LiveRoastGuard from './LiveRoastGuard.svelte';

const { goto, navigationGuards } = vi.hoisted(() => ({
	goto: vi.fn(async (url: string | URL) => url),
	navigationGuards: [] as Array<(navigation: BeforeNavigate) => void>
}));

vi.mock('$app/navigation', () => ({
	goto,
	beforeNavigate: (guard: (navigation: BeforeNavigate) => void) => {
		navigationGuards.push(guard);
	}
}));

function navigate(
	to: string | null,
	overrides: Partial<Record<keyof BeforeNavigate, unknown>> = {}
) {
	const cancel = vi.fn();
	const navigation = {
		from: { url: new URL('http://localhost/roast?profileId=1') },
		to: to ? { url: new URL(to, 'http://localhost') } : null,
		type: 'link',
		willUnload: false,
		cancel,
		...overrides
	} as unknown as BeforeNavigate;
	navigationGuards.at(-1)!(navigation);
	return cancel;
}

function unload() {
	const event = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(event);
	return event;
}

function dialog() {
	return screen.queryByRole('alertdialog', { name: 'A roast is still recording.' });
}

describe('LiveRoastGuard', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		navigationGuards.length = 0;
	});

	describe('with no roast in progress', () => {
		it('lets a roast switch through without asking', async () => {
			const { component } = render(LiveRoastGuard, { active: false });

			await expect(component.confirmLeave()).resolves.toBe(true);
			expect(dialog()).not.toBeInTheDocument();
		});

		it('does not hold navigation, a reload, or a closed tab', () => {
			render(LiveRoastGuard, { active: false });

			expect(navigate('/beans')).not.toHaveBeenCalled();
			expect(unload().defaultPrevented).toBe(false);
			expect(dialog()).not.toBeInTheDocument();
		});
	});

	describe('with a roast in progress', () => {
		it('asks in plain words and keeps the roast when the member stays', async () => {
			const { component } = render(LiveRoastGuard, { active: true });

			const choice = component.confirmLeave();
			const question = await screen.findByRole('alertdialog', {
				name: 'A roast is still recording.'
			});
			expect(question).toHaveAccessibleDescription(
				'Leaving now loses the readings that are not saved.'
			);
			await waitFor(() =>
				expect(screen.getByRole('button', { name: 'Keep roasting' })).toHaveFocus()
			);

			await fireEvent.click(screen.getByRole('button', { name: 'Keep roasting' }));

			await expect(choice).resolves.toBe(false);
			expect(dialog()).not.toBeInTheDocument();
		});

		it('lets the switch through when the member chooses to leave', async () => {
			const { component } = render(LiveRoastGuard, { active: true });

			const choice = component.confirmLeave();
			await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

			await expect(choice).resolves.toBe(true);
			expect(dialog()).not.toBeInTheDocument();
		});

		it('treats Escape as keep roasting', async () => {
			const { component } = render(LiveRoastGuard, { active: true });

			const choice = component.confirmLeave();
			await screen.findByRole('alertdialog');
			await fireEvent.keyDown(window, { key: 'Escape' });

			await expect(choice).resolves.toBe(false);
		});

		it('asks once when two actions wait on the same answer', async () => {
			const { component } = render(LiveRoastGuard, { active: true });

			const first = component.confirmLeave();
			const second = component.confirmLeave();
			await screen.findByRole('alertdialog');
			expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
			await fireEvent.click(screen.getByRole('button', { name: 'Keep roasting' }));

			await expect(Promise.all([first, second])).resolves.toEqual([false, false]);
		});

		it('holds navigation to another page and stays when the member keeps roasting', async () => {
			render(LiveRoastGuard, { active: true });

			const cancel = navigate('/beans');
			expect(cancel).toHaveBeenCalledOnce();

			await fireEvent.click(await screen.findByRole('button', { name: 'Keep roasting' }));
			await Promise.resolve();

			expect(goto).not.toHaveBeenCalled();
			// The next attempt asks again.
			expect(navigate('/beans')).toHaveBeenCalledOnce();
		});

		it('continues to the page the member asked for after they choose to leave', async () => {
			render(LiveRoastGuard, { active: true });

			navigate('/beans?tab=roasting');
			await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

			await waitFor(() => expect(goto).toHaveBeenCalledOnce());
			expect(String(goto.mock.calls[0][0])).toBe('http://localhost/beans?tab=roasting');
			// The confirmed navigation passes without a second question.
			expect(navigate('/beans?tab=roasting', { type: 'goto' })).not.toHaveBeenCalled();
			expect(dialog()).not.toBeInTheDocument();
		});

		it('holds a second attempt while the question is open and follows only the first', async () => {
			render(LiveRoastGuard, { active: true });

			navigate('/beans');
			await screen.findByRole('alertdialog');
			expect(navigate('/profit')).toHaveBeenCalledOnce();
			expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
			await fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

			await waitFor(() => expect(goto).toHaveBeenCalledOnce());
			expect(String(goto.mock.calls[0][0])).toBe('http://localhost/beans');
		});

		it('repeats a held back or forward step through history', async () => {
			const historyGo = vi.spyOn(history, 'go').mockImplementation(() => {});
			render(LiveRoastGuard, { active: true });

			const cancel = navigate('/beans', { type: 'popstate', delta: -1 });
			expect(cancel).toHaveBeenCalledOnce();
			await fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

			await waitFor(() => expect(historyGo).toHaveBeenCalledWith(-1));
			expect(goto).not.toHaveBeenCalled();
			historyGo.mockRestore();
		});

		it('does not ask when the roast page only rewrites its own address', () => {
			render(LiveRoastGuard, { active: true });

			expect(navigate('/roast?profileId=1&modal=new')).not.toHaveBeenCalled();
			expect(dialog()).not.toBeInTheDocument();
		});

		it('leaves a reload or a closed tab to the browser prompt', () => {
			render(LiveRoastGuard, { active: true });

			expect(navigate(null, { type: 'leave', willUnload: true })).not.toHaveBeenCalled();
			expect(dialog()).not.toBeInTheDocument();

			const event = unload();
			expect(event.defaultPrevented).toBe(true);
		});

		it('stops asking once the roast is saved', async () => {
			const { component, rerender } = render(LiveRoastGuard, { active: true });
			expect(unload().defaultPrevented).toBe(true);

			await rerender({ active: false });

			expect(unload().defaultPrevented).toBe(false);
			expect(navigate('/beans')).not.toHaveBeenCalled();
			await expect(component.confirmLeave()).resolves.toBe(true);
			expect(dialog()).not.toBeInTheDocument();
		});
	});
});
