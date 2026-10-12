import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';
import { OrderResponse, OrderService } from '../../services/order.service';
import { ErrorHandleService } from '../../error/error-handle.service';

const MOTIVOS = [
  'Error al cobrar',
  'Cobro duplicado',
  'El cliente se arrepintió',
  'Producto sin stock real',
];

/**
 * Diálogo para anular una venta completa (solo ADMIN). Pide un motivo,
 * llama a PATCH /cancelar y emite la orden actualizada.
 */
@Component({
  selector: 'app-cancelar-orden',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule],
  template: `
    <p-dialog
      header="Cancelar venta"
      [modal]="true"
      [visible]="!!orden"
      (visibleChange)="!$event && cerrar()"
      [style]="{ width: '28rem' }"
      [draggable]="false"
      [resizable]="false"
    >
      @if (orden) {
        <div class="space-y-4 pt-1">
          <div class="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
            La venta <b>#{{ orden.idOrder }}</b> por
            <b>\${{ orden.totalAmount | number: '1.0-0' }}</b> quedará anulada y
            todo el stock volverá al inventario. Esta acción no se puede deshacer.
          </div>

          <div>
            <p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Motivo
            </p>
            <div class="flex flex-wrap gap-1.5 mb-2">
              @for (m of motivos; track m) {
                <button
                  type="button"
                  (click)="motivo = m"
                  class="px-2.5 py-1 rounded-full text-xs border transition"
                  [class.bg-black]="motivo === m"
                  [class.text-white]="motivo === m"
                  [class.border-black]="motivo === m"
                  [class.border-gray-200]="motivo !== m"
                  [class.text-gray-600]="motivo !== m"
                >
                  {{ m }}
                </button>
              }
            </div>
            <textarea
              [(ngModel)]="motivo"
              rows="2"
              maxlength="255"
              placeholder="Describí el motivo (opcional)"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
            ></textarea>
          </div>

          <div class="flex gap-3 justify-end">
            <button
              type="button"
              (click)="cerrar()"
              class="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Volver
            </button>
            <button
              type="button"
              (click)="confirmar()"
              [disabled]="enviando"
              class="px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              @if (enviando) {
                <i class="pi pi-spin pi-spinner text-xs"></i>
              }
              Cancelar venta
            </button>
          </div>
        </div>
      }
    </p-dialog>
  `,
})
export class CancelarOrdenComponent {
  private orderService = inject(OrderService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  /** Orden a cancelar; null = diálogo cerrado */
  @Input() orden: { idOrder: number; totalAmount: number } | null = null;
  @Output() ordenChange = new EventEmitter<null>();
  @Output() cancelada = new EventEmitter<OrderResponse>();

  readonly motivos = MOTIVOS;
  motivo = '';
  enviando = false;

  cerrar(): void {
    this.motivo = '';
    this.ordenChange.emit(null);
  }

  confirmar(): void {
    if (!this.orden) return;
    const id = this.orden.idOrder;
    this.enviando = true;
    this.orderService
      .cancelar(id, this.motivo)
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: (orden) => {
          this.message.add({
            severity: 'success',
            summary: 'Venta cancelada',
            detail: `La venta #${id} fue anulada y el stock se repuso`,
            life: 4000,
          });
          this.cancelada.emit(orden);
          this.cerrar();
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }
}
