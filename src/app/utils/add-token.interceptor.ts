import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

// Rutas que no requieren token
const EXCLUDED_URLS = [`${environment.apiUrl}/login`];

export const addTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (EXCLUDED_URLS.some((url) => req.url.startsWith(url))) {
    return next(req);
  }

  const usuarioService = inject(UserService);
  const router = inject(Router);
  const token = usuarioService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Token vencido o inválido: cerramos sesión y volvemos al login
      if (error.status === 401 && token) {
        usuarioService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
