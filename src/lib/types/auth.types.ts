export type UserRole = 'viewer' | 'member' | 'admin';

export const roleHierarchy = {
	viewer: 0,
	member: 1,
	admin: 2
} as const;

export function checkRole(userRole: UserRole | undefined, requiredRole: UserRole): boolean {
	if (!userRole) return false;
	return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
