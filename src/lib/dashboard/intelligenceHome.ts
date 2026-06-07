import { checkRole, type UserRole } from '$lib/types/auth.types';

export type DashboardCardStatus = 'ready' | 'locked' | 'coming-soon';
export type DashboardSectionId = 'parchment' | 'portfolio' | 'mallard' | 'developer';
export type DashboardRequirement = 'parchment' | 'mallard';

export interface DashboardAccessContext {
	role: UserRole;
	ppiAccess?: boolean;
}

export interface DashboardCard {
	href?: string;
	label: string;
	title: string;
	description: string;
	cta: string;
	status: DashboardCardStatus;
	requirement?: DashboardRequirement;
	lockedReason?: string;
}

export interface DashboardSection {
	id: DashboardSectionId;
	label: string;
	description: string;
	cards: DashboardCard[];
}

export interface DashboardUpgradePrompt {
	headline: string;
	body: string;
	cta: string;
	href: string;
	variant: 'strong' | 'contextual';
}

const dashboardSections: Omit<DashboardSection, 'cards'>[] = [
	{
		id: 'parchment',
		label: 'Parchment Intelligence',
		description: 'Market analytics, catalog research, and sourcing decision support.'
	},
	{
		id: 'portfolio',
		label: 'Portfolio',
		description: 'Tracked, saved, purchased, and owned coffees connected to the market layer.'
	},
	{
		id: 'mallard',
		label: 'Mallard Studio',
		description:
			'Roasting context and operating workflows that add personal context to intelligence.'
	},
	{
		id: 'developer',
		label: 'Developer',
		description: 'Machine-readable access through Parchment API and docs.'
	}
];

const cardCatalog: Record<DashboardSectionId, Omit<DashboardCard, 'status' | 'lockedReason'>[]> = {
	parchment: [
		{
			href: '/analytics',
			label: 'Index',
			title: 'Parchment Market Index',
			description:
				'Read origin, process, supplier, and price movement across the green coffee market.',
			cta: 'Open market index'
		},
		{
			href: '/catalog',
			label: 'Research',
			title: 'Catalog and supply research',
			description:
				'Search current offers, compare suppliers, and inspect green coffee sourcing context.',
			cta: 'Browse catalog'
		},
		{
			href: '/chat',
			label: 'Ask',
			title: 'Ask Parchment',
			description:
				'Ask catalog research and sourcing questions grounded in current supply, market, and portfolio context.',
			cta: 'Ask a sourcing question',
			requirement: 'parchment'
		},
		{
			label: 'Reports',
			title: 'Intelligence reports',
			description:
				'Daily dashboard reads, weekly briefs, and monthly deep dives are the reporting direction. Use the Market Index and catalog research paths for live evidence today.',
			cta: 'Reporting direction'
		}
	],
	portfolio: [
		{
			href: '/beans',
			label: 'Portfolio',
			title: 'Tracked coffee panel',
			description:
				'Track saved, purchased, and owned coffees so market intelligence can connect to your actual lineup.',
			cta: 'Open Portfolio',
			requirement: 'parchment'
		}
	],
	mallard: [
		{
			href: '/roast',
			label: 'Roast',
			title: 'Roast context',
			description:
				'Log roast profiles and development notes as roaster-side context, not the umbrella product.',
			cta: 'Open roast tools',
			requirement: 'mallard'
		},
		{
			href: '/profit',
			label: 'Margins',
			title: 'Profit context',
			description:
				'Review sales and margin context when sourcing decisions need to connect back to roastery economics.',
			cta: 'Open profit tools',
			requirement: 'mallard'
		}
	],
	developer: [
		{
			href: '/api-dashboard',
			label: 'API',
			title: 'Parchment Console',
			description: 'Manage API keys, usage, and account-aware access to the Parchment API.',
			cta: 'Open console'
		},
		{
			href: '/docs',
			label: 'Docs',
			title: 'Parchment API docs',
			description: 'Read the API and platform documentation for agents, tools, and integrations.',
			cta: 'Read docs'
		}
	]
};

export function hasMallardAccess(context: DashboardAccessContext): boolean {
	return checkRole(context.role, 'member');
}

export function hasParchmentWorkflowAccess(context: DashboardAccessContext): boolean {
	return context.ppiAccess === true || hasMallardAccess(context);
}

function resolveCardStatus(
	card: Omit<DashboardCard, 'status' | 'lockedReason'>,
	context: DashboardAccessContext
): Pick<DashboardCard, 'status' | 'lockedReason'> {
	if (!card.href) return { status: 'coming-soon' };

	if (card.requirement === 'parchment' && !hasParchmentWorkflowAccess(context)) {
		return {
			status: 'locked',
			lockedReason: 'Requires Parchment Intelligence or Mallard Studio access.'
		};
	}

	if (card.requirement === 'mallard' && !hasMallardAccess(context)) {
		return { status: 'locked', lockedReason: 'Requires Mallard Studio.' };
	}

	return { status: 'ready' };
}

export function getDashboardSections(context: DashboardAccessContext): DashboardSection[] {
	return dashboardSections.map((section) => ({
		...section,
		cards: cardCatalog[section.id].map((card) => ({
			...card,
			...resolveCardStatus(card, context)
		}))
	}));
}

export function getDashboardUpgradePrompt(
	context: DashboardAccessContext
): DashboardUpgradePrompt | null {
	const hasParchmentIntelligence = context.ppiAccess === true;
	const hasMallard = hasMallardAccess(context);

	if (!hasParchmentIntelligence && !hasMallard) {
		return {
			headline: 'Unlock the Intelligence layer',
			body: 'Go beyond public browsing with Ask Parchment, Portfolio tracking, sourcing workflows, and deeper market intelligence built around live green coffee supply.',
			cta: 'Compare plans',
			href: '/subscription',
			variant: 'strong'
		};
	}

	if (hasParchmentIntelligence && !hasMallard) {
		return {
			headline: 'Add roasting context when your own coffees matter',
			body: 'Parchment Intelligence is active. Mallard Studio adds roast, tasting, and margin context when sourcing decisions need to connect to your roastery operations.',
			cta: 'View Mallard Studio',
			href: '/subscription',
			variant: 'contextual'
		};
	}

	if (!hasParchmentIntelligence && hasMallard) {
		return {
			headline: 'Add Parchment Intelligence for deeper market reads',
			body: 'Mallard Studio is active. Parchment Intelligence adds the fuller market-reporting layer for supplier coverage, pricing movement, and sourcing decisions.',
			cta: 'View Intelligence options',
			href: '/subscription',
			variant: 'contextual'
		};
	}

	return null;
}
