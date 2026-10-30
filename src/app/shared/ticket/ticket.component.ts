import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';

import { OrderDetailResponse, OrderResponse } from '../../services/order.service';
import { Factura, docTipoLabel } from '../../services/facturacion.service';
import { AnchoTicket } from './ticket-impresion';
import { ajusteMedioLabel, pagoConCuotas, paymentLabel, statusLabel } from '../../utils/order-labels';

interface Linea {
  descripcion: string;
  detalle?: string;
  cantidad: number;
  importe: number;
}

/**
 * Ticket para ticketeadora térmica. Un solo comprobante:
 * - con `factura`: Ticket Factura C / Nota de Crédito C con CAE y QR de ARCA
 * - sin factura: comprobante de venta "no válido como factura"
 * Se muestra solo al imprimir (ver ticket-impresion.ts).
 */
@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket.component.html',
})
export class TicketComponent implements OnChanges {
  /** Venta (opcional para imprimir solo una nota de crédito) */
  @Input() orden: OrderResponse | null = null;
  /** Factura o nota de crédito autorizada por ARCA */
  @Input() factura: Factura | null = null;
  /** Ancho del rollo */
  @Input() ancho: AnchoTicket = 80;
  /** true = copia para mostrar en pantalla (no se imprime) */
  @Input() vistaPrevia = false;

  readonly docTipoLabel = docTipoLabel;
  readonly paymentLabel = paymentLabel;
  readonly pagoConCuotas = pagoConCuotas;
  readonly ajusteMedioLabel = ajusteMedioLabel;
  readonly statusLabel = statusLabel;
  qr = '';

  ngOnChanges(): void {
    this.qr = '';
    const url = this.factura?.qrUrl;
    if (url) {
      QRCode.toDataURL(url, { margin: 0, width: 300, errorCorrectionLevel: 'M' })
        .then((d) => (this.qr = d))
        .catch(() => (this.qr = ''));
    }
  }

  get esNotaCredito(): boolean {
    return this.factura?.tipo === 'NOTA_CREDITO_C';
  }

  get codigo(): string {
    return String(this.factura?.codigoTipo ?? '').padStart(3, '0');
  }

  /** Con factura se usan sus líneas (incluyen descuento y devoluciones previas) */
  get lineas(): Linea[] {
    if (this.factura) {
      return this.factura.items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        importe: i.subtotal,
      }));
    }
    return (this.orden?.details ?? []).map((d: OrderDetailResponse) => ({
      descripcion: d.productoNombre,
      detalle: [d.talla, d.color].filter(Boolean).join(' / ') || d.sku,
      cantidad: d.quantity,
      importe: d.subtotal,
    }));
  }

  get total(): number {
    return this.factura ? this.factura.importeTotal : (this.orden?.totalAmount ?? 0);
  }

  get numeroOrden(): string {
    return this.orden ? this.orden.trackingId.toString().slice(0, 8).toUpperCase() : '';
  }
}
