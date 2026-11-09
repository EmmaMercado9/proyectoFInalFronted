import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
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

  private planes$?: Observable<PlanPago[]>;

  /** Se cachea: los piden muchos componentes; se invalida al guardar */
  planes(): Observable<PlanPago[]> {
    this.planes$ ??= this.http.get<PlanPago[]>(`${this.apiUrl}/api/pagos/planes`).pipe(shareReplay(1));
    return this.planes$;
  }

  guardar(planes: PlanPago[]): Observable<PlanPago[]> {
    return this.http
      .put<PlanPago[]>(`${this.apiUrl}/api/admin/pagos/planes`, planes)
      .pipe(tap(() => (this.planes$ = undefined)));
  }
}

/** Mismo cálculo que el backend: sobre (subtotal − descuento manual), redondeado a centavos. */
export function ajustePorMedio(base: number, porcentaje: number): number {
  const centavos = Math.round(Math.abs(base * porcentaje)); // HALF_UP, como BigDecimal
  return (Math.sign(base * porcentaje) * centavos) / 100;
}
