import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';

import { Item, Punto, Reporte, Reposicion, ReportesService } from '../services/reportes.service';
import { ErrorHandleService } from '../error/error-handle.service';

type Periodo = 'hoy' | '7' | '30' | 'mes' | 'mesAnterior' | 'anio' | 'personalizado';

/** Estadísticas y reportes de gestión (solo ADMIN). Los gráficos son SVG/CSS, sin librerías. */
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.component.html',
})
export class ReportesComponent implements OnInit {
  private reportes = inject(ReportesService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);

  readonly periodos: { valor: Periodo; texto: string }[] = [
    { valor: 'hoy', texto: 'Hoy' },
    { valor: '7', texto: '7 días' },
    { valor: '30', texto: '30 días' },
    { valor: 'mes', texto: 'Este mes' },
    { valor: 'mesAnterior', texto: 'Mes anterior' },
    { valor: 'anio', texto: 'Este año' },
    { valor: 'personalizado', texto: 'Elegir fechas' },
  ];
  periodo: Periodo = '30';
  desde = '';
  hasta = '';
  cargando = false;
  r: Reporte | null = null;
  verDetalle = false;

  ngOnInit(): void {
    this.elegir('30');
  }

  elegir(p: Periodo): void {
    this.periodo = p;
    if (p === 'personalizado') return;
    const hoy = new Date();
    const d = new Date(hoy);
    let h = new Date(hoy);
    switch (p) {
      case '7':
        d.setDate(hoy.getDate() - 6);
        break;
      case '30':
        d.setDate(hoy.getDate() - 29);
        break;
      case 'mes':
        d.setDate(1);
        break;
      case 'mesAnterior':
        d.setMonth(hoy.getMonth() - 1, 1);
        h = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;
      case 'anio':
        d.setMonth(0, 1);
        break;
    }
    this.desde = this.iso(d);
    this.hasta = this.iso(h);
    this.cargar();
  }

