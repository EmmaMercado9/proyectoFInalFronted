// comprobante.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { ToastModule } from 'primeng/toast';

import {
  OrderService,
  OrderResponse,
  OrderDetailResponse,
} from '../services/order.service';
import {
  DevolucionResponse,
  DevolucionService,
} from '../services/devolucion.service';
import { UserService } from '../services/user.service';
import { CancelarOrdenComponent } from '../shared/cancelar-orden/cancelar-orden.component';
import { FacturacionVentaComponent } from '../shared/facturacion-venta/facturacion-venta.component';
import {
  admiteDevolucion,
  formaReintegroLabel,
  paymentLabel,
  statusClass,
  statusLabel,
} from '../utils/order-labels';

@Component({
  selector: 'app-comprobante',
  standalone: true,
  templateUrl: './comprobante.component.html',
  imports: [CommonModule, RouterModule, ToastModule, CancelarOrdenComponent, FacturacionVentaComponent],
})
export class ComprobanteComponent implements OnInit {
  orden: OrderResponse | null = null;
  devoluciones: DevolucionResponse[] = [];
  isLoading = true;
  error = false;
  // Orden a cancelar (abre el diálogo)
  aCancelar: OrderResponse | null = null;

  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private devolucionService = inject(DevolucionService);
  readonly esAdmin = inject(UserService).isAdmin();

  readonly getStatusLabel = statusLabel;
  readonly getStatusClass = statusClass;
  readonly getPaymentLabel = paymentLabel;
  readonly formaReintegroLabel = formaReintegroLabel;

  ngOnInit(): void {
    // Se suscribe a los params: desde un cambio se puede saltar a otra venta
    this.route.paramMap.subscribe((params) => {
      const trackingId = params.get('trackingId');
      if (!trackingId) {
        this.error = true;
        this.isLoading = false;
        return;
      }
      this.cargar(trackingId);
    });
  }

  private cargar(trackingId: string): void {
    this.isLoading = true;
    this.error = false;
    this.orderService
      .getByTracking(trackingId)
      .pipe(
        catchError(() => {
          this.error = true;
          return of(null);
        })
      )
      .subscribe((orden) => {
        this.orden = orden;
        this.isLoading = false;
        this.devoluciones = [];
        if (orden) {
          this.devolucionService
            .porOrden(orden.idOrder)
            .pipe(catchError(() => of([])))
            .subscribe((d) => (this.devoluciones = d));
        }
      });
  }

  get admiteDevolucion(): boolean {
    return !!this.orden && admiteDevolucion(this.orden);
  }

  get puedeCancelar(): boolean {
    return this.esAdmin && this.orden?.status === 'COMPLETADA';
  }

  onCancelada(orden: OrderResponse): void {
    this.orden = orden;
  }

  /** "42 / Negro" a partir de talla y color de la variante vendida */
  varianteLabel(d: OrderDetailResponse): string {
    return [d.talla, d.color].filter(Boolean).join(' / ');
  }

  inicialCliente(): string {
    return this.orden?.cliente?.name?.charAt(0)?.toUpperCase() ?? '?';
  }

  imprimir(): void {
    window.print();
  }
}
