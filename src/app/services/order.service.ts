// order.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type PaymentMethod =
  | 'EFECTIVO'
  | 'TARJETA_DEBITO'
  | 'TARJETA_CREDITO'
  | 'TRANSFERENCIA'
  | 'MERCADOPAGO';

export type OrderStatus =
  | 'PENDIENTE'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'EN_ENVIO'
  | 'DEVUELTA_PARCIAL'
  | 'DEVUELTA';

// El canal lo asigna el backend según el endpoint; no se envía.
export interface OrderRequest {
  userId?: string;
  clienteId?: string;
  payment: PaymentMethod;
  discount?: number;
  address?: string;
  description?: string;
  items: { variantId: number; quantity: number }[];
}

export interface OrderDetailResponse {
  idDetail: number;
  variantId: number;
  sku: string;
  productoNombre: string;
  talla?: string;
  color?: string;
  imagenUrl?: string;
  quantity: number;
  cantidadDevuelta: number; // unidades ya devueltas
  priceUnit: number;
  subtotal: number;
}

export interface OrderUsuario {
  id: string;
  nombre: string;
  email: string;
}

/** Respuesta paginada de Spring (Page<T>) */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface OrderCliente {
  idClient: string;
  name: string;
  mail?: string;
  dni?: string;
}

export interface OrderResponse {
  idOrder: number;
  trackingId: string;
  canal: string;
  payment: PaymentMethod;
  status: OrderStatus;
  orderDate: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  address?: string;
  description?: string;
  // Cancelación
  motivoCancelacion?: string;
  fechaCancelacion?: string;
  canceladoPor?: string;
  // Hasta cuándo se aceptan devoluciones / cambios
  fechaLimiteDevolucion?: string;
  user?: OrderUsuario; // quién registró la venta
  cliente?: OrderCliente;
  details: OrderDetailResponse[];
}

export interface OrderListadoDTO {
  idOrder: number;
  trackingId: string;
  orderDate: string;
  canal: string;
  payment: string;
  status: string;
  totalAmount: number;
  cantidadItems: number;
  cliente?: OrderCliente;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly API = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // Canal ADMIN — punto de venta físico
  crearOrdenAdmin(dto: OrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.API}/admin/orders`, dto);
  }

  // Canal ONLINE — tienda web (solo rol CLIENTE; el backend toma el userId del token)
  crearOrdenOnline(dto: OrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.API}/tienda/orders`, dto);
  }

  // Órdenes del cliente logueado (solo rol CLIENTE)
  misOrdenes(page = 0, size = 20): Observable<Page<OrderListadoDTO>> {
    return this.http.get<Page<OrderListadoDTO>>(
      `${this.API}/tienda/mis-ordenes?page=${page}&size=${size}&sort=orderDate,desc`
    );
  }

  getByTracking(trackingId: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(
      `${this.API}/orders/tracking/${trackingId}`
    );
  }

  // Pageable de Spring: más recientes primero
  listarAdmin(page = 0, size = 20): Observable<Page<OrderListadoDTO>> {
    return this.http.get<Page<OrderListadoDTO>>(
      `${this.API}/admin/orders?page=${page}&size=${size}&sort=orderDate,desc`
    );
  }

  // Solo ADMIN. Anula la venta completa y devuelve todo el stock.
  cancelar(idOrder: number, motivo?: string): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(
      `${this.API}/admin/orders/${idOrder}/cancelar`,
      { motivo: motivo?.trim() || null }
    );
  }
}
