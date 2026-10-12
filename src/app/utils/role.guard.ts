import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { UserService } from '../services/user.service';
import { ValidTokenService } from '../services/valid-token.service';

/**
 * Guard de entrada al panel: verifica sesión, rol permitido y que el backend
 * siga considerando válido el token (POST /api/auth/validate).
 */
export function roleGuard(...roles: string[]): CanActivateFn {
  return (): Observable<boolean | UrlTree> => {
    const service = inject(UserService);
    const validate = inject(ValidTokenService);
    const router = inject(Router);

    const loginTree = () => {
      service.logout();
      return router.createUrlTree(['/login']);
    };

    const token = service.getToken();
    const role = service.getUserRole();
    if (!token || !service.isLoggedIn() || !role || !roles.includes(role)) {
      return of(loginTree());
    }

    return validate.validateToken(token).pipe(
      map((isValid) => (isValid ? true : loginTree())),
      catchError(() => of(loginTree()))
    );
  };
}

/**
 * Guard liviano para rutas hijas: solo chequea el rol guardado (el token ya
 * lo validó el guard del padre). Si no tiene permiso vuelve a `fallback`.
 */
export function hasRoleGuard(roles: string[], fallback = '/admin'): CanActivateFn {
  return () => {
    const role = inject(UserService).getUserRole();
    const router = inject(Router);
    return role !== null && roles.includes(role)
      ? true
      : router.createUrlTree([fallback]);
  };
}
