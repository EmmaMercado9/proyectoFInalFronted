import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { EscanerService } from './escaner.service';

/** Casilla "Lector de códigos": activa la lectura con pistola en esta pantalla */
@Component({
  selector: 'app-escaner-toggle',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    @let activo = escaner.estado$ | async;
    <label
      class="inline-flex items-center gap-2 whitespace-nowrap cursor-pointer select-none rounded-xl border px-3 py-1.5 text-xs transition"
      [class.border-black]="activo"
      [class.bg-black]="activo"
      [class.text-white]="activo"
      [class.border-gray-200]="!activo"
      [class.text-gray-600]="!activo"
      title="Tildalo para usar la pistola lectora: el código leído se busca solo, aunque el cursor esté en otro lado"
    >
      <input
        type="checkbox"
        class="accent-black"
        [checked]="activo"
        (change)="escaner.setActivo($any($event.target).checked)"
      />
      <i class="pi pi-barcode"></i>
      <span class="font-medium">Lector de códigos</span>
      @if (activo) {
        <span class="flex items-center gap-1 text-[10px] text-green-300">
          <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
          listo
        </span>
      }
    </label>
  `,
})
export class EscanerToggleComponent {
  readonly escaner = inject(EscanerService);
}