  cargar(): void {
    if (!this.desde || !this.hasta) return;
    this.cargando = true;
    this.reportes
      .obtener(this.desde, this.hasta)
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (r) => (this.r = r),
        error: (err) => this.message.add(this.errorService.toMessage(err, 'No se pudo generar el reporte')),
      });
  }

  /** El papel lleva el reporte completo */
  imprimir(): void {
    this.verDetalle = true;
    setTimeout(() => window.print());
  }

  // ─── Resumen ────────────────────────────────────────────────────────────

  private readonly pesosEnteros = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  get principales(): { titulo: string; valor: string; variacion: number | null; nota: string }[] {
    if (!this.r) return [];
    const a = this.r.actual;
    const b = this.r.anterior;
    return [
      { titulo: 'Vendiste', valor: this.pesosEnteros.format(a.ventasNetas), variacion: this.variacion(a.ventasNetas, b.ventasNetas), nota: '' },
      { titulo: 'Ganaste', valor: this.pesosEnteros.format(a.gananciaBruta), variacion: this.variacion(a.gananciaBruta, b.gananciaBruta), nota: '' },
      { titulo: 'Ventas', valor: this.numero.format(a.cantidadVentas), variacion: null,
        nota: `${this.numero.format(a.unidades)} unidades · ticket ${this.pesosEnteros.format(a.ticketPromedio)}` },
    ];
  }

  /** Lo accionable, en una línea cada cosa */
  get acciones(): string[] {
    if (!this.r) return [];
    const { recomendaciones: rec, perdidas } = this.r;
    const lista: string[] = [];
    const urgentes = rec.reponer.filter((x) => x.urgente).length;
    if (rec.reponer.length) {
      lista.push(`Reponé ${rec.reponer.length} talles${urgentes ? ` (${urgentes} ya sin stock)` : ''}: ${this.pesosEnteros.format(this.inversionSugerida)} aprox.`);
    }
    if (this.capitalInmovilizado > 0) {
      lista.push(`Tenés ${this.pesosEnteros.format(this.capitalInmovilizado)} en mercadería que no se vende hace 90 días: hacé una promo.`);
    }
    const perdido = perdidas.perdidaFallados + perdidas.perdidaVentasBajoCosto;
    if (perdido > 0) {
      lista.push(`Perdiste ${this.pesosEnteros.format(perdido)} entre fallados y ventas por debajo del costo.`);
    }
    return lista;
  }

  get paraComprar(): Reposicion[] {
    return [...(this.r?.recomendaciones.reponer ?? [])]
      .sort((a, b) => Number(b.urgente) - Number(a.urgente) || a.diasCobertura - b.diasCobertura)
      .slice(0, 5);
  }

  private mejor(items: Item[] | undefined): string | null {
    return items?.length ? items.reduce((a, b) => (b.ventas > a.ventas ? b : a)).nombre : null;
  }

  get mejorDia(): string | null {
    return this.mejor(this.r?.porDiaDeSemana)?.toLowerCase() ?? null;
  }

  get mejorMedio(): string | null {
    return this.mejor(this.r?.porMedioDePago) ?? null;
  }

  // ─── "Tu tienda en números" ─────────────────────────────────────────────

  private readonly pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
  private readonly numero = new Intl.NumberFormat('es-AR');

  /** Cada indicador con su valor, el del mismo período anterior y la variación. */
  get indicadores(): { titulo: string; ayuda: string; actual: string; anterior: string; variacion: number | null }[] {
    if (!this.r) return [];
    const a = this.r.actual;
    const b = this.r.anterior;
    const $ = (n: number) => this.pesos.format(n);
    const n = (x: number) => this.numero.format(x);
    const pct = (x: number | null) => (x === null ? '—' : `${x.toLocaleString('es-AR')} %`);
    return [
      { titulo: 'Ventas', ayuda: 'Cantidad de ventas registradas en el período (sin las canceladas).',
        actual: n(a.cantidadVentas), anterior: n(b.cantidadVentas), variacion: this.variacion(a.cantidadVentas, b.cantidadVentas) },
      { titulo: 'Facturación', ayuda: 'Ventas netas: lo cobrado menos descuentos y devoluciones.',
        actual: $(a.ventasNetas), anterior: $(b.ventasNetas), variacion: this.variacion(a.ventasNetas, b.ventasNetas) },
      { titulo: 'Ticket promedio', ayuda: 'Facturación dividida por la cantidad de ventas: cuánto gasta en promedio cada cliente.',
        actual: $(a.ticketPromedio), anterior: $(b.ticketPromedio), variacion: this.variacion(a.ticketPromedio, b.ticketPromedio) },
      { titulo: 'Ganancia bruta', ayuda: 'Facturación menos el costo de lo vendido y de los productos fallados devueltos. No incluye gastos fijos.',
        actual: $(a.gananciaBruta), anterior: $(b.gananciaBruta), variacion: this.variacion(a.gananciaBruta, b.gananciaBruta) },
      { titulo: 'Margen', ayuda: 'Ganancia bruta sobre facturación: de cada $100 vendidos, cuánto queda de ganancia.',
        actual: pct(a.margen), anterior: pct(b.margen),
        variacion: a.margen !== null && b.margen !== null ? Math.round((a.margen - b.margen) * 10) / 10 : null },
      { titulo: 'Unidades vendidas', ayuda: 'Prendas y pares vendidos, descontando las devoluciones.',
        actual: n(a.unidades), anterior: n(b.unidades), variacion: this.variacion(a.unidades, b.unidades) },
    ];
  }

  // ─── Ayudas para la vista ───────────────────────────────────────────────

  /** Variación porcentual respecto del período anterior (null si no hay base). */
  variacion(actual: number, anterior: number): number | null {
    if (!anterior) return null;
    return Math.round(((actual - anterior) / Math.abs(anterior)) * 1000) / 10;
  }

  max(items: { ventas: number }[]): number {
    return Math.max(1, ...items.map((i) => i.ventas));
  }

  ancho(valor: number, max: number): number {
    return Math.max(0, Math.round((valor / max) * 100));
  }

  /** Agrupación del gráfico según el largo del período, para que las barras entren en pantalla. */
  get agrupacion(): 'día' | 'semana' | 'mes' {
    const n = this.r?.ventasPorDia.length ?? 0;
    return n <= 62 ? 'día' : n <= 186 ? 'semana' : 'mes';
  }

  /** Puntos del gráfico: por día, por semana (desde el lunes) o por mes. */
  get puntos(): Punto[] {
    const dias = this.r?.ventasPorDia ?? [];
    if (this.agrupacion === 'día') return dias;
    const grupos = new Map<string, Punto>();
    for (const p of dias) {
      const f = new Date(p.fecha + 'T00:00:00');
      if (this.agrupacion === 'semana') f.setDate(f.getDate() - ((f.getDay() + 6) % 7)); // lunes
      else f.setDate(1);
      const clave = this.iso(f);
      const g = grupos.get(clave) ?? { fecha: clave, ventas: 0, ganancia: 0, cantidad: 0 };
      g.ventas += p.ventas;
      g.ganancia += p.ganancia;
      g.cantidad += p.cantidad;
      grupos.set(clave, g);
    }
    return [...grupos.values()];
  }

  get maxDia(): number {
    return this.max(this.puntos);
  }

  /** Mostrar etiqueta cada tantas barras para que no se encimen. */
  mostrarEtiqueta(i: number): boolean {
    const n = this.puntos.length;
    const paso = n <= 12 ? 1 : n <= 31 ? 5 : 4;
    return i % paso === 0 || i === n - 1;
  }

  alto(p: Punto): number {
    return Math.round((Math.max(0, p.ventas) / this.maxDia) * 100);
  }

  altoGanancia(p: Punto): number {
    return Math.round((Math.max(0, p.ganancia) / this.maxDia) * 100);
  }

  get inversionSugerida(): number {
    return this.r?.recomendaciones.reponer.reduce((a, x) => a + x.costoEstimado, 0) ?? 0;
  }

  get capitalInmovilizado(): number {
    return this.r?.recomendaciones.sinRotacion.reduce((a, x) => a + x.capitalInmovilizado, 0) ?? 0;
  }

  get hayVentas(): boolean {
    return (this.r?.actual.cantidadVentas ?? 0) > 0;
  }

  bloques(r: Reporte): { titulo: string; items: Item[]; unidad: string }[] {
    return [
      { titulo: 'Por medio de pago', items: r.porMedioDePago, unidad: 'ventas' },
      { titulo: 'Por día de la semana', items: r.porDiaDeSemana, unidad: 'ventas' },
      { titulo: 'Por categoría', items: r.porCategoria, unidad: 'unidades' },
      { titulo: 'Por marca', items: r.porMarca, unidad: 'unidades' },
      { titulo: 'Por vendedor', items: r.porVendedor, unidad: 'ventas' },
      { titulo: 'Por hora del día', items: r.porHora, unidad: 'ventas' },
    ];
  }

  private iso(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }
}
