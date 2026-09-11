export const goto = async (path: string) => {
	window.dispatchEvent(new CustomEvent('fixture-navigation', { detail: path }));
};
export const afterNavigate = () => {};
export const beforeNavigate = () => {};
export const onNavigate = () => {};
export const invalidateAll = async () => {};
export const invalidate = async () => {};
export const preloadData = async () => {};
export const preloadCode = async () => {};
