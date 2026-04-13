import { checkRole, type UserRole } from '$lib/types/auth.types';

export interface NavItem {
	label: string;
	href: string;
	description?: string;
	requiresRole?: UserRole;
	matches?: string[];
}

export interface NavSection {
	id: 'core' | 'secondary' | 'admin';
	label: string;
	items: NavItem[];
}

export const publicNavItems: NavItem[] = [
	{
		label: 'For Buyers',
		href: '/catalog',
		description: 'Browse live coffee inventory and compare sourcing options',
		matches: ['/catalog']
	},
	{
		label: 'Products',
		href: '/',
		description: 'See Mallard Studio, API, and market intelligence paths',
		matches: ['/']
	},
	{
		label: 'Market Data',
		href: '/analytics',
		description: 'Explore current market intelligence',
		matches: ['/analytics']
	},
	{
		label: 'Mallard Studio',
		href: '/',
		description: 'See the workflow product story'
	},
	{
		label: 'API',
		href: '/api',
		description: 'Parchment API overview',
		matches: ['/api']
	},
	{
		label: 'Docs',
		href: '/docs',
		description: 'Read developer documentation',
		matches: ['/docs']
	},
	{
		label: 'Blog',
		href: '/blog',
		description: 'Read product essays and updates',
		matches: ['/blog']
	}
];

const authenticatedSections: NavSection[] = [
	{
		id: 'core',
		label: 'Core destinations',
		items: [
			{ label: 'Dashboard', href: '/dashboard', description: 'Your command center' },
			{ label: 'Catalog', href: '/catalog', description: 'Browse catalog data' },
			{
				label: 'Roast',
				href: '/roast',
				description: 'Manage roasts and profiles',
				requiresRole: 'member'
			},
			{
				label: 'Inventory',
				href: '/beans',
				description: 'Track stocked beans',
				requiresRole: 'member'
			},
			{
				label: 'Market Data',
				href: '/analytics',
				description: 'Review market intelligence',
				matches: ['/analytics']
			},
			{
				label: 'Chat',
				href: '/chat',
				description: 'Open Coffee Chat',
				requiresRole: 'member'
			}
		]
	},
	{
		id: 'secondary',
		label: 'Tools & account',
		items: [
			{
				label: 'Profit',
				href: '/profit',
				description: 'Review sales and profit',
				requiresRole: 'member'
			},
			{
				label: 'Parchment Console',
				href: '/api-dashboard',
				description: 'Manage API keys and usage',
				matches: ['/api-dashboard']
			},
			{
				label: 'Docs',
				href: '/docs',
				description: 'Read the API and platform docs',
				matches: ['/docs']
			},
			{
				label: 'Subscription',
				href: '/subscription',
				description: 'Manage billing and plan details'
			},
			{
				label: 'Contact',
				href: '/contact',
				description: 'Reach out for support'
			}
		]
	},
	{
		id: 'admin',
		label: 'Admin',
		items: [
			{
				label: 'Admin Dashboard',
				href: '/admin',
				description: 'Open administration tools',
				requiresRole: 'admin',
				matches: ['/admin']
			}
		]
	}
];

export function getAuthenticatedNavSections(role: UserRole): NavSection[] {
	return authenticatedSections
		.map((section) => ({
			...section,
			items: section.items.filter(
				(item) => !item.requiresRole || checkRole(role, item.requiresRole)
			)
		}))
		.filter((section) => section.items.length > 0);
}

export function getAuthenticatedQuickLinks(role: UserRole): NavItem[] {
	return getAuthenticatedNavSections(role).flatMap((section) => section.items);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
	const patterns = item.matches ?? [item.href];
	return patterns.some((pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`));
}

export function getCurrentRouteLabel(pathname: string, role: UserRole): string {
	const items = getAuthenticatedQuickLinks(role);
	const matched = items.find((item) => isNavItemActive(item, pathname));
	if (matched) return matched.label;

	if (pathname === '/') return 'Home';

	const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'App';
	return segment
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
