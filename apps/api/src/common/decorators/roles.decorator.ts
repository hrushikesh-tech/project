import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Decorator to mark a route as public (bypasses JWT auth).
 */
export const Public = () => SetMetadata('isPublic', true);
