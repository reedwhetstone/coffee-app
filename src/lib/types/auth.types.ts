export type UserRole = 'viewer' | 'member' | 'admin' | 'api';

// Support for multiple roles per user
export type UserRoles = UserRole | UserRole[];

export const roleHierarchy = {
	viewer: 0,
	api: 0, // Same level as viewer - API users have basic access only
	member: 1,
	admin: 2
} as const;

export function checkRole(
	userRole: UserRole | UserRole[] | undefined,
	requiredRole: UserRole
): boolean {
	if (!userRole) return false;

	// Special handling for API role - it should not inherit member permissions
	if (requiredRole === 'member') {
		if (Array.isArray(userRole)) {
			return userRole.includes('member') || userRole.includes('admin');
		}
		return userRole === 'member' || userRole === 'admin';
	}

	// Handle array of roles
	if (Array.isArray(userRole)) {
		return userRole.some((role) => roleHierarchy[role] >= roleHierarchy[requiredRole]);
	}

	// Handle single role
	return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Check if user has specific role (exact match)
export function hasRole(
	userRole: UserRole | UserRole[] | undefined,
	targetRole: UserRole
): boolean {
	if (!userRole) return false;

	if (Array.isArray(userRole)) {
		return userRole.includes(targetRole);
	}

	return userRole === targetRole;
}
