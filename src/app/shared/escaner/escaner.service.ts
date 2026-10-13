import { Injectable, NgZone, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

/**
 * Lector de códigos de barras (pistola USB o Bluetooth).
 *
 * Estas pistolas funcionan como un teclado: "escriben" el código muy rápido y
 * terminan con Enter (o Tab). Con el modo activado se distingue una lectura de
 * alguien tecleando por el tiempo entre teclas, y se emite el código leído
 * aunque el foco esté en cualquier campo. Si la lectura cayó dentro de un
 * campo de texto, se le quita ese texto para que no quede escrito ahí.
 *
 * El modo se recuerda en este equipo (localStorage) y es el mismo para el
 * punto de venta y el inventario.
 */
@Injectable({ providedIn: 'root' })
export class EscanerService implements OnDestroy {
  /** Máximo entre dos teclas de una lectura; una persona tarda bastante más */
  private static readonly MAX_ENTRE_TECLAS_MS = 50;
  private static readonly MIN_LARGO = 4;
  private static readonly CLAVE = 'escaner.activo';

  private readonly zone = inject(NgZone);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly activo$ = new BehaviorSubject<boolean>(this.leerPreferencia());
  private readonly codigos = new Subject<string>();

  private buffer = '';
  private ultimaTecla = 0;
  private escuchando = false;
  private audio?: AudioContext;

  /** Códigos leídos (solo mientras el modo está activo) */
  readonly codigos$: Observable<string> = this.codigos.asObservable();
  readonly estado$: Observable<boolean> = this.activo$.asObservable();

  constructor() {
    if (this.activo$.value) this.escuchar();
  }

  get activo(): boolean {
    return this.activo$.value;
  }

  setActivo(valor: boolean): void {
    this.activo$.next(valor);
    try {
      localStorage.setItem(EscanerService.CLAVE, valor ? '1' : '0');
    } catch {
      /* sin storage: dura hasta recargar */
    }
    if (valor) this.escuchar();
    else this.dejarDeEscuchar();
  }

  /** Pitido corto: agudo si se encontró, grave si no */
  pitido(ok: boolean): void {
    if (!this.navegador) return;
    try {
      this.audio ??= new AudioContext();
      const osc = this.audio.createOscillator();
      const vol = this.audio.createGain();
      osc.frequency.value = ok ? 1500 : 300;
      vol.gain.value = 0.08;
      osc.connect(vol).connect(this.audio.destination);
      osc.start();
      osc.stop(this.audio.currentTime + (ok ? 0.08 : 0.25));
    } catch {
      /* sin audio */
    }
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar();
  }

  // ─── Detección ──────────────────────────────────────────────────────────

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const ahora = performance.now();
    const rapida = ahora - this.ultimaTecla <= EscanerService.MAX_ENTRE_TECLAS_MS;
    this.ultimaTecla = ahora;

    if (e.key === 'Enter' || e.key === 'Tab') {
      const codigo = this.buffer;
      this.buffer = '';
      if (rapida && codigo.length >= EscanerService.MIN_LARGO) {
        e.preventDefault();
        e.stopPropagation();
        this.limpiarCampo(e.target, codigo);
        this.zone.run(() => this.codigos.next(codigo));
      }
      return;
    }

    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) {
      if (e.key !== 'Shift') this.buffer = '';
      return;
    }
    this.buffer = rapida ? this.buffer + e.key : e.key;
  };

  /** Si la lectura se escribió en un campo, se la saca de ahí */
  private limpiarCampo(target: EventTarget | null, codigo: string): void {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const valor = target.value;
    const i = valor.lastIndexOf(codigo);
    if (i < 0) return;
    target.value = valor.slice(0, i) + valor.slice(i + codigo.length);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private escuchar(): void {
    if (!this.navegador || this.escuchando) return;
    this.escuchando = true;
    // Fuera de Angular: no dispara detección de cambios en cada tecla.
    // En captura: se ve la tecla antes que cualquier campo o atajo.
    this.zone.runOutsideAngular(() =>
      document.addEventListener('keydown', this.onKeyDown, true)
    );
  }

  private dejarDeEscuchar(): void {
    if (!this.navegador || !this.escuchando) return;
    this.escuchando = false;
    this.buffer = '';
    document.removeEventListener('keydown', this.onKeyDown, true);
  }

  private leerPreferencia(): boolean {
    try {
      return localStorage.getItem(EscanerService.CLAVE) === '1';
    } catch {
      return false;
    }
  }
}
