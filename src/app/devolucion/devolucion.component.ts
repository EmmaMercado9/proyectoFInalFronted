// devolucion.component.ts — devolución o cambio de productos de una venta
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  EMPTY,
  Subject,
  Subscription,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
} from 'rxjs';

import {
  OrderDetailResponse,
  OrderResponse,
  OrderService,
  PaymentMethod,
} from '../services/order.service';
import {
  DevolucionResponse,
  DevolucionService,
  FormaReintegro,
  TipoDevolucion,
} from '../services/devolucion.service';
import { ProductService } from '../services/products.service';
import {
  ProductListadoDTO,
  ProductResponse,
  VarianteResponse,
} from '../model/product.model';
import { ErrorHandleService } from '../error/error-handle.service';
import {
  PAYMENT_METHODS,
  admiteDevolucion,
  formaReintegroLabel,
  paymentLabel,
  statusClass,
  statusLabel,
} from '../utils/order-labels';

interface LineaDevolucion {
  detalle: OrderDetailResponse;
  devolvible: number; // unidades que todavía se pueden devolver
  cantidad: number; // unidades elegidas para devolver
  reingresaStock: boolean; // false = fallado
}

interface ItemNuevo {
  variantId: number;
  nombre: string;
  variante: string;
  precio: number;
  stock: number;
  cantidad: number;
  imagenUrl?: string;
}

