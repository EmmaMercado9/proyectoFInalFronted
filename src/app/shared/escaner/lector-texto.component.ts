import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

/**
 * Lee texto impreso (nombre, SKU de la etiqueta) con la cámara: se saca una foto,
 * se reconocen las líneas escritas y se elige cuál usar.
 */
@Component({
  selector: 'app-lector-texto',
  standalone: true,
  template: `
    @if (lineas === null) {
      <div class="relative rounded-2xl overflow-hidden bg-black">
        <video #video class="w-full aspect-[4/3] object-cover" muted playsinline autoplay></video>
        <div class="absolute inset-x-6 top-1/2 -translate-y-1/2 h-1/3 border-2 border-white/80 rounded-xl"></div>
        @if (leyendo) {
          <div class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-sm gap-2">
            <i class="pi pi-spin pi-spinner text-xl"></i> Leyendo el texto...
          </div>
        }
      </div>
      <p class="text-[11px] text-gray-400 mt-1.5">Encuadrá el texto dentro del recuadro, con buena luz.</p>
      <div class="flex gap-2 mt-2">
        <button type="button" (click)="cancelar()" class="flex-1 py-3 border border-gray-200 bg-white text-sm font-semibold rounded-xl">Cancelar</button>
        <button type="button" (click)="sacarFoto()" [disabled]="leyendo || !lista"
          class="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
          <i class="pi pi-camera"></i> Sacar foto
        </button>
      </div>
    } @else {
      <p class="text-xs font-semibold text-gray-600 mb-2">Tocá el texto que querés usar</p>
      <div class="max-h-64 overflow-y-auto space-y-1.5">
        @for (l of lineas; track $index) {
          <button type="button" (click)="texto.emit(l)"
            class="w-full text-left px-3 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-black hover:bg-gray-50 break-words">{{ l }}</button>
        } @empty {
          <p class="text-xs text-gray-400 py-4 text-center">No se reconoció texto. Probá de nuevo, más cerca y con buena luz.</p>
        }
      </div>
      <div class="flex gap-2 mt-3">
        <button type="button" (click)="cancelar()" class="flex-1 py-3 border border-gray-200 bg-white text-sm font-semibold rounded-xl">Cancelar</button>
        <button type="button" (click)="otraFoto()" class="flex-1 py-3 bg-black text-white text-sm font-bold rounded-xl">Otra foto</button>
      </div>
    }
    @if (error) {
      <p class="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">{{ error }}</p>
    }
  `,
})
export class LectorTextoComponent implements OnInit, OnDestroy {
  @Output() texto = new EventEmitter<string>();
  @Output() cancelada = new EventEmitter<void>();

  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  lineas: string[] | null = null;
  leyendo = false;
  lista = false;
  error = '';

  private stream: MediaStream | null = null;

  ngOnInit(): void {
    this.abrirCamara();
  }

  ngOnDestroy(): void {
    this.cerrarCamara();
  }

  async abrirCamara(): Promise<void> {
    this.error = '';
    this.lista = false;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      this.error = 'La cámara solo funciona con una conexión segura (https).';
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      await new Promise((r) => setTimeout(r));
      const v = this.video!.nativeElement;
      v.srcObject = this.stream;
      await v.play();
      this.lista = true;
    } catch {
      this.error = 'No se pudo abrir la cámara. Revisá el permiso en el navegador.';
    }
  }

  async sacarFoto(): Promise<void> {
    const v = this.video?.nativeElement;
    if (!v || !v.videoWidth) return;
    this.leyendo = true;
    this.error = '';
    try {
      const recorte = this.recortar(v);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa');
      const { data } = await worker.recognize(recorte);
      await worker.terminate();
      this.lineas = data.text
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter((l) => l.replace(/[^\p{L}\p{N}]/gu, '').length >= 2);
      this.cerrarCamara();
    } catch {
      this.error = 'No se pudo leer el texto. Revisá la conexión a internet y probá de nuevo.';
    } finally {
      this.leyendo = false;
    }
  }

  otraFoto(): void {
    this.lineas = null;
    this.abrirCamara();
  }

  cancelar(): void {
    this.cerrarCamara();
    this.cancelada.emit();
  }

  /** Solo la franja del recuadro, en escala de grises: se lee mejor y más rápido */
  private recortar(v: HTMLVideoElement): HTMLCanvasElement {
    // El video se muestra recortado (object-cover 4:3): se calcula qué parte se ve
    const visibleAlto = Math.min(v.videoHeight, (v.videoWidth * 3) / 4);
    const visibleAncho = (visibleAlto * 4) / 3;
    const x0 = (v.videoWidth - visibleAncho) / 2;
    const y0 = (v.videoHeight - visibleAlto) / 2;
    const sx = x0 + visibleAncho * 0.05;
    const sw = visibleAncho * 0.9;
    const sy = y0 + visibleAlto / 3;
    const sh = visibleAlto / 3;
    const c = document.createElement('canvas');
    c.width = Math.round(sw);
    c.height = Math.round(sh);
    const ctx = c.getContext('2d')!;
    ctx.filter = 'grayscale(1) contrast(1.4)';
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  private cerrarCamara(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.lista = false;
  }
}
