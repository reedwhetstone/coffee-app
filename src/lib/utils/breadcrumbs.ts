/**
 * Breadcrumb utilities for generating navigation paths and schema
 */

export interface BreadcrumbItem {
	name: string;
	url: string;
}

/**
 * Generate breadcrumbs based on current path
 */
export function generateBreadcrumbs(pathname: string, baseUrl: string): BreadcrumbItem[] {
	const breadcrumbs: BreadcrumbItem[] = [];

	// Always start with home
	breadcrumbs.push({
		name: 'Home',
		url: baseUrl
	});

	// Parse path segments
	const segments = pathname.split('/').filter((segment) => segment.length > 0);

	// Build breadcrumbs from path segments
	let currentPath = '';

	for (const segment of segments) {
		currentPath += `/${segment}`;

		// Map path segments to user-friendly names
		const name = getBreadcrumbName(segment);

		breadcrumbs.push({
			name,
			url: `${baseUrl}${currentPath}`
		});
	}

	return breadcrumbs;
}

/**
 * Map path segments to user-friendly breadcrumb names
 */
function getBreadcrumbName(segment: string): string {
	const segmentMap: Record<string, string> = {
		api: 'API Documentation',
		contact: 'Contact Us',
		auth: 'Authentication',
		subscription: 'Subscription',
		beans: 'My Coffee Beans',
		roast: 'Roast Profiles',
		profit: 'Profit Analysis',
		admin: 'Admin Dashboard',
		'no-cookies': 'Cookie Policy',
		success: 'Success'
	};

	return segmentMap[segment] || capitalize(segment.replace(/-/g, ' '));
}

/**
 * Capitalize first letter of each word
 */
function capitalize(str: string): string {
	return str.replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Generate breadcrumbs for coffee-related pages
 */
export function generateCoffeeBreadcrumbs(
	coffeeName: string,
	baseUrl: string,
	section?: 'details' | 'roast' | 'notes'
): BreadcrumbItem[] {
	const breadcrumbs: BreadcrumbItem[] = [
		{ name: 'Home', url: baseUrl },
		{ name: 'Coffee Catalog', url: `${baseUrl}/` }
	];

	// Add coffee-specific breadcrumb
	const coffeeUrl = `${baseUrl}/coffee/${coffeeName.toLowerCase().replace(/\s+/g, '-')}`;
	breadcrumbs.push({
		name: coffeeName,
		url: coffeeUrl
	});

	// Add section-specific breadcrumb if provided
	if (section) {
		const sectionNames = {
			details: 'Details',
			roast: 'Roast Profile',
			notes: 'Tasting Notes'
		};

		breadcrumbs.push({
			name: sectionNames[section],
			url: `${coffeeUrl}/${section}`
		});
	}

	return breadcrumbs;
}

/**
 * Generate breadcrumbs for user profile pages
 */
export function generateProfileBreadcrumbs(
	baseUrl: string,
	section?: 'beans' | 'roast' | 'profit' | 'settings'
): BreadcrumbItem[] {
	const breadcrumbs: BreadcrumbItem[] = [{ name: 'Home', url: baseUrl }];

	if (section) {
		const sectionNames = {
			beans: 'My Coffee Beans',
			roast: 'Roast Profiles',
			profit: 'Profit Analysis',
			settings: 'Account Settings'
		};

		const sectionUrls = {
			beans: '/beans',
			roast: '/roast',
			profit: '/profit',
			settings: '/settings'
		};

		breadcrumbs.push({
			name: sectionNames[section],
			url: `${baseUrl}${sectionUrls[section]}`
		});
	}

	return breadcrumbs;
}

/**
 * Generate breadcrumbs for admin pages
 */
export function generateAdminBreadcrumbs(
	baseUrl: string,
	section?: 'users' | 'analytics' | 'content' | 'settings'
): BreadcrumbItem[] {
	const breadcrumbs: BreadcrumbItem[] = [
		{ name: 'Home', url: baseUrl },
		{ name: 'Admin Dashboard', url: `${baseUrl}/admin` }
	];

	if (section) {
		const sectionNames = {
			users: 'User Management',
			analytics: 'Analytics',
			content: 'Content Management',
			settings: 'System Settings'
		};

		breadcrumbs.push({
			name: sectionNames[section],
			url: `${baseUrl}/admin/${section}`
		});
	}

	return breadcrumbs;
}
