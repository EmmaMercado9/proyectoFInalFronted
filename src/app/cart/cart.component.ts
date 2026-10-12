import { apiErrorMessage } from '../error/error-handle.service';
// cart.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  catchError,
  of,
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
} from 'rxjs';

import { CartService, CartItem } from '../services/cart.service';
import { OrderService, OrderRequest } from '../services/order.service';
import { UserService } from '../services/user.service';
import { ClienteDTO, ClientService } from '../services/client.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  templateUrl: './cart.component.html',
  imports: [CommonModule, RouterModule, FormsModule, ToastModule],
})
export class CartComponent implements OnInit {
  items: CartItem[] = [];
  isLoading = false;

  // ─── Método de pago ──────────────────────────────────────────────────────
  metodoPago:
    | 'EFECTIVO'
    | 'TARJETA_DEBITO'
    | 'TARJETA_CREDITO'
    | 'TRANSFERENCIA'
    | 'MERCADOPAGO' = 'EFECTIVO';

  metodosPago = [
    { value: 'EFECTIVO', label: 'Efectivo', icon: 'pi-wallet' },
    { value: 'TARJETA_DEBITO', label: 'Débito', icon: 'pi-credit-card' },
    { value: 'TARJETA_CREDITO', label: 'Crédito', icon: 'pi-credit-card' },
    { value: 'TRANSFERENCIA', label: 'Transferencia', icon: 'pi-send' },
    { value: 'MERCADOPAGO', label: 'Mercado Pago', icon: 'pi-mobile' },
  ];

  // ─── Descuento ───────────────────────────────────────────────────────────
  descuento = 0;

  // ─── Cliente ─────────────────────────────────────────────────────────────
  clienteSeleccionado: ClienteDTO | null = null;
  clienteBusqueda = '';
  clienteResultados: ClienteDTO[] = [];
  clienteBuscando = false;
  mostrarClienteResultados = false;

  mostrarNuevoCliente = false;
  guardandoCliente = false;
  nuevoCliente = { name: '', username: '', dni: '', mail: '' };

  private busqueda$ = new Subject<string>();

  // ─── Inyecciones ─────────────────────────────────────────────────────────
  private cartService = inject(CartService);
  private orderService = inject(OrderService);
  private userService = inject(UserService);
  private clientService = inject(ClientService);
  private router = inject(Router);
  private message = inject(MessageService);

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cartService.items$.subscribe((items) => (this.items = items));

    this.busqueda$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim()) {
            this.clienteResultados = [];
            this.mostrarClienteResultados = false;
            this.clienteBuscando = false;
            return of([]);
          }
          this.clienteBuscando = true;
          return this.clientService.buscar(q).pipe(catchError(() => of([])));
        })
      )
      .subscribe((res: ClienteDTO[]) => {
        this.clienteResultados = res;
        this.clienteBuscando = false;
        this.mostrarClienteResultados = true;
      });
  }

  // ─── Getters ─────────────────────────────────────────────────────────────
  get subtotal(): number {
    return this.cartService.total;
  }
  get cantidadTotal(): number {
    return this.cartService.cantidadTotal;
  }
  get estaVacio(): boolean {
    return this.items.length === 0;
  }
  get totalFinal(): number {
    return Math.max(0, this.subtotal - this.descuento);
  }

  // ─── Items ───────────────────────────────────────────────────────────────
  actualizarCantidad(variantId: number, cantidad: number): void {
    this.cartService.actualizarCantidad(variantId, cantidad);
  }
  eliminar(variantId: number): void {
    this.cartService.eliminar(variantId);
  }
  limpiarCarrito(): void {
    this.cartService.limpiar();
  }

  // ─── Cliente ─────────────────────────────────────────────────────────────
  onClienteBusqueda(): void {
    this.busqueda$.next(this.clienteBusqueda);
  }

  seleccionarCliente(c: ClienteDTO): void {
    this.clienteSeleccionado = c;
    this.clienteBusqueda = '';
    this.clienteResultados = [];
    this.mostrarClienteResultados = false;
  }

  limpiarCliente(): void {
    this.clienteSeleccionado = null;
    this.clienteBusqueda = '';
  }

  cerrarClienteResultados(): void {
    setTimeout(() => (this.mostrarClienteResultados = false), 200);
  }

  inicial(nombre: string): string {
    return nombre?.charAt(0).toUpperCase() ?? '?';
  }

  abrirNuevoCliente(): void {
    this.nuevoCliente = {
      name: this.clienteBusqueda,
      username: '',
      dni: '',
      mail: '',
    };
    this.mostrarNuevoCliente = true;
    this.mostrarClienteResultados = false;
  }

  cancelarNuevoCliente(): void {
    this.mostrarNuevoCliente = false;
    this.nuevoCliente = { name: '', username: '', dni: '', mail: '' };
  }

  crearCliente(): void {
    if (!this.nuevoCliente.name.trim()) return;
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
          });
          return of(null);
        })
      )
      .subscribe((c) => {
        this.guardandoCliente = false;
        if (!c) return;
        this.mostrarNuevoCliente = false;
        this.seleccionarCliente(c);
        this.message.add({
          severity: 'success',
          summary: 'Cliente creado',
          detail: c.name,
        });
      });
  }

  // ─── Confirmar compra ────────────────────────────────────────────────────
  confirmarCompra(): void {
    if (this.estaVacio) return;
    this.isLoading = true;

    // El carrito vive dentro del panel: ADMIN y COLABORADOR venden por el
    // canal ADMIN. /api/tienda/orders queda reservado al rol CLIENTE.
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

    const request$ = this.orderService.crearOrdenAdmin(dto);

    request$
      .pipe(
        catchError((err) => {
          this.isLoading = false;
          const msg =
            apiErrorMessage(err, 'Error al procesar la compra');
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
        this.isLoading = false;
        this.cartService.limpiar();
        this.router.navigate(['admin/comprobante', orden.trackingId]);
      });
  }
}
