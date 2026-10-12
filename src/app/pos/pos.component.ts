import { apiErrorMessage } from '../error/error-handle.service';
// pos.component.ts — Punto de Venta CLOUFIT
import { environment } from '../../environments/environment';
import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  catchError,
  of,
  Subject,
  debounceTime,
  distinctUntilChanged,
} from 'rxjs';

import { ProductService } from '../services/products.service';
import { OrderService, OrderRequest } from '../services/order.service';
import { UserService } from '../services/user.service';
import { ClientService, ClienteDTO } from '../services/client.service';

// ─── Interfaces locales ───────────────────────────────────────────────────

export interface PosItem {
  variantId: number;
  sku: string;
  productoNombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  imagenUrl?: string;
  stockDisponible: number;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  templateUrl: './pos.component.html',
  imports: [CommonModule, FormsModule, RouterModule, ToastModule],
})
export class PosComponent implements OnInit, OnDestroy {
  @ViewChild('buscarInput') buscarInput!: ElementRef;

  // ─── Búsqueda producto ──────────────────────────────────────────────────
  busqueda = '';
  resultados: any[] = [];
  buscando = false;
  mostrarResultados = false;

  // ─── Variante selector ──────────────────────────────────────────────────
  productoSeleccionado: any = null;
  mostrarVariantes = false;

  // ─── Carrito ────────────────────────────────────────────────────────────
  items: PosItem[] = [];

  // ─── Cliente ────────────────────────────────────────────────────────────
  clienteBusqueda = '';
  clienteResultados: ClienteDTO[] = [];
  clienteBuscando = false;
  mostrarClienteResultados = false;
  clienteSeleccionado: ClienteDTO | null = null;

  // ─── Modal nuevo cliente ────────────────────────────────────────────────
  mostrarNuevoCliente = false;
  guardandoCliente = false;
  nuevoCliente: ClienteDTO = { name: '', username: '', mail: '', dni: '' };

  // ─── Checkout ───────────────────────────────────────────────────────────
  metodoPago:
    | 'EFECTIVO'
    | 'TARJETA_DEBITO'
    | 'TARJETA_CREDITO'
    | 'TRANSFERENCIA'
    | 'MERCADOPAGO' = 'EFECTIVO';
  descuento = 0;
  procesando = false;

