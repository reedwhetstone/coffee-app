import { resolveCherryAgent, type CherryAgentIdentity } from '$lib/cherry/identity';
import { checkRole, type UserRole } from '$lib/types/auth.types';

export interface DashboardAccessContext {
	role: UserRole;
	ppiAccess?: boolean;
}

export interface DashboardTask {
	id: 'market' | 'catalog' | 'portfolio' | 'roast' | 'profit' | 'plans';
	eyebrow: string;
	title: string;
	description: string;
	href: string;
}

export interface DashboardExperience {
	accessLabel: string;
	headline: string;
	introduction: string;
	agent: CherryAgentIdentity | null;
	focusQuestion: string;
	tasks: DashboardTask[];
}

export interface DashboardUpgradePrompt {
	headline: string;
	body: string;
	cta: string;
	href: string;
}

const MARKET_TASK: DashboardTask = {
	id: 'market',
	eyebrow: 'Market movement',
	title: 'Review the Market Index',
	description:
		'See current pricing, supplier movement, arrivals, and the evidence behind the read.',
	href: '/analytics'
};

const CATALOG_TASK: DashboardTask = {
	id: 'catalog',
	eyebrow: 'Current offers',
	title: 'Research live coffee',
	description: 'Compare normalized offers by origin, process, supplier, price, and provenance.',
	href: '/catalog'
};

const PORTFOLIO_TASK: DashboardTask = {
	id: 'portfolio',
	eyebrow: 'Your coffees',
	title: 'Work from your portfolio',
	description: 'Continue with coffees you track, own, or are actively considering.',
	href: '/beans'
};

const ROAST_TASK: DashboardTask = {
	id: 'roast',
	eyebrow: 'Production',
	title: 'Plan or log a roast',
	description: 'Carry an owned coffee into roast planning, execution, and review.',
	href: '/roast'
};

const PROFIT_TASK: DashboardTask = {
	id: 'profit',
	eyebrow: 'Margins',
	title: 'Review sales and margin',
	description: 'Connect finished coffee and sales back to the economics of the operation.',
	href: '/profit'
};

const PLANS_TASK: DashboardTask = {
	id: 'plans',
	eyebrow: 'Coffee-native AI',
	title: 'Deploy Cherry AI',
	description: 'Choose the market and roastery context that matches how you work.',
	href: '/subscription'
};

export function hasMallardAccess(context: DashboardAccessContext): boolean {
	return checkRole(context.role, 'member');
}

export function hasParchmentWorkflowAccess(context: DashboardAccessContext): boolean {
	return context.ppiAccess === true || hasMallardAccess(context);
}

export function getDashboardExperience(context: DashboardAccessContext): DashboardExperience {
	const memberAccess = hasMallardAccess(context);
	const ppiAccess = context.ppiAccess === true;
	const agent = resolveCherryAgent({ ppiAccess, memberAccess });

	if (ppiAccess && memberAccess) {
		return {
			accessLabel: 'Parchment Intelligence + Mallard Studio',
			headline: 'Connect the market to your coffee operation.',
			introduction:
				'Move from current green coffee evidence into inventory, roasting, tasting, sales, and margin work without losing the thread.',
			agent,
			focusQuestion:
				'Connect current market movement to my portfolio and roastery context. What deserves attention next?',
			tasks: [MARKET_TASK, CATALOG_TASK, ROAST_TASK, PROFIT_TASK]
		};
	}

	if (ppiAccess) {
		return {
			accessLabel: 'Parchment Intelligence',
			headline: 'See what changed before you source.',
			introduction:
				'Keep current offers, supplier evidence, market movement, and your tracked coffees in one decision flow.',
			agent,
			focusQuestion:
				'Review current market movement and my tracked coffees. Which sourcing questions should I investigate next?',
			tasks: [MARKET_TASK, CATALOG_TASK, PORTFOLIO_TASK]
		};
	}

	if (memberAccess) {
		return {
			accessLabel: 'Mallard Studio',
			headline: 'Move today’s coffee work forward.',
			introduction:
				'Continue from green inventory into roasting, tasting, sales, and margin work with your operating context intact.',
			agent,
			focusQuestion:
				'Review my inventory and roastery context. What should I focus on next across roasting, tasting, and margins?',
			tasks: [PORTFOLIO_TASK, ROAST_TASK, PROFIT_TASK, CATALOG_TASK]
		};
	}

	return {
		accessLabel: 'Purveyors account',
		headline: 'Start with today’s green coffee market.',
		introduction:
			'Explore normalized current offers and market evidence, then add the tools and context that match your operation.',
		agent: null,
		focusQuestion:
			'Cherry AI connects current market evidence to the coffee work your subscription unlocks.',
		tasks: [MARKET_TASK, CATALOG_TASK, PLANS_TASK]
	};
}

export function getDashboardUpgradePrompt(
	context: DashboardAccessContext
): DashboardUpgradePrompt | null {
	const hasParchmentIntelligence = context.ppiAccess === true;
	const hasMallard = hasMallardAccess(context);

	if (!hasParchmentIntelligence && !hasMallard) {
		return {
			headline: 'Add coffee-native intelligence to your work',
			body: 'Parchment Intelligence adds market evidence and the Cherry Green Agent. Mallard Studio adds roastery workflows and the Cherry Roast Agent.',
			cta: 'Compare plans',
			href: '/subscription'
		};
	}

	if (hasParchmentIntelligence && !hasMallard) {
		return {
			headline: 'Connect market evidence to your roastery',
			body: 'Mallard Studio adds inventory, roast, tasting, sales, and margin context, upgrading your workspace to the Cherry Synthesis Agent.',
			cta: 'View Mallard Studio',
			href: '/subscription'
		};
	}

	if (!hasParchmentIntelligence && hasMallard) {
		return {
			headline: 'Add the live market to your operation',
			body: 'Parchment Intelligence adds current supplier evidence, pricing movement, and the cross-domain Cherry Synthesis Agent.',
			cta: 'View Parchment Intelligence',
			href: '/subscription'
		};
	}

	return null;
}
