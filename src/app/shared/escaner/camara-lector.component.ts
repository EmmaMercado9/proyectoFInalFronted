import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';

/** Lee códigos de barras con la cámara del dispositivo. */
@Component({
  selector: 'app-camara-lector',
  standalone: true,
  template: `
    @if (activa) {
      <div class="relative rounded-2xl overflow-hidden bg-black">
        <video #video class="w-full aspect-[4/3] object-cover" muted playsinline></video>
        <div class="absolute inset-x-8 top-1/2 h-0.5 bg-red-500"></div>
      </div>
      <button type="button" (click)="detener()" class="mt-2 w-full py-3 border border-gray-200 bg-white text-sm font-semibold rounded-xl">
        {{ continuo ? 'Cerrar cámara' : 'Cancelar' }}
      </button>
    } @else {
      <button type="button" (click)="iniciar()" class="w-full py-3.5 bg-black text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2">
        <i class="pi pi-camera"></i> Escanear con la cámara
      </button>
    }
    @if (error) {
      <p class="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">{{ error }}</p>
    }
  `,
})
export class CamaraLectorComponent implements OnDestroy {
  /** true: sigue leyendo después de cada código (para cargar varios productos) */
  @Input() continuo = false;
  @Output() codigo = new EventEmitter<string>();
  @Output() abrir = new EventEmitter<void>();

  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  activa = false;
  error = '';

  private controles: { stop(): void } | null = null;
  private ultimo = { codigo: '', momento: 0 };

  ngOnDestroy(): void {
    this.detener();
  }

  async iniciar(): Promise<void> {
    this.error = '';
    if (!window.isSecureContext || !navigator.mediaDevices) {
      this.error = 'La cámara solo funciona con una conexión segura (https).';
      return;
    }
    this.abrir.emit();
    this.activa = true;
    await new Promise((r) => setTimeout(r));
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      this.controles = await new BrowserMultiFormatReader().decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        this.video!.nativeElement,
        (resultado) => {
          if (resultado) this.leido(resultado.getText());
        }
      );
    } catch {
      this.activa = false;
      this.error = 'No se pudo abrir la cámara. Revisá el permiso en el navegador.';
    }
  }

  detener(): void {
    this.controles?.stop();
    this.controles = null;
    this.activa = false;
  }

  private leido(texto: string): void {
    if (!this.continuo) {
      this.detener();
      this.codigo.emit(texto);
      return;
    }
    // La cámara lee el mismo código muchas veces por segundo: se toma una vez
    const ahora = Date.now();
    if (texto === this.ultimo.codigo && ahora - this.ultimo.momento < 2500) return;
    this.ultimo = { codigo: texto, momento: ahora };
    this.codigo.emit(texto);
  }
}
