import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

/** El lector de texto tarda en cargar: se arma una vez y se reusa en las fotos siguientes */
let lectorCompartido: Promise<any> | null = null;

function lector(): Promise<any> {
  lectorCompartido ??= import('tesseract.js')
    .then((modulo: any) => {
      // tesseract.js es CommonJS: según cómo se empaquete, las funciones quedan en "default"
      const createWorker = modulo.createWorker ?? modulo.default?.createWorker;
      return createWorker(['spa', 'eng']);
    })
    .catch((e) => {
      lectorCompartido = null; // se reintenta en la próxima foto
      throw e;
    });
  return lectorCompartido;
}

/** Seguridad (0-100) con que el lector reconoce cada palabra: lo dudoso suele ser fondo o manchas */
const CONFIANZA_ALTA = 80;
const CONFIANZA_MINIMA = 25;

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
        <div class="absolute border-2 border-white rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
          [style.left.%]="MARGEN * 100" [style.right.%]="MARGEN * 100"
          [style.top.%]="(1 - alto) * 50" [style.height.%]="alto * 100"></div>
        @if (leyendo) {
          <div class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-sm gap-2">
            <i class="pi pi-spin pi-spinner text-xl"></i> Leyendo el texto...
          </div>
        }
      </div>
      <p class="text-[11px] text-gray-400 mt-1.5">
        {{ sku ? 'Dejá solo el código dentro del recuadro.' : 'Dejá el nombre dentro del recuadro.' }}
        Acercate hasta que se vea nítido, con buena luz.
      </p>
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
            class="w-full text-left px-3 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-black hover:bg-gray-50 break-words"
            [class.font-mono]="sku">{{ l }}</button>
        } @empty {
          <p class="text-xs text-gray-400 py-4 text-center">No se leyó nada con claridad. Acercate más, con buena luz y sin reflejos.</p>
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
  /** Para SKU: solo letras, números y guiones, en mayúsculas */
  @Input() sku = false;
  @Output() texto = new EventEmitter<string>();
  @Output() cancelada = new EventEmitter<void>();

  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  /** Recuadro: margen a los costados y alto (fracciones de lo que se ve) */
  readonly MARGEN = 0.06;
  get alto(): number {
    return this.sku ? 0.2 : 0.28;
  }

  lineas: string[] | null = null;
  leyendo = false;
  lista = false;
  error = '';

  private stream: MediaStream | null = null;
  private destruido = false;

  ngOnInit(): void {
    this.abrirCamara();
    // Mientras se encuadra, el lector ya se va cargando
    lector().catch(() => undefined);
  }

  ngOnDestroy(): void {
    this.destruido = true;
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
      // Si se cerró mientras se abría, se apaga enseguida
      if (this.destruido) return this.cerrarCamara();
      await new Promise((r) => setTimeout(r));
      if (this.destruido) return this.cerrarCamara();
      const v = this.video!.nativeElement;
      v.srcObject = this.stream;
      await v.play();
      this.lista = true;
    } catch {
      this.cerrarCamara();
      if (!this.destruido) this.error = 'No se pudo abrir la cámara. Revisá el permiso en el navegador.';
    }
  }

  async sacarFoto(): Promise<void> {
    const v = this.video?.nativeElement;
    if (!v || !v.videoWidth) return;
    this.leyendo = true;
    this.error = '';
    try {
      const recorte = this.recortar(v);
      const worker = await lector();
      await worker.setParameters({
        tessedit_pageseg_mode: '6', // el recuadro es un solo bloque de texto: no lo parte en columnas
        tessedit_char_whitelist: this.sku ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./ ' : '',
      });
      const { data } = await worker.recognize(recorte);
      if (this.destruido) return;
      this.lineas = this.opciones(data.lines ?? []);
      this.cerrarCamara();
    } catch {
      this.error = 'No se pudo leer el texto. Revisá la conexión a internet y probá de nuevo.';
    } finally {
      this.leyendo = false;
    }
  }

  /**
   * Las líneas leídas, solo con las palabras reconocidas con seguridad.
   * Para SKU van primero los códigos sueltos (palabras con letras y números).
   */
  private opciones(lineasLeidas: { words?: { text: string; confidence: number }[] }[]): string[] {
    const limpias = lineasLeidas
      // Una línea vale si tiene al menos una palabra leída con mucha seguridad (las manchas no la tienen)
      .filter((l) => (l.words ?? []).some((w) => w.confidence >= CONFIANZA_ALTA))
      .map((l) =>
        (l.words ?? [])
          .filter((w) => w.confidence >= CONFIANZA_MINIMA)
          // pedacitos de 1 o 2 letras dudosos suelen ser ruido del fondo
          .filter((w) => w.text.trim().length > 2 || w.confidence >= CONFIANZA_ALTA)
          .map((w) => w.text.trim())
          .join(' ')
      )
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.replace(/[^\p{L}\p{N}]/gu, '').length >= 3);
    if (!this.sku) return [...new Set(limpias)];

    const enMayuscula = limpias.map((l) => l.toUpperCase());
    const codigos = enMayuscula
      .flatMap((l) => l.split(/[\s:]+/))
      .map((p) => p.replace(/^[A-Z]{1,4}\.(?=.*\d)/, '')) // "ART.IH7758" → "IH7758"
      .map((p) => p.replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, ''))
      .filter((p) => p.length >= 4 && /\d/.test(p));
    return [...new Set([...codigos, ...enMayuscula])];
  }

  otraFoto(): void {
    this.lineas = null;
    this.abrirCamara();
  }

  cancelar(): void {
    this.cerrarCamara();
    this.cancelada.emit();
  }

  /**
   * Solo lo que está dentro del recuadro, en gris y agrandado si hace falta:
   * el lector acierta más con letras grandes y sin el resto de la caja alrededor.
   */
  private recortar(v: HTMLVideoElement): HTMLCanvasElement {
    // El video se muestra recortado (object-cover 4:3): se calcula qué parte se ve
    const visibleAlto = Math.min(v.videoHeight, (v.videoWidth * 3) / 4);
    const visibleAncho = (visibleAlto * 4) / 3;
    const x0 = (v.videoWidth - visibleAncho) / 2;
    const y0 = (v.videoHeight - visibleAlto) / 2;
    const sx = x0 + visibleAncho * this.MARGEN;
    const sw = visibleAncho * (1 - 2 * this.MARGEN);
    const sy = y0 + visibleAlto * (1 - this.alto) / 2;
    const sh = visibleAlto * this.alto;
    const escala = Math.min(2.5, Math.max(1, 1800 / sw));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * escala);
    c.height = Math.round(sh * escala);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }

  private cerrarCamara(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.nativeElement.srcObject = null;
    this.lista = false;
  }
}
