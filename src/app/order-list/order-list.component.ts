// order-list.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { catchError, of } from 'rxjs';

import {
  OrderService,
  OrderListadoDTO,
  OrderResponse,
} from '../services/order.service';
import { CancelarOrdenComponent } from '../shared/cancelar-orden/cancelar-orden.component';
import { paymentLabel, statusClass, statusLabel } from '../utils/order-labels';
import { UserService } from '../services/user.service';
import { ErrorHandleService } from '../error/error-handle.service';

@Component({
  selector: 'app-order-list',
  standalone: true,
  templateUrl: './order-list.component.html',
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastModule,
    CancelarOrdenComponent,
  ],
})
export class OrderListComponent implements OnInit {
  // ─── Datos ────────────────────────────────────────────────────────────────
  ordenes: OrderListadoDTO[] = [];
  isLoading = true;
  totalElementos = 0;

  // ─── Filtros ──────────────────────────────────────────────────────────────
  statusFiltro = '';
  canalFiltro = '';
  page = 0;
  size = 15;

  // ─── Métricas ─────────────────────────────────────────────────────────────
  totalOrdenes = 0;
  completadas = 0;
  canceladas = 0;
  conDevolucion = 0;
  ventaTotal = 0;

  // ─── Modal detalle ────────────────────────────────────────────────────────
  ordenSeleccionada: OrderListadoDTO | null = null;
  mostrarDetalle = false;

  // ─── Inyecciones ──────────────────────────────────────────────────────────
  private orderService = inject(OrderService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  // Cancelar una venta es exclusivo de ADMIN (el backend responde 403 si no)
  readonly puedeCancelar = inject(UserService).isAdmin();
  // Venta a cancelar: abre el diálogo con motivo
  aCancelar: OrderListadoDTO | null = null;

  ngOnInit(): void {
    this.cargarOrdenes();
  }

  // ─── Carga ────────────────────────────────────────────────────────────────
  cargarOrdenes(): void {
    this.isLoading = true;
    this.orderService
      .listarAdmin(this.page, this.size)
      .pipe(
        catchError((err) => {
          this.message.add(
            this.errorService.toMessage(err, 'Error al cargar las órdenes')
          );
          return of({ content: [] as OrderListadoDTO[], totalElements: 0 });
        })
      )
      .subscribe((data) => {
        this.ordenes = data.content;
        this.totalElementos = data.totalElements;
        this.isLoading = false;
        this.calcularMetricas();
      });
  }

  calcularMetricas(): void {
    this.totalOrdenes = this.totalElementos;
    this.completadas = this.ordenes.filter(
      (o) => o.status === 'COMPLETADA'
    ).length;
    this.canceladas = this.ordenes.filter(
      (o) => o.status === 'CANCELADA'
    ).length;
    this.conDevolucion = this.ordenes.filter(
      (o) => o.status === 'DEVUELTA' || o.status === 'DEVUELTA_PARCIAL'
    ).length;
    this.ventaTotal = this.ordenes
      .filter((o) => o.status === 'COMPLETADA')
      .reduce((acc, o) => acc + (o.totalAmount ?? 0), 0);
  }

  // ─── Filtros ──────────────────────────────────────────────────────────────
  onFiltroChange(): void {
    this.page = 0;
    this.cargarOrdenes();
  }

  limpiarFiltros(): void {
    this.statusFiltro = '';
    this.canalFiltro = '';
    this.page = 0;
    this.cargarOrdenes();
  }

  get ordenesFiltradas(): OrderListadoDTO[] {
    return this.ordenes.filter((o) => {
      const matchStatus = !this.statusFiltro || o.status === this.statusFiltro;
      const matchCanal = !this.canalFiltro || o.canal === this.canalFiltro;
      return matchStatus && matchCanal;
    });
  }

  // ─── Paginación ───────────────────────────────────────────────────────────
  get totalPaginas(): number {
    return Math.ceil(this.totalElementos / this.size);
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.page;
    const inicio = Math.max(0, actual - 2);
    const fin = Math.min(total - 1, inicio + 4);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  }

  irPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas) return;
    this.page = p;
    this.cargarOrdenes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  verDetalle(orden: OrderListadoDTO): void {
    this.ordenSeleccionada = orden;
    this.mostrarDetalle = true;
  }

  /** Se canceló desde el diálogo: actualizar fila y métricas */
  onCancelada(actualizada: OrderResponse): void {
    const fila = this.ordenes.find((o) => o.idOrder === actualizada.idOrder);
    if (fila) fila.status = actualizada.status;
    this.calcularMetricas();
  }

  puedeDevolver(o: OrderListadoDTO): boolean {
    return o.status === 'COMPLETADA' || o.status === 'DEVUELTA_PARCIAL';
  }

  /** Nombre a mostrar: objeto cliente > campo plano > fallback */
  nombreCliente(o: OrderListadoDTO): string {
    return o.cliente?.name ?? 'Mostrador';
  }

  getStatusClass(status: string): string {
    return statusClass(status);
  }

  getStatusLabel(status: string): string {
    return statusLabel(status);
  }

  getCanalLabel(canal: string): string {
    return canal === 'ADMIN' ? 'Mostrador' : 'Online';
  }

  getPaymentLabel(payment: string): string {
    return paymentLabel(payment);
  }

  formatFecha(fecha: string): string {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  showError(msg: string): void {
    this.message.add({
      severity: 'error',
      summary: 'Error',
      detail: msg,
      life: 4000,
    });
  }

  showSuccess(msg: string): void {
    this.message.add({
      severity: 'success',
      summary: 'Éxito',
      detail: msg,
      life: 3000,
    });
  }
}
