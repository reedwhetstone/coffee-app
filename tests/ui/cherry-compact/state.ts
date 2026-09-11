export const page = {
	url: new URL(location.search.includes('drawer') ? '/beans' : '/chat', location.origin),
	route: { id: '/chat' },
	data: {}
};
export const navigating = null;
export const updated = { current: false, check: async () => false };
