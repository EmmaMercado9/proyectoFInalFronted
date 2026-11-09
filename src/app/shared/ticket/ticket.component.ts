import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';

import { OrderDetailResponse, OrderResponse } from '../../services/order.service';
import { Factura, docTipoLabel } from '../../services/facturacion.service';
import { AnchoTicket } from './ticket-impresion';
import { pagoConCuotas, paymentLabel, statusLabel } from '../../utils/order-labels';

interface Linea {
  descripcion: string;
  detalle?: string;
  cantidad: number;
  importe: number;
}

const ES_AJUSTE = /^(Descuento$|(Descuento|Recargo) por pago (en |combinado$))/;
const ES_DEVOLUCION = /^Devoluciones anteriores a la factura$/;

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

  /** Cada renglón lleva el precio final: el descuento o recargo ya va repartido adentro */
  get lineas(): Linea[] {
    if (this.factura) {
      const items = this.factura.items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        importe: i.subtotal,
      }));
      if (this.esNotaCredito) return items;
      const ajustes = items.filter((l) => ES_AJUSTE.test(l.descripcion));
      const resto = items.filter((l) => !ES_AJUSTE.test(l.descripcion));
      const productos = resto.filter((l) => !ES_DEVOLUCION.test(l.descripcion));
      const objetivo = [...productos, ...ajustes].reduce((a, l) => a + l.importe, 0);
      return [...this.repartir(productos, objetivo), ...resto.filter((l) => ES_DEVOLUCION.test(l.descripcion))];
    }
    const lineas = (this.orden?.details ?? []).map((d: OrderDetailResponse) => ({
      descripcion: d.productoNombre,
      detalle: [d.talla, d.color].filter(Boolean).join(' / ') || d.sku,
      cantidad: d.quantity,
      importe: d.subtotal,
    }));
    return this.repartir(lineas, this.total);
  }

  /** Reparte el total entre los renglones; el último absorbe los centavos del redondeo */
  private repartir(lineas: Linea[], objetivo: number): Linea[] {
    const base = lineas.reduce((a, l) => a + l.importe, 0);
    if (!base) return lineas;
    let acumulado = 0;
    return lineas.map((l, i) => {
      const importe = i === lineas.length - 1
        ? Math.round((objetivo - acumulado) * 100) / 100
        : Math.round((l.importe * objetivo * 100) / base) / 100;
      acumulado += importe;
      return { ...l, importe };
    });
  }

  get total(): number {
    return this.factura ? this.factura.importeTotal : (this.orden?.totalAmount ?? 0);
  }

  get numeroOrden(): string {
    return this.orden ? this.orden.trackingId.toString().slice(0, 8).toUpperCase() : '';
  }
}
