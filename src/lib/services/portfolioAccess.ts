import { checkRole, type UserRole } from '$lib/types/auth.types';

export function canManagePortfolio(role: UserRole, ppiAccess = false): boolean {
	return ppiAccess || checkRole(role, 'member');
}

export function canUseMallardControls(role: UserRole): boolean {
	return checkRole(role, 'member');
}
