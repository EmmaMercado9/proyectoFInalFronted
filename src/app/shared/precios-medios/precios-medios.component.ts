import { Component, Input, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';

import { PagosService, PlanPago, ajustePorMedio } from '../../services/pagos.service';

const ORDEN = ['EFECTIVO', 'TRANSFERENCIA', 'MERCADOPAGO', 'TARJETA_DEBITO', 'TARJETA_CREDITO'];
const NOMBRE: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transfer.',
  MERCADOPAGO: 'MP',
  TARJETA_DEBITO: 'Débito',
  TARJETA_CREDITO: 'Crédito',
};

/** Cuánto sale un precio con cada medio de pago, agrupando los que dan igual. */
@Component({
  selector: 'app-precios-medios',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (grupos.length) {
      <p class="text-[11px] text-gray-500 leading-snug mt-1">
        @for (g of grupos; track g.etiqueta; let ultimo = $last) {
          {{ g.etiqueta }} <b class="text-gray-700 whitespace-nowrap">{{ g.precio | currency: 'ARS' : 'symbol-narrow' : '1.0-0' }}</b>{{ ultimo ? '' : ' · ' }}
        }
      </p>
    }
  `,
})
export class PreciosMediosComponent implements OnInit, OnChanges {
  @Input({ required: true }) precio = 0;

  private pagos = inject(PagosService);
  private planes: PlanPago[] = [];
  grupos: { etiqueta: string; precio: number }[] = [];

  ngOnInit(): void {
    this.pagos
      .planes()
      .pipe(catchError(() => of([] as PlanPago[])))
      .subscribe((p) => {
        this.planes = p
          .filter((x) => x.activo)
          .sort((a, b) => ORDEN.indexOf(a.medio) - ORDEN.indexOf(b.medio) || a.cuotas - b.cuotas);
        this.armar();
      });
  }

  ngOnChanges(): void {
    this.armar();
  }

  private armar(): void {
    const porPorcentaje = new Map<number, string[]>();
    for (const p of this.planes) {
      const nombre = p.cuotas > 1 ? `${p.cuotas} cuotas` : NOMBRE[p.medio];
      porPorcentaje.set(p.porcentaje, [...(porPorcentaje.get(p.porcentaje) ?? []), nombre]);
    }
    this.grupos = [...porPorcentaje.entries()].map(([pct, nombres]) => ({
      etiqueta: nombres.join('/'),
      precio: this.precio + ajustePorMedio(this.precio, pct),
    }));
  }
}
