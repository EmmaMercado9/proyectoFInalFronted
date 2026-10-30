import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';

import { PagosService, PlanPago, ajustePorMedio } from '../services/pagos.service';
import { ErrorHandleService } from '../error/error-handle.service';
import { paymentLabel } from '../utils/order-labels';

/**
 * Descuentos y recargos por medio de pago (solo ADMIN).
 * El precio de los productos es el de lista; acá se define cuánto se descuenta
 * en efectivo y cuánto se recarga en cada plan de cuotas.
 */
@Component({
  selector: 'app-config-medios-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-medios-pago.component.html',
})
export class ConfigMediosPagoComponent implements OnInit {
  private pagos = inject(PagosService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  readonly paymentLabel = paymentLabel;
  /** Precio de ejemplo para mostrar cómo queda cada plan */
  readonly ejemplo = 100000;

  planes: PlanPago[] = [];
  cargando = false;
  guardando = false;

  ngOnInit(): void {
    this.cargando = true;
    this.pagos
      .planes()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (p) => (this.planes = p.map((x) => ({ ...x }))),
        error: (err) => this.error(err),
      });
  }

  get medios(): PlanPago[] {
    return this.planes.filter((p) => p.medio !== 'TARJETA_CREDITO');
  }

  get credito(): PlanPago[] {
    return this.planes.filter((p) => p.medio === 'TARJETA_CREDITO');
  }

  totalEjemplo(p: PlanPago): number {
    return this.ejemplo + ajustePorMedio(this.ejemplo, p.porcentaje ?? 0);
  }

  guardar(): void {
    this.guardando = true;
    this.pagos
      .guardar(this.planes)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (p) => {
          this.planes = p.map((x) => ({ ...x }));
          this.message.add({ severity: 'success', summary: 'Guardado', detail: 'Se actualizaron los medios de pago', life: 3000 });
        },
        error: (err) => this.error(err),
      });
  }

  private error(err: unknown): void {
    this.message.add(this.errorService.toMessage(err));
  }
}
