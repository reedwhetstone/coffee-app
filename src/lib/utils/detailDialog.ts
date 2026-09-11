import { tick } from 'svelte';

/** Keyboard ownership for a detail panel nested inside another workspace. */
export function detailDialog(node: HTMLElement, close: () => void) {
	const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	let mounted = true;
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
		const target = event.target instanceof Element ? event.target : null;
		const owner = target?.closest('[role="dialog"]');
		if (owner && owner !== node) return;
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
			node.removeEventListener('keydown', keydown);
			window.removeEventListener('keydown', keydown);
			void tick().then(() => {
				if (trigger?.isConnected && !trigger.closest('[hidden], [inert]'))
					trigger.focus({ preventScroll: true });
			});
		}
	};
}
