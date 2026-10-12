// client.service.ts
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ClienteDTO {
  idClient?: string;
  name: string;
  username?: string;
  mail?: string;
  dni?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly API = `${environment.apiUrl}/api`;
  private http = inject(HttpClient);

  // GET /api/clientes?nombre=juan
  buscar(q: string): Observable<ClienteDTO[]> {
    return this.http.get<ClienteDTO[]>(
      `${this.API}/clientes?nombre=${encodeURIComponent(q)}`
    );
  }

  getClients(): Observable<ClienteDTO[]> {
    return this.http.get<ClienteDTO[]>(`${this.API}/clientes/all`);
  }
  // POST /api/clientes
  crear(dto: ClienteDTO): Observable<ClienteDTO> {
    return this.http.post<ClienteDTO>(`${this.API}/clientes`, dto);
  }

  // GET /api/clientes/:id
  getById(id: string): Observable<ClienteDTO> {
    return this.http.get<ClienteDTO>(`${this.API}/clientes/${id}`);
  }
}
