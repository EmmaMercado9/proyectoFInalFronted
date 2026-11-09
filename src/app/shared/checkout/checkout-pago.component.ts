import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PaymentMethod } from '../../services/order.service';
import { PagosService, PlanPago, ajustePorMedio } from '../../services/pagos.service';
import { FacturacionService } from '../../services/facturacion.service';

export interface DatosPago {
  payment: PaymentMethod;
  cuotas?: number;
  pagos?: { medio: PaymentMethod; cuotas?: number; monto: number }[];
  discount?: number;
  facturar: boolean;
}

/** Medio de pago, cuotas, descuento, totales y confirmación: lo comparten el POS y el carrito. */
@Component({
  selector: 'app-checkout-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout-pago.component.html',
})
export class CheckoutPagoComponent implements OnInit {
  @Input({ required: true }) subtotal = 0;
  @Input({ required: true }) cantidadItems = 0;
  @Input() procesando = false;
  @Output() confirmar = new EventEmitter<DatosPago>();

  private pagos = inject(PagosService);
  private facturacion = inject(FacturacionService);

  metodoPago: PaymentMethod = 'EFECTIVO';
  cuotas = 1;
  descuento = 0;
  planes: PlanPago[] = [];

  // Pago combinado: el último renglón siempre cubre lo que falta
  combinado = false;
  filas: { medio: PaymentMethod; cuotas: number; monto: number | null }[] = [];

  // Facturación al vender (opcional, se recuerda la elección)
  facturacionLista = false;
  esPrueba = true;
  facturarAlVender = this.leerPreferencia();

  readonly metodosPago: { value: PaymentMethod; label: string; icon: string }[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: 'pi-wallet' },
    { value: 'TARJETA_DEBITO', label: 'Débito', icon: 'pi-credit-card' },
    { value: 'TARJETA_CREDITO', label: 'Crédito', icon: 'pi-credit-card' },
    { value: 'TRANSFERENCIA', label: 'Transfer.', icon: 'pi-send' },
    { value: 'MERCADOPAGO', label: 'MP', icon: 'pi-mobile' },
  ];

  ngOnInit(): void {
    this.pagos.planes().subscribe({ next: (p) => (this.planes = p), error: () => (this.planes = []) });
    this.facturacion.estado().subscribe({
      next: (e) => {
        this.facturacionLista = e.habilitada;
        this.esPrueba = e.ambiente !== 'PRODUCCION';
      },
      error: () => (this.facturacionLista = false),
    });
  }

  private leerPreferencia(): boolean {
    try {
      return localStorage.getItem('pos.facturar') === '1';
    } catch {
      return false;
    }
  }

  cambiarFacturar(valor: boolean): void {
    this.facturarAlVender = valor;
    try {
      localStorage.setItem('pos.facturar', valor ? '1' : '0');
    } catch {
      /* sin storage */
    }
  }

  /** Subtotal menos el descuento manual: sobre esto se aplica el porcentaje del medio de pago */
  get baseConDescuento(): number {
    return Math.max(0, this.subtotal - this.descuento);
  }

  planDe(medio: string, cuotas = 1): PlanPago | undefined {
    return this.planes.find((p) => p.medio === medio && p.cuotas === cuotas && p.activo);
  }

  /** Cuotas habilitadas de la tarjeta de crédito (1, 3, 4, 6…) */
  get planesCredito(): PlanPago[] {
    return this.planes.filter((p) => p.medio === 'TARJETA_CREDITO' && p.activo);
  }

  get porcentajeMedio(): number {
    return this.planDe(this.metodoPago, this.metodoPago === 'TARJETA_CREDITO' ? this.cuotas : 1)?.porcentaje ?? 0;
  }

  get ajusteMedio(): number {
    if (this.combinado) return this.filas.reduce((a, _, i) => a + this.ajusteFila(i), 0);
    return ajustePorMedio(this.baseConDescuento, this.porcentajeMedio);
  }

  /** Los medios habilitados: no se puede combinar con ninguno que no exista */
  get mediosDisponibles() {
    return this.metodosPago.filter((m) => this.planes.some((p) => p.medio === m.value && p.activo));
  }

  activarCombinado(): void {
    const [a, b] = this.mediosDisponibles;
    this.filas = [
      { medio: a.value, cuotas: 1, monto: null },
      { medio: (b ?? a).value, cuotas: 1, monto: null },
    ];
    this.combinado = true;
  }

  desactivarCombinado(): void {
    this.combinado = false;
    this.filas = [];
  }

  agregarFila(): void {
    this.filas.push({ medio: this.mediosDisponibles[0].value, cuotas: 1, monto: null });
  }

  quitarFila(i: number): void {
    this.filas.splice(i, 1);
    if (this.filas.length < 2) this.desactivarCombinado();
  }

  elegirMedioFila(i: number): void {
    this.filas[i].cuotas = 1;
  }

  esUltimaFila(i: number): boolean {
    return i === this.filas.length - 1;
  }

  montoFila(i: number): number {
    if (!this.esUltimaFila(i)) return this.filas[i].monto ?? 0;
    const otras = this.filas.slice(0, -1).reduce((a, f) => a + (f.monto ?? 0), 0);
    return Math.round((this.baseConDescuento - otras) * 100) / 100;
  }

  private porcentajeFila(i: number): number {
    return this.planDe(this.filas[i].medio, this.filas[i].cuotas)?.porcentaje ?? 0;
  }

  ajusteFila(i: number): number {
    return ajustePorMedio(this.montoFila(i), this.porcentajeFila(i));
  }

  cobrarFila(i: number): number {
    return this.montoFila(i) + this.ajusteFila(i);
  }

  get puedeConfirmar(): boolean {
    return !this.combinado || this.filas.every((_, i) => this.montoFila(i) > 0);
  }

  get totalFinal(): number {
    return this.baseConDescuento + this.ajusteMedio;
  }

  get valorCuota(): number {
    return this.totalFinal / this.cuotas;
  }

  /** Etiqueta del botón: "−10 %" / "+15 %" */
  badgeMedio(medio: string): string | null {
    const pct = this.planDe(medio)?.porcentaje ?? 0;
    return pct === 0 ? null : (pct > 0 ? '+' : '−') + Math.abs(pct) + ' %';
  }

  elegirMedio(medio: PaymentMethod): void {
    this.metodoPago = medio;
    this.cuotas = 1;
  }

  enviar(): void {
    if (this.combinado) {
      const pagos = this.filas.map((f, i) => ({
        medio: f.medio,
        cuotas: f.medio === 'TARJETA_CREDITO' ? f.cuotas : undefined,
        monto: this.montoFila(i),
      }));
      this.confirmar.emit({
        payment: pagos.reduce((a, b) => (b.monto > a.monto ? b : a)).medio,
        pagos,
        discount: this.descuento > 0 ? this.descuento : undefined,
        facturar: this.facturarAlVender && this.facturacionLista,
      });
      return;
    }
    this.confirmar.emit({
      payment: this.metodoPago,
      cuotas: this.metodoPago === 'TARJETA_CREDITO' ? this.cuotas : undefined,
      discount: this.descuento > 0 ? this.descuento : undefined,
      facturar: this.facturarAlVender && this.facturacionLista,
    });
  }
}
