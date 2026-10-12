import { Injectable, inject } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { UserService } from '../services/user.service';

@Injectable({
  providedIn: 'root',
})
export class AuthIdUserService {
  private userService = inject(UserService);

  getUserIdFromToken(): number | null {
    const token = this.userService.getToken();
    if (!token) return null;
    try {
      const decodedToken: any = jwtDecode(token);
      return decodedToken.idUser ?? null;
    } catch {
      return null;
    }
  }
}
