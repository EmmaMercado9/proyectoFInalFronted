import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';

import { apiErrorMessage, ErrorHandleService } from '../../error/error-handle.service';
import { FacturacionService } from '../../services/facturacion.service';
import { OrderRequest, OrderResponse, OrderService } from '../../services/order.service';

/** Registra la venta, la factura si se pidió y abre el comprobante. */
@Injectable()
export class VentaService {
  private orderService = inject(OrderService);
  private facturacion = inject(FacturacionService);
  private errorService = inject(ErrorHandleService);
  private message = inject(MessageService);
  private router = inject(Router);

  registrar(dto: OrderRequest, facturar: boolean, alGuardar: () => void, alTerminar: () => void): void {
    this.orderService.crearOrdenAdmin(dto).subscribe({
      next: (orden) => {
        alGuardar();
        this.finalizar(orden, facturar, alTerminar);
      },
      error: (err) => {
        alTerminar();
        this.message.add({
          severity: 'error',
          summary: 'Error',
          detail: apiErrorMessage(err, 'Error al procesar la venta'),
          life: 5000,
        });
      },
    });
  }

  private finalizar(orden: OrderResponse, facturar: boolean, alTerminar: () => void): void {
    const irAlComprobante = () => {
      alTerminar();
      this.router.navigate(['/admin/comprobante', orden.trackingId]);
    };
    if (!facturar) {
      irAlComprobante();
      return;
    }
    // La venta ya está guardada: si ARCA falla se avisa y se puede
    // facturar después desde el comprobante
    this.facturacion.facturar(orden.idOrder, {}).subscribe({
      next: (f) => {
        this.message.add({
          severity: 'success',
          summary: 'Venta facturada',
          detail: `${f.tipoDescripcion} ${f.numeroFormateado} · CAE ${f.cae}`,
          life: 5000,
        });
        irAlComprobante();
      },
      error: (err) => {
        const m = this.errorService.toMessage(err);
        this.message.add({
          ...m,
          summary: 'Venta registrada sin factura',
          detail: `${m.detail} — Podés facturarla desde el comprobante.`,
          life: 9000,
        });
        irAlComprobante();
      },
    });
  }
}
