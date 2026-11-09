import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { FacturacionService } from '../services/facturacion.service';
import { OrderListadoDTO, OrderService } from '../services/order.service';
import { Reporte, ReportesService } from '../services/reportes.service';
import { UserService } from '../services/user.service';
import { paymentLabel } from '../utils/order-labels';

interface Aviso {
  texto: string;
  link: string;
}

/** Pantalla principal: cómo viene el día, accesos rápidos, avisos y últimas ventas. */
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.component.html',
})
export class InicioComponent implements OnInit {
  private usuarios = inject(UserService);
  private reportes = inject(ReportesService);
  private facturacion = inject(FacturacionService);
  private ordenes = inject(OrderService);

  readonly esAdmin = this.usuarios.isAdmin();
  readonly paymentLabel = paymentLabel;
  readonly nombre = (this.usuarios.getUser()?.name ?? '').split(' ')[0];
  readonly fecha = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly diaSemana = new Date().toLocaleDateString('es-AR', { weekday: 'long' });

  readonly accesos = [
    { texto: 'Nueva venta', icono: 'pi-shopping-cart', link: '/admin/pos', admin: false },
    { texto: 'Consultar producto', icono: 'pi-camera', link: '/admin/consultar', admin: false },
    { texto: 'Importar factura', icono: 'pi-file-import', link: '/admin/productos/importar-factura', admin: true },
    { texto: 'Nuevo producto', icono: 'pi-plus', link: '/admin/formProduct/new', admin: true },
  ].filter((a) => this.esAdmin || !a.admin);

  cargando = true;
  hoy: Reporte | null = null;
  semanaPasada: Reporte | null = null;
  avisos: Aviso[] = [];
  ultimas: OrderListadoDTO[] = [];

  ngOnInit(): void {
    this.ordenes
      .listarAdmin(0, 5)
      .pipe(catchError(() => of({ content: [] as OrderListadoDTO[] })))
      .subscribe((p) => {
        this.ultimas = p.content;
        if (!this.esAdmin) this.cargando = false;
      });
    if (this.esAdmin) this.cargarDia();
  }

  private cargarDia(): void {
    const hoy = new Date();
    const anterior = new Date(hoy);
    anterior.setDate(hoy.getDate() - 7);
    forkJoin({
      hoy: this.reportes.obtener(this.iso(hoy), this.iso(hoy)).pipe(catchError(() => of(null))),
      semanaPasada: this.reportes.obtener(this.iso(anterior), this.iso(anterior)).pipe(catchError(() => of(null))),
      sinFacturar: this.reportes.ventasSinFacturar().pipe(catchError(() => of(0))),
      estado: this.facturacion.estado().pipe(catchError(() => of(null))),
      config: this.facturacion.config().pipe(catchError(() => of(null))),
    }).subscribe(({ hoy: h, semanaPasada, sinFacturar, estado, config }) => {
      this.hoy = h;
      this.semanaPasada = semanaPasada;
      this.avisos = this.armarAvisos(h, estado?.habilitada ? sinFacturar : 0, config?.certificadoVence);
      this.cargando = false;
    });
  }

  private armarAvisos(r: Reporte | null, sinFacturar: number, certificadoVence?: string): Aviso[] {
    const avisos: Aviso[] = [];
    const sinStock = r?.recomendaciones.reponer.filter((x) => x.urgente).length ?? 0;
    if (sinStock > 0) {
      avisos.push({ texto: `${sinStock} ${sinStock === 1 ? 'talle' : 'talles'} sin stock que se venden`, link: '/admin/reportes' });
    }
    if (sinFacturar > 0) {
      avisos.push({ texto: `${sinFacturar} ${sinFacturar === 1 ? 'venta' : 'ventas'} sin facturar en los últimos 7 días`, link: '/admin/orders' });
    }
    if (certificadoVence) {
      const dias = Math.ceil((new Date(certificadoVence + 'T00:00:00').getTime() - Date.now()) / 86400000);
      if (dias <= 30) {
        avisos.push({
          texto: dias < 0 ? 'El certificado de ARCA está vencido' : `El certificado de ARCA vence en ${dias} días`,
          link: '/admin/configuracion/facturacion',
        });
      }
    }
    return avisos;
  }

  get numeros(): { titulo: string; valor: string; variacion: number | null }[] {
    if (!this.hoy) return [];
    const a = this.hoy.actual;
    const b = this.semanaPasada?.actual;
    const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
    return [
      { titulo: 'Vendido hoy', valor: pesos(a.ventasNetas), variacion: this.variacion(a.ventasNetas, b?.ventasNetas) },
      { titulo: 'Ventas', valor: String(a.cantidadVentas), variacion: this.variacion(a.cantidadVentas, b?.cantidadVentas) },
      { titulo: 'Ganancia', valor: pesos(a.gananciaBruta), variacion: this.variacion(a.gananciaBruta, b?.gananciaBruta) },
    ];
  }

  private variacion(actual: number, anterior?: number): number | null {
    if (!anterior) return null;
    return Math.round(((actual - anterior) / Math.abs(anterior)) * 100);
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
  }
}
