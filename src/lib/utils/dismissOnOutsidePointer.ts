/**
 * Close a floating panel when the user presses anywhere outside it, the same
 * way the main menu dismisses. Presses inside other open dialogs (for example a
 * nested detail or confirmation) are left to those dialogs.
 */
export function dismissOnOutsidePointer(node: HTMLElement, close: () => void) {
	let armed = false;
	// Ignore the press that opened the panel.
	const arm = window.setTimeout(() => (armed = true), 0);
	function pointerdown(event: PointerEvent) {
		if (!armed || event.button !== 0) return;
		const target = event.target instanceof Element ? event.target : null;
		if (!target || node.contains(target)) return;
		const otherDialog = target.closest('[role="dialog"], [data-detail-dialog]');
		if (otherDialog && otherDialog !== node) return;
		close();
	}
	document.addEventListener('pointerdown', pointerdown, true);
	return {
		update(nextClose: () => void) {
			close = nextClose;
		},
		destroy() {
			window.clearTimeout(arm);
			document.removeEventListener('pointerdown', pointerdown, true);
		}
	};
}