@Component({
  selector: 'app-devolucion',
  standalone: true,
  templateUrl: './devolucion.component.html',
  imports: [CommonModule, FormsModule, RouterModule, ToastModule],
})
export class DevolucionComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private orderService = inject(OrderService);
  private devolucionService = inject(DevolucionService);
  private productService = inject(ProductService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  readonly motivosRapidos = [
    'Talle incorrecto',
    'Producto fallado',
    'No le gustó',
    'Cambio de color',
  ];
  readonly metodosPago = PAYMENT_METHODS;
  readonly paymentLabel = paymentLabel;
  readonly statusLabel = statusLabel;
  readonly statusClass = statusClass;
  readonly formaReintegroLabel = formaReintegroLabel;

  // ─── Datos ──────────────────────────────────────────────────────────────
  orden: OrderResponse | null = null;
  historial: DevolucionResponse[] = [];
  isLoading = true;
  error = false;

  // ─── Formulario ─────────────────────────────────────────────────────────
  tipo: TipoDevolucion = 'DEVOLUCION';
  lineas: LineaDevolucion[] = [];
  motivo = '';
  formaReintegro: FormaReintegro = 'EFECTIVO';
  paymentDiferencia: PaymentMethod = 'EFECTIVO';
  enviando = false;
  resultado: DevolucionResponse | null = null;

  // ─── Productos nuevos (cambio) ──────────────────────────────────────────
  nuevos: ItemNuevo[] = [];
  busqueda = '';
  resultados: ProductListadoDTO[] = [];
  buscando = false;
  productoAbierto: ProductResponse | null = null;
  private busqueda$ = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.sub = this.busqueda$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (q.trim().length < 2) return of({ content: [] as ProductListadoDTO[] });
          this.buscando = true;
          return this.productService
            .listar({ nombre: q.trim(), status: 'ACTIVO', size: 8 })
            .pipe(
              catchError(() => of({ content: [] as ProductListadoDTO[] })),
              finalize(() => (this.buscando = false))
            );
        })
      )
      .subscribe((page) => (this.resultados = page.content));

    const trackingId = this.route.snapshot.paramMap.get('trackingId');
    if (!trackingId) {
      this.error = true;
      this.isLoading = false;
      return;
    }
    this.cargar(trackingId);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private cargar(trackingId: string): void {
    this.isLoading = true;
    this.orderService
      .getByTracking(trackingId)
      .pipe(
        catchError(() => {
          this.error = true;
          return EMPTY;
        }),
        finalize(() => (this.isLoading = false))
      )
      .subscribe((orden) => {
        this.orden = orden;
        this.formaReintegro = 'EFECTIVO';
        this.lineas = orden.details.map((d) => ({
          detalle: d,
          devolvible: d.quantity - (d.cantidadDevuelta ?? 0),
          cantidad: 0,
          reingresaStock: true,
        }));
        this.devolucionService
          .porOrden(orden.idOrder)
          .pipe(catchError(() => of([])))
          .subscribe((h) => (this.historial = h));
      });
  }

  // ─── Estado de la venta ─────────────────────────────────────────────────

  get admite(): boolean {
    return !!this.orden && admiteDevolucion(this.orden);
  }

  /** Motivo por el que no se puede devolver, para mostrar al usuario */
  get bloqueo(): string | null {
    const o = this.orden;
    if (!o) return null;
    if (o.status === 'CANCELADA') return 'Esta venta está cancelada.';
    if (o.status === 'DEVUELTA') return 'Ya se devolvieron todos los productos de esta venta.';
    if (o.status !== 'COMPLETADA' && o.status !== 'DEVUELTA_PARCIAL')
      return 'Solo se pueden devolver productos de ventas completadas.';
    if (!this.admite) return 'Venció el plazo para devoluciones y cambios.';
    return null;
  }

  // ─── Ítems a devolver ───────────────────────────────────────────────────

  cambiarCantidad(l: LineaDevolucion, delta: number): void {
    l.cantidad = Math.min(l.devolvible, Math.max(0, l.cantidad + delta));
  }

  devolverTodo(): void {
    this.lineas.forEach((l) => (l.cantidad = l.devolvible));
  }

  get lineasElegidas(): LineaDevolucion[] {
    return this.lineas.filter((l) => l.cantidad > 0);
  }

  /** Proporción cobrada: aplica el descuento de la venta a cada ítem */
  private get factor(): number {
    const o = this.orden;
    return o && o.subtotal > 0 ? o.totalAmount / o.subtotal : 1;
  }

  montoLinea(l: LineaDevolucion): number {
    return Math.round(l.detalle.priceUnit * l.cantidad * this.factor * 100) / 100;
  }

  get montoDevuelto(): number {
    return this.lineasElegidas.reduce((acc, l) => acc + this.montoLinea(l), 0);
  }

  // ─── Productos nuevos (cambio) ──────────────────────────────────────────

  onBuscar(q: string): void {
    this.busqueda$.next(q);
  }

  abrirProducto(p: ProductListadoDTO): void {
    this.resultados = [];
    this.productService
      .getById(p.idProduct)
      .pipe(catchError((err) => {
        this.message.add(this.errorService.toMessage(err));
        return EMPTY;
      }))
      .subscribe((prod) => {
        const opciones = this.variantesDisponibles(prod);
        // Producto sin variantes: se agrega directo
        if (!prod.tieneVariantes && opciones.length === 1) {
          this.agregarNuevo(prod, opciones[0]);
          return;
        }
        this.productoAbierto = prod;
      });
  }

  variantesDisponibles(prod: ProductResponse): VarianteResponse[] {
    return (prod.variantes ?? []).filter(
      (v) => v.status === 'ACTIVO' && (prod.tieneVariantes ? !v.esDefault : v.esDefault)
    );
  }

  agregarNuevo(prod: ProductResponse, v: VarianteResponse): void {
    if (v.stock <= 0) {
      this.message.add({ severity: 'warn', summary: 'Sin stock', detail: `${prod.nameProduct} no tiene stock`, life: 3000 });
      return;
    }
    const existente = this.nuevos.find((n) => n.variantId === v.variantId);
    if (existente) {
      existente.cantidad = Math.min(existente.stock, existente.cantidad + 1);
    } else {
      const img =
        v.imageModelSetDto?.[0]?.url ?? prod.imageModelSetDto?.[0]?.url;
      this.nuevos.push({
        variantId: v.variantId,
        nombre: prod.nameProduct,
        variante: prod.tieneVariantes ? v.descripcion : '',
        precio: v.precioVenta,
        stock: v.stock,
        cantidad: 1,
        imagenUrl: img,
      });
    }
    this.productoAbierto = null;
    this.busqueda = '';
    this.resultados = [];
  }

  cambiarCantidadNuevo(n: ItemNuevo, delta: number): void {
    n.cantidad = Math.min(n.stock, n.cantidad + delta);
    if (n.cantidad <= 0) this.nuevos = this.nuevos.filter((x) => x !== n);
  }

  get montoNuevos(): number {
    return this.nuevos.reduce((acc, n) => acc + n.precio * n.cantidad, 0);
  }

  /** > 0 paga el cliente · < 0 se le reintegra */
  get diferencia(): number {
    const nuevos = this.tipo === 'CAMBIO' ? this.montoNuevos : 0;
    return Math.round((nuevos - this.montoDevuelto) * 100) / 100;
  }

  get abs(): number {
    return Math.abs(this.diferencia);
  }

  // ─── Confirmar ──────────────────────────────────────────────────────────

  get puedeConfirmar(): boolean {
    return (
      this.admite &&
      !this.enviando &&
      this.lineasElegidas.length > 0 &&
      (this.tipo === 'DEVOLUCION' || this.nuevos.length > 0)
    );
  }

  confirmar(): void {
    const orden = this.orden;
    if (!orden || !this.puedeConfirmar) return;

    this.enviando = true;
    this.devolucionService
      .registrar(orden.idOrder, {
        tipo: this.tipo,
        motivo: this.motivo.trim() || undefined,
        formaReintegro: this.diferencia < 0 ? this.formaReintegro : undefined,
        paymentDiferencia:
          this.tipo === 'CAMBIO' && this.diferencia > 0 ? this.paymentDiferencia : undefined,
        items: this.lineasElegidas.map((l) => ({
          idDetail: l.detalle.idDetail,
          quantity: l.cantidad,
          reingresaStock: l.reingresaStock,
        })),
        itemsNuevos:
          this.tipo === 'CAMBIO'
            ? this.nuevos.map((n) => ({ variantId: n.variantId, quantity: n.cantidad }))
            : [],
      })
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (res) => {
          this.resultado = res;
          this.message.add({
            severity: 'success',
            summary: res.tipo === 'CAMBIO' ? 'Cambio registrado' : 'Devolución registrada',
            detail: `Venta #${res.idOrder}`,
            life: 4000,
          });
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  imprimir(): void {
    window.print();
  }
}
