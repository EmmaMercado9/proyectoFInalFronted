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

  get principales(): { titulo: string; valor: string; variacion: number | null; nota: string; destacada?: boolean }[] {
    if (!this.r) return [];
    const { actual: a, anterior: b, facturacion: f, inventario: inv } = this.r;
    const $ = (n: number) => this.pesosEnteros.format(n);
    return [
      { titulo: 'Facturación', valor: $(a.ventasNetas), variacion: this.variacion(a.ventasNetas, b.ventasNetas), destacada: true,
        nota: f.comprobantes ? `${$(f.neto)} con factura electrónica (${f.comprobantes})` : '' },
      { titulo: 'Ganancia', valor: $(a.gananciaBruta), variacion: this.variacion(a.gananciaBruta, b.gananciaBruta), nota: '' },
      { titulo: 'Ventas', valor: this.numero.format(a.cantidadVentas), variacion: null,
        nota: `${this.numero.format(a.unidades)} unidades · ticket ${$(a.ticketPromedio)}` },
      { titulo: 'Productos en stock', valor: `${this.numero.format(inv.unidades)} u.`, variacion: null,
        nota: inv.variantesSinStock ? `${inv.variantesSinStock} talles sin stock` : '' },
      { titulo: 'Capital invertido', valor: $(inv.valorAlCosto), variacion: null,
        nota: `al costo · a precio de venta ${$(inv.valorAlPrecio)}` },
    ];
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

  private readonly numero = new Intl.NumberFormat('es-AR');

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

  // ─── Gráfico de área (SVG) ──────────────────────────────────────────────

  readonly W = 1000;
  readonly H = 200;
  readonly Math = Math;
  hover: number | null = null;
  private readonly compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

  get ventas(): number[] {
    return this.puntos.map((p) => p.ventas);
  }

  get ganancias(): number[] {
    return this.puntos.map((p) => p.ganancia);
  }

  /** Tope del eje: el máximo redondeado hacia arriba, para que la curva no toque el borde */
  private get tope(): number {
    const m = this.maxDia;
    const paso = Math.pow(10, Math.floor(Math.log10(m)));
    return Math.ceil(m / paso) * paso;
  }

  get guias(): { y: number; texto: string }[] {
    return [1, 0.5, 0].map((f) => ({ y: (1 - f) * 100, texto: '$' + this.compacto.format(this.tope * f) }));
  }

  /** Cada punto va en el centro de su columna (igual que las etiquetas de abajo) */
  private x(i: number): number {
    return ((i + 0.5) / this.puntos.length) * this.W;
  }

  private y(v: number): number {
    return this.H - (Math.max(0, v) / this.tope) * this.H;
  }

  xPct(i: number): number {
    return (this.x(i) / this.W) * 100;
  }

  yPct(v: number): number {
    return (this.y(v) / this.H) * 100;
  }

  /** Curva suave entre los puntos (sin pasarse de los valores reales) */
  curva(valores: number[]): string {
    if (!valores.length) return '';
    if (valores.length === 1) return `M0 ${this.y(valores[0])} L${this.W} ${this.y(valores[0])}`;
    let d = `M${this.x(0)} ${this.y(valores[0])}`;
    for (let i = 1; i < valores.length; i++) {
      const x0 = this.x(i - 1);
      const x1 = this.x(i);
      const medio = (x0 + x1) / 2;
      d += ` C${medio} ${this.y(valores[i - 1])} ${medio} ${this.y(valores[i])} ${x1} ${this.y(valores[i])}`;
    }
    return d;
  }

  area(valores: number[]): string {
    if (!valores.length) return '';
    const n = valores.length;
    const ini = n === 1 ? 0 : this.x(0);
    const fin = n === 1 ? this.W : this.x(n - 1);
    return `${this.curva(valores)} L${fin} ${this.H} L${ini} ${this.H} Z`;
  }

  get hayVentas(): boolean {
    return (this.r?.actual.cantidadVentas ?? 0) > 0;
  }

  bloques(r: Reporte): { titulo: string; items: Item[]; unidad: string }[] {
    return [
      { titulo: 'Por medio de pago', items: r.porMedioDePago, unidad: 'ventas' },
      { titulo: 'Por categoría', items: r.porCategoria, unidad: 'unidades' },
      { titulo: 'Por marca', items: r.porMarca, unidad: 'unidades' },
    ];
  }

  private iso(d: Date): string {
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }
}
