import { checkRole, type UserRole } from '$lib/types/auth.types';

export interface NavItem {
	label: string;
	href: string;
	description?: string;
	requiresRole?: UserRole;
	requiresChatAccess?: boolean;
	requiresParchmentAccess?: boolean;
	matches?: string[];
	locked?: boolean;
	lockedReason?: string;
	upgradeHref?: string;
}

export interface NavSection {
	id: 'parchment' | 'portfolio' | 'maillard' | 'developer' | 'admin';
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
		label: 'Pricing',
		href: '/subscription',
		description: 'See current plans and contact paths',
		matches: ['/subscription']
	},
	{
		label: 'Parchment Market Index',
		href: '/analytics',
		description: 'Explore current market intelligence',
		matches: ['/analytics']
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
		id: 'parchment',
		label: 'Parchment',
		items: [
			{ label: 'Dashboard', href: '/dashboard', description: 'Parchment Intelligence home' },
			{
				label: 'Parchment Market Index',
				href: '/analytics',
				description: 'Market trends, price movement, and sourcing signals',
				matches: ['/analytics']
			},
			{ label: 'Catalog', href: '/catalog', description: 'Browse green coffee supply data' },
			{
				label: 'Chat',
				href: '/chat',
				description: 'Ask Parchment Intelligence about sourcing and market decisions',
				requiresChatAccess: true,
				lockedReason: 'Requires Parchment Intelligence or Mallard Studio access.'
			}
		]
	},
	{
		id: 'portfolio',
		label: 'Portfolio',
		items: [
			{
				label: 'Portfolio',
				href: '/beans',
				description: 'Track saved, purchased, and owned green coffees',
				requiresParchmentAccess: true,
				lockedReason: 'Portfolio tracking requires Parchment Intelligence or Mallard Studio access.'
			}
		]
	},
	{
		id: 'maillard',
		label: 'Maillard Studio',
		items: [
			{
				label: 'Roast',
				href: '/roast',
				description: 'Manage roasts and profiles',
				requiresRole: 'member',
				lockedReason: 'Roasting workflows require Mallard Studio.'
			},
			{
				label: 'Profit',
				href: '/profit',
				description: 'Review sales and profit',
				requiresRole: 'member',
				lockedReason: 'Profit workflows require Mallard Studio.'
			}
		]
	},
	{
		id: 'developer',
		label: 'Developer',
		items: [
			{
				label: 'Parchment Console',
				href: '/api-dashboard',
				description: 'Manage API keys and usage',
				matches: ['/api-dashboard']
			},
			{
				label: 'Docs',
				href: '/docs',
				description: 'Read Parchment API and platform docs',
				matches: ['/docs']
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

export interface NavAccessContext {
	ppiAccess?: boolean;
}

function canUseChat(role: UserRole, context: NavAccessContext): boolean {
	return context.ppiAccess === true || checkRole(role, 'member');
}

function resolveNavItemAccess(
	item: NavItem,
	role: UserRole,
	context: NavAccessContext
): NavItem | null {
	if (item.requiresRole === 'admin' && !checkRole(role, 'admin')) return null;

	const roleLocked = Boolean(item.requiresRole && !checkRole(role, item.requiresRole));
	const chatLocked = Boolean(item.requiresChatAccess && !canUseChat(role, context));
	const parchmentLocked = Boolean(item.requiresParchmentAccess && !canUseChat(role, context));
	const locked = roleLocked || chatLocked || parchmentLocked;

	return {
		...item,
		locked,
		upgradeHref: locked ? (item.upgradeHref ?? '/subscription') : item.upgradeHref
	};
}

export function getAuthenticatedNavSections(
	role: UserRole,
	context: NavAccessContext = {}
): NavSection[] {
	return authenticatedSections
		.map((section) => ({
			...section,
			items: section.items
				.map((item) => resolveNavItemAccess(item, role, context))
				.filter((item): item is NavItem => item !== null)
		}))
		.filter((section) => section.items.length > 0);
}

export function getAuthenticatedQuickLinks(
	role: UserRole,
	context: NavAccessContext = {}
): NavItem[] {
	return getAuthenticatedNavSections(role, context).flatMap((section) => section.items);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
	const patterns = item.matches ?? [item.href];
	return patterns.some((pattern) => pathname === pattern || pathname.startsWith(`${pattern}/`));
}

export function getCurrentRouteLabel(
	pathname: string,
	role: UserRole,
	context: NavAccessContext = {}
): string {
	const items = getAuthenticatedQuickLinks(role, context);
	const matched = items.find((item) => isNavItemActive(item, pathname));
	if (matched) return matched.label;

	if (pathname === '/') return 'Home';

	const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'App';
	return segment
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
