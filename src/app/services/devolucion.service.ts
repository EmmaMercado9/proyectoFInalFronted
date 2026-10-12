import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OrderCliente, Page, PaymentMethod } from './order.service';

export type TipoDevolucion = 'DEVOLUCION' | 'CAMBIO';
export type FormaReintegro = 'EFECTIVO' | 'MISMO_MEDIO';

export interface DevolucionItemRequest {
  idDetail: number; // renglón de la venta original
  quantity: number;
  reingresaStock: boolean; // false = fallado, no vuelve al stock
}

export interface DevolucionRequest {
  tipo: TipoDevolucion;
  motivo?: string;
  formaReintegro?: FormaReintegro; // obligatorio si hay dinero a reintegrar
  paymentDiferencia?: PaymentMethod; // CAMBIO: si el cliente paga diferencia
  items: DevolucionItemRequest[];
  itemsNuevos?: { variantId: number; quantity: number }[]; // solo CAMBIO
}

export interface DevolucionItemResponse {
  idDetail: number;
  variantId: number;
  sku: string;
  productoNombre: string;
  variante?: string;
  quantity: number;
  reingresaStock: boolean;
  monto: number;
}

export interface DevolucionResponse {
  idDevolucion: number;
  tipo: TipoDevolucion;
  fecha: string;
  usuario?: string;
  motivo?: string;
  formaReintegro?: FormaReintegro | null;
  idOrder: number;
  trackingIdOrden: string;
  paymentOrden?: PaymentMethod;
  cliente?: OrderCliente;
  montoDevuelto: number;
  montoNuevaVenta: number;
  diferencia: number; // > 0 paga el cliente, < 0 se le reintegra
  idOrdenCambio?: number;
  trackingIdOrdenCambio?: string;
  items: DevolucionItemResponse[];
}

// DevolucionController (ADMIN y COLABORADOR)
@Injectable({ providedIn: 'root' })
export class DevolucionService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/api/admin`;

  registrar(idOrder: number, dto: DevolucionRequest): Observable<DevolucionResponse> {
    return this.http.post<DevolucionResponse>(
      `${this.API}/orders/${idOrder}/devoluciones`,
      dto
    );
  }

  porOrden(idOrder: number): Observable<DevolucionResponse[]> {
    return this.http.get<DevolucionResponse[]>(
      `${this.API}/orders/${idOrder}/devoluciones`
    );
  }

  listar(page = 0, size = 20): Observable<Page<DevolucionResponse>> {
    return this.http.get<Page<DevolucionResponse>>(
      `${this.API}/devoluciones?page=${page}&size=${size}`
    );
  }
}
