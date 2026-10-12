// devoluciones-list.component.ts — historial de devoluciones y cambios
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { finalize } from 'rxjs';
import {
  DevolucionResponse,
  DevolucionService,
} from '../services/devolucion.service';
import { ErrorHandleService } from '../error/error-handle.service';
import { formaReintegroLabel } from '../utils/order-labels';

@Component({
  selector: 'app-devoluciones-list',
  standalone: true,
  templateUrl: './devoluciones-list.component.html',
  imports: [CommonModule, RouterModule, ToastModule],
})
export class DevolucionesListComponent implements OnInit {
  private devolucionService = inject(DevolucionService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  readonly formaReintegroLabel = formaReintegroLabel;

  devoluciones: DevolucionResponse[] = [];
  isLoading = true;
  page = 0;
  readonly size = 20;
  totalPages = 0;
  totalElements = 0;
  seleccionada: DevolucionResponse | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoading = true;
    this.devolucionService
      .listar(this.page, this.size)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (p) => {
          this.devoluciones = p.content;
          this.totalPages = p.totalPages;
          this.totalElements = p.totalElements;
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  irPagina(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.page = p;
    this.cargar();
  }

  /** Dinero que salió de caja en esta página (reintegros) */
  get totalReintegrado(): number {
    return this.devoluciones
      .filter((d) => d.diferencia < 0)
      .reduce((acc, d) => acc - d.diferencia, 0);
  }

  get cantidadCambios(): number {
    return this.devoluciones.filter((d) => d.tipo === 'CAMBIO').length;
  }

  resumenItems(d: DevolucionResponse): string {
    return d.items.map((i) => `${i.quantity}× ${i.productoNombre}`).join(', ');
  }
}
