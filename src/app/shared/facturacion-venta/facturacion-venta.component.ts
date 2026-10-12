import { Component, Input, OnChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { catchError, finalize, of } from 'rxjs';

import { OrderResponse } from '../../services/order.service';
import { DevolucionResponse } from '../../services/devolucion.service';
import {
  CONDICIONES_IVA,
  EstadoFacturacion,
  Factura,
  FacturacionService,
  TIPOS_DOC,
  docTipoLabel,
} from '../../services/facturacion.service';
import { UserService } from '../../services/user.service';
import { ErrorHandleService } from '../../error/error-handle.service';

type OpcionNc = 'DEVOLUCION' | 'TOTAL' | 'IMPORTE';

/**
 * Bloque "Facturación electrónica" del comprobante de una venta:
 * facturar (Factura C), ver facturas y emitir notas de crédito.
 */
@Component({
  selector: 'app-facturacion-venta',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DialogModule],
  templateUrl: './facturacion-venta.component.html',
})
export class FacturacionVentaComponent implements OnChanges {
  @Input({ required: true }) orden!: OrderResponse;
  @Input() devoluciones: DevolucionResponse[] = [];

  private facturacion = inject(FacturacionService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);
  readonly esAdmin = inject(UserService).isAdmin();

  readonly tiposDoc = TIPOS_DOC;
  readonly condiciones = CONDICIONES_IVA;
  readonly docTipoLabel = docTipoLabel;

  estado: EstadoFacturacion | null = null;
  facturas: Factura[] = [];
  cargando = true;
  enviando = false;
  probando = false;

  // Diálogo facturar
  dialogFacturar = false;
  docTipo = 99;
  docNro: number | null = null;
  condicionIva = 5;

  // Diálogo nota de crédito
  dialogNc = false;
  opcionNc: OpcionNc = 'TOTAL';
  devolucionNc: number | null = null;
  importeNc: number | null = null;
  motivoNc = '';

  ngOnChanges(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.facturacion
      .estado()
      .pipe(catchError(() => of(null)))
      .subscribe((e) => (this.estado = e));
    this.facturacion
      .porOrden(this.orden.idOrder)
      .pipe(
        catchError(() => of([] as Factura[])),
        finalize(() => (this.cargando = false))
      )
      .subscribe((f) => (this.facturas = f));
  }

  // ─── Estado ─────────────────────────────────────────────────────────────

  get factura(): Factura | undefined {
    return this.facturas.find((f) => f.tipo === 'FACTURA_C');
  }

  get notasCredito(): Factura[] {
    return this.facturas.filter((f) => f.tipo === 'NOTA_CREDITO_C');
  }

  get puedeFacturar(): boolean {
    return (
      !!this.estado?.habilitada &&
      !this.factura &&
      (this.orden.status === 'COMPLETADA' || this.orden.status === 'DEVUELTA_PARCIAL') &&
      this.importeAFacturar > 0
    );
  }

  /** Lo cobrado menos lo ya devuelto (el backend factura lo mismo) */
  get importeAFacturar(): number {
    const devuelto = this.devoluciones.reduce((a, d) => a + d.montoDevuelto, 0);
    return Math.round((this.orden.totalAmount - devuelto) * 100) / 100;
  }

  get saldo(): number {
    return this.factura?.saldoAnulable ?? 0;
  }

  /** Devoluciones hechas después de facturar y todavía sin nota de crédito */
  get devolucionesSinNc(): DevolucionResponse[] {
    const f = this.factura;
    if (!f) return [];
    const conNc = new Set(this.notasCredito.map((n) => n.idDevolucion));
    return this.devoluciones.filter(
      (d) => !conNc.has(d.idDevolucion) && new Date(d.fecha) >= new Date(f.creadoEn)
    );
  }

