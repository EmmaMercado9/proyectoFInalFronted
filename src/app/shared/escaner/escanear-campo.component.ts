import { Component, Input, OnDestroy, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { EscanerService } from './escaner.service';
import { CamaraLectorComponent } from './camara-lector.component';

/**
 * Dos íconos chicos para poner dentro de un campo: leer el código con la
 * pistola o con la cámara y escribirlo en ese campo.
 * Va dentro de un contenedor "relative" junto al input (que deja lugar a la derecha).
 */
@Component({
  selector: 'app-escanear-campo',
  standalone: true,
  imports: [CamaraLectorComponent],
  template: `
    <div class="absolute inset-y-0 right-1 flex items-center gap-0.5">
      <button type="button" (click)="usarPistola()"
        [title]="esperando ? 'Escaneá ahora con la pistola (tocá para cancelar)' : 'Leer con la pistola'"
        class="w-6 h-6 flex items-center justify-center rounded-md transition"
        [class]="esperando ? 'bg-black text-white animate-pulse' : 'text-gray-400 hover:text-black hover:bg-gray-100'">
        <i class="pi pi-barcode text-[11px]"></i>
      </button>
      <button type="button" (click)="camara = true" title="Leer con la cámara"
        class="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-black hover:bg-gray-100 transition">
        <i class="pi pi-camera text-[11px]"></i>
      </button>
    </div>

    @if (camara) {
      <div class="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4" (click)="camara = false">
        <div class="w-full max-w-sm bg-white rounded-2xl p-3" (click)="$event.stopPropagation()">
          <p class="text-xs font-semibold text-gray-600 mb-2">Apuntá al código de barras</p>
          <app-camara-lector [autoIniciar]="true" (codigo)="poner($event)" (cancelada)="camara = false" />
        </div>
      </div>
    }
  `,
})
export class EscanearCampoComponent implements OnDestroy {
  @Input({ required: true }) control!: AbstractControl | null;

  private escaner = inject(EscanerService);
  private cancelar?: () => void;
  esperando = false;
  camara = false;

  usarPistola(): void {
    if (this.esperando) {
      this.detenerPistola();
      return;
    }
    this.esperando = true;
    this.cancelar = this.escaner.capturarUno((codigo) => {
      this.cancelar = undefined;
      this.esperando = false;
      this.poner(codigo);
    });
  }

  poner(codigo: string): void {
    this.camara = false;
    this.escaner.pitido(true);
    this.control?.setValue(codigo);
    this.control?.markAsDirty();
  }

  ngOnDestroy(): void {
    this.detenerPistola();
  }

  private detenerPistola(): void {
    this.cancelar?.();
    this.cancelar = undefined;
    this.esperando = false;
  }
}
