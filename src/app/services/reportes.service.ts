import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Resumen {
  ventasBrutas: number;
  descuentos: number; // manuales + descuento por pago en efectivo
  recargos: number; // recargos por pago en cuotas
  devoluciones: number;
  ventasNetas: number;
  costoMercaderia: number;
  perdidaFallados: number;
  gananciaBruta: number;
  margen: number | null;
  cantidadVentas: number;
  unidades: number;
  ticketPromedio: number;
  canceladas: number;
  montoCancelado: number;
}

export interface Punto {
  fecha: string;
  ventas: number;
  ganancia: number;
  cantidad: number;
}

export interface Item {
  nombre: string;
  ventas: number;
  ganancia: number;
  cantidad: number;
}

export interface ProductoReporte {
  producto: string;
  sku: string;
  unidades: number;
  ventas: number;
  ganancia: number;
  margen: number | null;
}

export interface Reposicion {
  producto: string;
  variante: string;
  sku: string;
  stock: number;
  vendidas30: number;
  diasCobertura: number;
  sugerido: number;
  costoEstimado: number;
  urgente: boolean;
}

export interface SinRotacion {
  producto: string;
  variante: string;
  sku: string;
  stock: number;
  capitalInmovilizado: number;
}

export interface Reporte {
  desde: string;
  hasta: string;
  actual: Resumen;
  anterior: Resumen;
  ventasPorDia: Punto[];
  porMedioDePago: Item[];
  porVendedor: Item[];
  porCategoria: Item[];
  porMarca: Item[];
  porDiaDeSemana: Item[];
  porHora: Item[];
  masVendidos: ProductoReporte[];
  masRentables: ProductoReporte[];
  perdidas: {
    perdidaFallados: number;
    unidadesFalladas: number;
    perdidaVentasBajoCosto: number;
    vendidosBajoCosto: ProductoReporte[];
    descuentos: number;
    devoluciones: number;
    canceladas: number;
    montoCancelado: number;
  };
  inventario: {
    unidades: number;
    valorAlCosto: number;
    valorAlPrecio: number;
    variantesSinStock: number;
    variantesBajoMinimo: number;
  };
  compras: { facturas: number; unidades: number; total: number };
  facturacion: {
    ambiente: string;
    comprobantes: number;
    facturado: number;
    notasCredito: number;
    neto: number;
    porcentajeDeVentas: number | null;
  };
  recomendaciones: {
    reponer: Reposicion[];
    sinRotacion: SinRotacion[];
    margenBajo: ProductoReporte[];
    altaDevolucion: { producto: string; vendidas: number; devueltas: number; tasa: number }[];
    tallesMasVendidos: { producto: string; talle: string; unidades: number }[];
  };
  observaciones: string[];
  detallesConCostoEstimado: number;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/api/admin/reportes`;

  /** Fechas en formato yyyy-MM-dd */
  obtener(desde: string, hasta: string): Observable<Reporte> {
    return this.http.get<Reporte>(this.API, { params: new HttpParams().set('desde', desde).set('hasta', hasta) });
  }
}