  get avisoNc(): string | null {
    if (!this.factura || this.saldo <= 0) return null;
    if (this.orden.status === 'CANCELADA')
      return 'La venta se canceló pero la factura sigue vigente: emití la nota de crédito.';
    if (this.devolucionesSinNc.length)
      return `Hay ${this.devolucionesSinNc.length} devolución(es) sin nota de crédito.`;
    return null;
  }

  // ─── Facturar ───────────────────────────────────────────────────────────

  abrirFacturar(): void {
    // Si la venta tiene cliente con DNI, se propone facturarle a ese DNI
    const dni = Number((this.orden.cliente?.dni ?? '').replace(/\D/g, ''));
    this.docTipo = dni ? 96 : 99;
    this.docNro = dni || null;
    this.condicionIva = 5;
    this.dialogFacturar = true;
  }

  onDocTipo(): void {
    if (this.docTipo === 99) {
      this.docNro = null;
      this.condicionIva = 5;
    }
  }

  get facturarValido(): boolean {
    if (this.docTipo === 99) return this.importeAFacturar < 10_000_000;
    return !!this.docNro && this.docNro > 0;
  }

  facturar(): void {
    this.enviando = true;
    this.facturacion
      .facturar(this.orden.idOrder, {
        docTipo: this.docTipo,
        docNro: this.docTipo === 99 ? 0 : (this.docNro ?? undefined),
        condicionIvaReceptorId: this.docTipo === 99 ? 5 : this.condicionIva,
      })
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (f) => {
          this.dialogFacturar = false;
          this.facturas = [...this.facturas, f];
          this.message.add({
            severity: 'success',
            summary: 'Factura emitida',
            detail: `${f.tipoDescripcion} ${f.numeroFormateado} · CAE ${f.cae}`,
            life: 5000,
          });
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  // ─── Nota de crédito ────────────────────────────────────────────────────

  abrirNc(): void {
    const pendientes = this.devolucionesSinNc;
    this.opcionNc = pendientes.length ? 'DEVOLUCION' : 'TOTAL';
    this.devolucionNc = pendientes[0]?.idDevolucion ?? null;
    this.importeNc = null;
    this.motivoNc =
      this.orden.status === 'CANCELADA' ? this.orden.motivoCancelacion ?? 'Venta cancelada' : '';
    this.dialogNc = true;
  }

  get importeNcCalculado(): number {
    if (this.opcionNc === 'DEVOLUCION') {
      return this.devoluciones.find((d) => d.idDevolucion === this.devolucionNc)?.montoDevuelto ?? 0;
    }
    if (this.opcionNc === 'IMPORTE') return this.importeNc ?? 0;
    return this.saldo;
  }

  get ncValida(): boolean {
    const imp = this.importeNcCalculado;
    if (this.opcionNc === 'DEVOLUCION' && !this.devolucionNc) return false;
    return imp > 0 && imp <= this.saldo + 0.001;
  }

  emitirNc(): void {
    const f = this.factura;
    if (!f) return;
    this.enviando = true;
    this.facturacion
      .notaCredito(f.idFactura, {
        devolucionId: this.opcionNc === 'DEVOLUCION' ? (this.devolucionNc ?? undefined) : undefined,
        importe: this.opcionNc === 'IMPORTE' ? (this.importeNc ?? undefined) : undefined,
        motivo: this.motivoNc.trim() || undefined,
      })
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (nc) => {
          this.dialogNc = false;
          this.message.add({
            severity: 'success',
            summary: 'Nota de crédito emitida',
            detail: `${nc.numeroFormateado} por $${nc.importeTotal} · CAE ${nc.cae}`,
            life: 5000,
          });
          this.cargar(); // refresca el saldo de la factura
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  // ─── Diagnóstico (ADMIN) ────────────────────────────────────────────────

  probar(): void {
    this.probando = true;
    this.facturacion
      .probar()
      .pipe(finalize(() => (this.probando = false)))
      .subscribe({
        next: (e) =>
          this.message.add({
            severity: e.habilitada ? 'success' : 'info',
            summary: 'Conexión con ARCA',
            detail: e.mensaje,
            life: 8000,
          }),
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }
}
