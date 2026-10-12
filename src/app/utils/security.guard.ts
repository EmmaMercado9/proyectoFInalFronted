import { roleGuard } from './role.guard';
import { ROLES } from '../services/user.service';

export const securityGuard = roleGuard(ROLES.COLABORADOR);
