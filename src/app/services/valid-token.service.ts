import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { catchError, map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ValidTokenService {
  constructor(private http: HttpClient) {}

  API_URL: string = `${environment.apiUrl}/api/auth`;

  validateToken(token: any): Observable<boolean> {
    return this.http.post<boolean>(
      `${this.API_URL}/validate`,
      { token: token },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
