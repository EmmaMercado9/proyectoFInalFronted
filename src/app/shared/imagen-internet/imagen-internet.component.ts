import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';

import { ProductService } from '../../services/products.service';
import { ErrorHandleService } from '../../error/error-handle.service';

/** Buscar una foto en internet y traerla al formulario pegando el link o la imagen copiada. */
@Component({
  selector: 'app-imagen-internet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col sm:flex-row gap-2 mt-3">
      <button
        type="button"
        (click)="buscar()"
        class="px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-semibold hover:bg-gray-50 whitespace-nowrap"
      >
        <i class="pi pi-search text-xs mr-1"></i> Buscar en internet
      </button>
      <input
        type="text"
        [(ngModel)]="link"
        [ngModelOptions]="{ standalone: true }"
        (paste)="pegar($event)"
        (keydown.enter)="$event.preventDefault(); traer()"
        placeholder="Pegá acá la imagen copiada o su link"
        autocomplete="off"
        class="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black placeholder:text-gray-300"
      />
      <button
        type="button"
        (click)="traer()"
        [disabled]="!link.trim() || cargando"
        class="px-3 py-2 bg-black text-white rounded-xl text-xs font-semibold disabled:opacity-40"
      >
        @if (cargando) {
          <i class="pi pi-spin pi-spinner text-xs"></i>
        } @else {
          Agregar
        }
      </button>
    </div>
  `,
})
export class ImagenInternetComponent {
  /** Qué se busca: normalmente marca y nombre del producto */
  @Input() consulta = '';
  @Output() imagen = new EventEmitter<File>();

  private productos = inject(ProductService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  link = '';
  cargando = false;

  buscar(): void {
    const q = encodeURIComponent(this.consulta.trim() || 'zapatillas');
    window.open(`https://www.google.com/search?tbm=isch&q=${q}`, '_blank', 'noopener');
  }

  /** "Copiar imagen" en el navegador llega como archivo, sin pasar por el servidor */
  pegar(evento: ClipboardEvent): void {
    const archivo = Array.from(evento.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (!archivo) return;
    evento.preventDefault();
    this.imagen.emit(new File([archivo], `internet-${Date.now()}.${archivo.type.split('/')[1]}`, { type: archivo.type }));
  }

  traer(): void {
    const url = this.link.trim();
    if (!url || this.cargando) return;
    this.cargando = true;
    this.productos
      .imagenDesdeUrl(url)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: ({ tipo, base64 }) => {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          this.imagen.emit(new File([bytes], `internet-${Date.now()}.${tipo.split('/')[1]}`, { type: tipo }));
          this.link = '';
        },
        error: (err) => this.message.add(this.errorService.toMessage(err, 'No se pudo traer la imagen')),
      });
  }
}
