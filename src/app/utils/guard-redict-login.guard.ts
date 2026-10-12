import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserService } from '../services/user.service';

// Si ya hay sesión, redirige al panel según el rol en vez de mostrar el login
export const guardRedictLoginGuard: CanActivateFn = () => {
  const service = inject(UserService);
  if (!service.isLoggedIn()) return true;

  const home = service.homeRoute();
  if (home) return inject(Router).createUrlTree([home]);

  service.logout();
  return true;
};