  metodosPago: {
    value:
      | 'EFECTIVO'
      | 'TARJETA_DEBITO'
      | 'TARJETA_CREDITO'
      | 'TRANSFERENCIA'
      | 'MERCADOPAGO';
    label: string;
    icon: string;
  }[] = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: 'pi-wallet' },
    { value: 'TARJETA_DEBITO', label: 'Débito', icon: 'pi-credit-card' },
    { value: 'TARJETA_CREDITO', label: 'Crédito', icon: 'pi-credit-card' },
    { value: 'TRANSFERENCIA', label: 'Transfer.', icon: 'pi-send' },
    { value: 'MERCADOPAGO', label: 'MP', icon: 'pi-mobile' },
  ];

  // ─── Escáner código de barras ───────────────────────────────────────────
  private codigoBarras = '';
  private ultimaTecla = 0;
  private readonly VEL_SCANNER = 50;

  // ─── Debounces ──────────────────────────────────────────────────────────
  private searchSubject = new Subject<string>();
  private clienteSubject = new Subject<string>();
  private subs: any[] = [];

  // ─── Inyecciones ────────────────────────────────────────────────────────
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private clientService = inject(ClientService);
  private router = inject(Router);
  private message = inject(MessageService);

  private readonly API = `${environment.apiUrl}/api`;

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.subs.push(
      this.searchSubject
        .pipe(debounceTime(350), distinctUntilChanged())
        .subscribe((q) => this.buscarProductos(q))
    );

    this.subs.push(
      this.clienteSubject
        .pipe(debounceTime(350), distinctUntilChanged())
        .subscribe((q) => this.buscarClientes(q))
    );

  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  // ─── Escáner ────────────────────────────────────────────────────────────

  // HostListener se registra y se libera solo con el componente
  // (antes el listener manual nunca se removía y se duplicaba en cada visita)
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const enInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);

    const ahora = Date.now();
    const delta = ahora - this.ultimaTecla;
    this.ultimaTecla = ahora;

    if (event.key === 'Enter') {
      if (this.codigoBarras.length >= 4 && delta < this.VEL_SCANNER * 3) {
        this.buscarPorCodigoBarra(this.codigoBarras);
      }
      this.codigoBarras = '';
      return;
    }

    if (delta < this.VEL_SCANNER && event.key.length === 1) {
      this.codigoBarras += event.key;
    } else if (!enInput) {
      this.codigoBarras = event.key.length === 1 ? event.key : '';
    }
  }

  buscarPorCodigoBarra(codigo: string): void {
    this.productService
      .buscarPorBarcode(codigo)
      .pipe(
        catchError(() =>
          this.productService
            .listar({ nombre: codigo, status: 'ACTIVO', size: 5 })
            .pipe(catchError(() => of({ content: [], totalElements: 0 })))
        )
      )
      .subscribe((data: any) => {
        if (data.tipo === 'VARIANTE') {
          const v = data.variante;
          const p = data.producto;
          const imgs = v.imageModelSetDto ?? v.imagenes ?? [];
          this.agregarItem({
            variantId: v.variantId,
            sku: v.sku,
            productoNombre: p.nameProduct,
            descripcion: v.descripcion ?? v.sku,
            precio: v.precioVenta ?? p.precioVenta,
            cantidad: 1,
            imagenUrl: imgs[0]?.url,
            stockDisponible: v.stock,
          });
          this.message.add({
            severity: 'success',
            summary: '¡Agregado!',
            detail: `${p.nameProduct} — ${v.descripcion}`,
            life: 1500,
          });
          return;
        }

        if (data.tipo === 'PRODUCTO') {
          this.seleccionarProducto(data.producto);
          return;
        }

        if (data.content !== undefined) {
          if (data.content.length === 0) {
            this.message.add({
              severity: 'warn',
              summary: 'Sin resultado',
              detail: `No se encontró código ${codigo}`,
              life: 3000,
            });
          } else if (data.content.length === 1) {
            this.seleccionarProducto(data.content[0]);
          } else {
            this.busqueda = codigo;
            this.resultados = data.content;
            this.mostrarResultados = true;
          }
        }
      });
  }

  // ─── Búsqueda producto ──────────────────────────────────────────────────

  onBusqueda(): void {
    if (!this.busqueda.trim()) {
      this.resultados = [];
      this.mostrarResultados = false;
      return;
    }
    this.searchSubject.next(this.busqueda.trim());
  }

  buscarProductos(q: string): void {
    this.buscando = true;
    this.productService
      .listar({ nombre: q, status: 'ACTIVO', size: 8 })
      .pipe(catchError(() => of({ content: [], totalElements: 0 })))
      .subscribe((data: any) => {
        this.resultados = data.content;
        this.mostrarResultados = true;
        this.buscando = false;
      });
  }

  seleccionarProducto(p: any): void {
    this.busqueda = '';
    this.mostrarResultados = false;

    this.productService
      .getById(p.idProduct ?? p.id)
      .pipe(catchError(() => of(null)))
      .subscribe((producto) => {
        if (!producto) return;

        if (!producto.tieneVariantes) {
          const vDefault = producto.variantes?.find((v: any) => v.esDefault);
          if (vDefault) {
            this.agregarItem({
              variantId: vDefault.variantId,
              sku: vDefault.sku,
              productoNombre: producto.nameProduct,
              descripcion: 'Único',
              precio: vDefault.precioVenta ?? producto.precioVenta,
              cantidad: 1,
              imagenUrl: producto.imageModelSetDto?.[0]?.url,
              stockDisponible: vDefault.stock,
            });
          }
        } else {
          this.productoSeleccionado = producto;
          this.mostrarVariantes = true;
        }
      });
  }

  seleccionarVariante(v: any): void {
    const imgs = v.imageModelSetDto ?? v.imagenes ?? [];
    this.agregarItem({
      variantId: v.variantId,
      sku: v.sku,
      productoNombre: this.productoSeleccionado.nameProduct,
      descripcion: v.descripcion ?? v.sku,
      precio: v.precioVenta ?? this.productoSeleccionado.precioVenta,
      cantidad: 1,
      imagenUrl: imgs[0]?.url,
      stockDisponible: v.stock,
    });
    this.mostrarVariantes = false;
    this.productoSeleccionado = null;
    setTimeout(() => this.buscarInput?.nativeElement?.focus(), 100);
  }

  // ─── Carrito ────────────────────────────────────────────────────────────

  agregarItem(item: PosItem): void {
    const existente = this.items.find((i) => i.variantId === item.variantId);
    if (existente) {
      if (existente.cantidad < existente.stockDisponible) {
        existente.cantidad++;
      } else {
        this.message.add({
          severity: 'warn',
          summary: 'Stock',
          detail: 'No hay más stock disponible',
          life: 2000,
        });
      }
    } else {
      if (item.stockDisponible === 0) {
        this.message.add({
          severity: 'warn',
          summary: 'Sin stock',
          detail: `${item.productoNombre} no tiene stock`,
          life: 2000,
        });
        return;
      }
      this.items.push({ ...item });
    }
    setTimeout(() => this.buscarInput?.nativeElement?.focus(), 100);
  }

  cambiarCantidad(variantId: number, delta: number): void {
    const item = this.items.find((i) => i.variantId === variantId);
    if (!item) return;
    const nueva = item.cantidad + delta;
    if (nueva <= 0) {
      this.eliminarItem(variantId);
    } else if (nueva <= item.stockDisponible) {
      item.cantidad = nueva;
    }
  }

  eliminarItem(variantId: number): void {
    this.items = this.items.filter((i) => i.variantId !== variantId);
  }

  limpiarCarrito(): void {
    this.items = [];
    this.descuento = 0;
    setTimeout(() => this.buscarInput?.nativeElement?.focus(), 100);
  }

  // ─── Totales ────────────────────────────────────────────────────────────

  get subtotal(): number {
    return this.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  }

  get totalFinal(): number {
    return Math.max(0, this.subtotal - this.descuento);
  }

  get cantidadItems(): number {
    return this.items.reduce((acc, i) => acc + i.cantidad, 0);
  }

  // ─── Cliente ────────────────────────────────────────────────────────────

  onClienteBusqueda(): void {
    if (!this.clienteBusqueda.trim()) {
      this.clienteResultados = [];
      this.mostrarClienteResultados = false;
      return;
    }
    this.clienteSubject.next(this.clienteBusqueda.trim());
  }

  buscarClientes(q: string): void {
    this.clienteBuscando = true;
    this.clientService
      .buscar(q)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        this.clienteResultados = data;
        this.mostrarClienteResultados = true;
        this.clienteBuscando = false;
      });
  }

  seleccionarCliente(c: ClienteDTO): void {
    this.clienteSeleccionado = c;
    this.clienteBusqueda = c.name;
    this.mostrarClienteResultados = false;
  }

  limpiarCliente(): void {
    this.clienteSeleccionado = null;
    this.clienteBusqueda = '';
    this.mostrarClienteResultados = false;
  }

  cerrarClienteResultados(): void {
    setTimeout(() => {
      this.mostrarClienteResultados = false;
    }, 200);
  }

  // ─── Modal nuevo cliente ────────────────────────────────────────────────

  abrirNuevoCliente(): void {
    this.nuevoCliente = {
      name: this.clienteBusqueda,
      username: '',
      mail: '',
      dni: '',
    };
    this.mostrarClienteResultados = false;
    this.mostrarNuevoCliente = true;
  }

  cancelarNuevoCliente(): void {
    this.mostrarNuevoCliente = false;
    this.nuevoCliente = { name: '', username: '', mail: '', dni: '' };
  }

  crearCliente(): void {
    if (!this.nuevoCliente.name.trim()) {
      this.message.add({
        severity: 'warn',
        summary: 'Requerido',
        detail: 'El nombre es obligatorio',
        life: 3000,
      });
      return;
    }

    this.guardandoCliente = true;
    this.clientService
      .crear(this.nuevoCliente)
      .pipe(
        catchError((err) => {
          this.guardandoCliente = false;
          this.message.add({
            severity: 'error',
            summary: 'Error',
            detail: apiErrorMessage(err, 'No se pudo crear el cliente'),
            life: 4000,
          });
          return of(null);
        })
      )
      .subscribe((cliente) => {
        if (!cliente) return;
        this.guardandoCliente = false;
        this.mostrarNuevoCliente = false;
        this.seleccionarCliente(cliente);
        this.nuevoCliente = { name: '', username: '', mail: '', dni: '' };
        this.message.add({
          severity: 'success',
          summary: 'Cliente creado',
          detail: `${cliente.name} fue agregado`,
          life: 2500,
        });
      });
  }

  // ─── Confirmar venta ────────────────────────────────────────────────────

  confirmarVenta(): void {
    if (this.items.length === 0) return;
    this.procesando = true;

    const dto: OrderRequest = {
      userId: this.userService.getUserId() ?? undefined,
      clienteId: this.clienteSeleccionado?.idClient ?? undefined,
      payment: this.metodoPago,
      discount: this.descuento > 0 ? this.descuento : undefined,
      items: this.items.map((i) => ({
        variantId: i.variantId,
        quantity: i.cantidad,
      })),
    };

    this.orderService
      .crearOrdenAdmin(dto)
      .pipe(
        catchError((err) => {
          this.procesando = false;
          const msg =
            apiErrorMessage(err, 'Error al procesar la venta');
          this.message.add({
            severity: 'error',
            summary: 'Error',
            detail: msg,
            life: 5000,
          });
          return of(null);
        })
      )
      .subscribe((orden) => {
        if (!orden) return;
        this.procesando = false;
        this.limpiarCarrito();
        this.limpiarCliente();
        this.router.navigate(['/admin/comprobante', orden.trackingId]);
      });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  cerrarResultados(): void {
    setTimeout(() => {
      this.mostrarResultados = false;
    }, 200);
  }

  getVariantesActivas(): any[] {
    return (this.productoSeleccionado?.variantes ?? []).filter(
      (v: any) => !v.esDefault && v.status !== 'INACTIVO'
    );
  }

  getAtributos(v: any): string {
    if (!v.atributos) return v.descripcion ?? v.sku;
    return Object.entries(v.atributos)
      .map(([k, val]) => `${k}: ${val}`)
      .join(' / ');
  }

  inicial(nombre: string): string {
    return nombre?.charAt(0)?.toUpperCase() ?? '?';
  }
}
