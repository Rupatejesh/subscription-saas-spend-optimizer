import { USER_ROLES } from '../models/User.js';

export function canAccessRole(userRole, allowedRoles) {
  return Object.values(USER_ROLES).includes(userRole) && allowedRoles.includes(userRole);
}
