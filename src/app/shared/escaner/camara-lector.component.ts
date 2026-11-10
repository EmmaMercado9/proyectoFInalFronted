import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';

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
      <button type="button" (click)="detener(); cancelada.emit()" class="mt-2 w-full py-3 border border-gray-200 bg-white text-sm font-semibold rounded-xl">
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
export class CamaraLectorComponent implements OnInit, OnDestroy {
  /** true: sigue leyendo después de cada código (para cargar varios productos) */
  @Input() continuo = false;
  /** Abre la cámara apenas aparece (sin tocar el botón grande) */
  @Input() autoIniciar = false;
  @Output() codigo = new EventEmitter<string>();
  @Output() abrir = new EventEmitter<void>();
  @Output() cancelada = new EventEmitter<void>();

  @ViewChild('video') video?: ElementRef<HTMLVideoElement>;

  activa = false;
  error = '';

  private controles: { stop(): void } | null = null;
  private stream: MediaStream | null = null;
  private destruido = false;
  private ultimo = { codigo: '', momento: 0 };

  ngOnInit(): void {
    if (this.autoIniciar) this.iniciar();
  }

  ngOnDestroy(): void {
    this.destruido = true;
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
      // La cámara se pide acá (y no dentro del lector) para poder apagarla siempre al salir
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      if (this.cancelado()) return;
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (this.cancelado()) return;
      this.controles = await new BrowserMultiFormatReader().decodeFromStream(
        this.stream,
        this.video!.nativeElement,
        (resultado) => {
          if (resultado) this.leido(resultado.getText());
        }
      );
      this.cancelado();
    } catch {
      this.detener();
      if (!this.destruido) this.error = 'No se pudo abrir la cámara. Revisá el permiso en el navegador.';
    }
  }

  detener(): void {
    this.controles?.stop();
    this.controles = null;
    // Apagar la cámara ya: si queda prendida, la próxima pantalla no la puede abrir
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.nativeElement.srcObject = null;
    this.activa = false;
  }

  /** Si mientras se abría la cámara se salió de la pantalla o se cerró, se apaga */
  private cancelado(): boolean {
    if (this.destruido || !this.activa) {
      this.detener();
      return true;
    }
    return false;
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
