import { tick } from 'svelte';

const activeDetailDialogs: HTMLElement[] = [];

/** Keyboard ownership for a detail panel nested inside another workspace. */
export function detailDialog(node: HTMLElement, close: () => void) {
	const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	let mounted = true;
	activeDetailDialogs.push(node);
	node.dataset.detailDialog = 'true';
	const controls = () =>
		Array.from(
			node.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
			)
		).filter((element) => !element.closest('[hidden], [inert]'));
	void tick().then(() => {
		if (mounted) (node.querySelector<HTMLElement>('button') ?? node).focus();
	});
	function keydown(event: KeyboardEvent) {
		if (event.defaultPrevented) return;
		if (event.key === 'Escape' && activeDetailDialogs.at(-1) !== node) return;
		const target = event.target instanceof Element ? event.target : null;
		const owner = target?.closest('[role="dialog"]');
		// An ancestor dialog is background to this visible detail panel and must
		// not steal Escape after focus leaves the child. Sibling/descendant dialogs
		// retain their own keyboard ownership.
		if (owner && owner !== node && !owner.contains(node)) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
		} else if (event.key === 'Tab') {
			if (!target || !node.contains(target)) return;
			const items = controls();
			const first = items[0];
			const last = items.at(-1);
			if (!first) {
				event.preventDefault();
				node.focus();
			} else if (
				event.shiftKey &&
				(document.activeElement === first || document.activeElement === node)
			) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}
	node.addEventListener('keydown', keydown);
	window.addEventListener('keydown', keydown);
	return {
		update(nextClose: () => void) {
			close = nextClose;
		},
		destroy() {
			mounted = false;
			const index = activeDetailDialogs.indexOf(node);
			if (index >= 0) activeDetailDialogs.splice(index, 1);
			delete node.dataset.detailDialog;
			node.removeEventListener('keydown', keydown);
			window.removeEventListener('keydown', keydown);
			void tick().then(() => {
				if (trigger?.isConnected && !trigger.closest('[hidden], [inert]'))
					trigger.focus({ preventScroll: true });
			});
		}
	};
}
