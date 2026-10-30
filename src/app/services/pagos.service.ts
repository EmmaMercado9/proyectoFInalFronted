import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PaymentMethod } from './order.service';

/** Plan de pago: porcentaje negativo = descuento, positivo = recargo. */
export interface PlanPago {
  medio: PaymentMethod;
  cuotas: number;
  porcentaje: number;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  planes(): Observable<PlanPago[]> {
    return this.http.get<PlanPago[]>(`${this.apiUrl}/api/pagos/planes`);
  }

  guardar(planes: PlanPago[]): Observable<PlanPago[]> {
    return this.http.put<PlanPago[]>(`${this.apiUrl}/api/admin/pagos/planes`, planes);
  }
}

/** Mismo cálculo que el backend: sobre (subtotal − descuento manual), redondeado a centavos. */
export function ajustePorMedio(base: number, porcentaje: number): number {
  const centavos = Math.round(Math.abs(base * porcentaje)); // HALF_UP, como BigDecimal
  return (Math.sign(base * porcentaje) * centavos) / 100;
}
