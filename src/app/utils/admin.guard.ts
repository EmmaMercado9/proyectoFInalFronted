import { hasRoleGuard, roleGuard } from './role.guard';
import { ROLES } from '../services/user.service';

/** Entrada al panel: ADMIN y COLABORADOR (el backend limita cada endpoint) */
export const panelGuard = roleGuard(ROLES.ADMIN, ROLES.COLABORADOR);

/** Secciones exclusivas de ADMIN dentro del panel */
export const adminGuard = hasRoleGuard([ROLES.ADMIN]);
