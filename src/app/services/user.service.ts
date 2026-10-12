import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { User, UserAdmin, UserAdminGet, UserModify } from '../user/interfaces/user.model';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/** Roles que maneja el backend (enum Rol) */
export const ROLES = {
  ADMIN: 'ADMIN',
  COLABORADOR: 'COLABORADOR',
} as const;

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  // En SSR no existe localStorage: todos los accesos pasan por este flag
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly url = environment.apiUrl;

  generateToken(user: User): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.url}/login`, {
      email: user.email,
      password: user.password,
    });
  }

  loginUser(token: string) {
    if (this.isBrowser) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }

  /** Hay token y todavía no venció (el backend lo emite con `exp`, 1 h por defecto) */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const { exp } = jwtDecode<{ exp?: number }>(token);
      if (exp && exp * 1000 <= Date.now()) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  logout() {
    if (this.isBrowser) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    return true;
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  setUser(user: any) {
    if (this.isBrowser) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  getUser(): any | null {
    if (!this.isBrowser) return null;
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      // Dato corrupto en storage: limpiamos la sesión
      this.logout();
      return null;
    }
  }

  getUserRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  isAdmin(): boolean {
    return this.getUserRole() === ROLES.ADMIN;
  }

  /** Pantalla inicial según el rol, o null si el rol no tiene acceso */
  homeRoute(): string | null {
    switch (this.getUserRole()) {
      case ROLES.ADMIN:
        return '/admin';
      case ROLES.COLABORADOR:
        return '/admin/pos';
      default:
        return null;
    }
  }

  getUserId(): string | null {
    return this.getUser()?.idUser ?? null;
  }

  getUserCurrent(): Observable<any> {
    return this.http.get(`${this.url}/getUser/current-user`);
  }

  // 201 { status, message } · 409 si el mail ya existe
  addUser(userAdmin: UserAdmin): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(
      `${this.url}/usersAdd`,
      userAdmin
    );
  }

  // 204 sin cuerpo
  deleteUser(uuid: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/deleteUser/${uuid}`);
  }

  // PUT /users/modify — el backend identifica al usuario por idUser
  modifyUser(user: UserModify): Observable<boolean> {
    return this.http.put<boolean>(`${this.url}/users/modify`, user);
  }

  // 204 sin cuerpo cuando no hay usuarios → se normaliza a []
  getAllUsers(): Observable<UserAdminGet[]> {
    return this.http
      .get<UserAdminGet[] | null>(`${this.url}/getUser/all`)
      .pipe(map((list) => list ?? []));
  }
}
