import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EstadoFacturacion {
  habilitada: boolean;
  ambiente: 'HOMOLOGACION' | 'PRODUCCION';
  cuit?: number;
  puntoVenta?: number;
  razonSocial?: string;
  faltantes: string[];
  servidores?: Record<string, string>;
  mensaje?: string;
}

export interface FacturaItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Factura {
  idFactura: number;
  tipo: 'FACTURA_C' | 'NOTA_CREDITO_C';
  tipoDescripcion: string;
  codigoTipo: number;
  letra: string;
  puntoVenta: number;
  numero: number;
  numeroFormateado: string;
  fecha: string;
  importeTotal: number;
  cae: string;
  caeVencimiento: string;
  ambiente: string;
  prueba: boolean;
  qrUrl: string;
  docTipo: number;
  docNro: number;
  condicionIvaReceptorId: number;
  condicionIvaReceptor: string;
  receptorNombre?: string;
  idOrder: number;
  trackingIdOrden: string;
  idFacturaAsociada?: number;
  facturaAsociadaNumero?: string;
  idDevolucion?: number;
  motivo?: string;
  usuario?: string;
  creadoEn: string;
  saldoAnulable?: number;
  emisor: {
    cuit: number;
    razonSocial: string;
    domicilio?: string;
    iibb?: string;
    inicioActividades?: string;
    condicionIva: string;
  };
  items: FacturaItem[];
}

export interface FacturarRequest {
  docTipo?: number;
  docNro?: number;
  condicionIvaReceptorId?: number;
}

export interface NotaCreditoRequest {
  devolucionId?: number;
  importe?: number;
  motivo?: string;
}

// Tablas de ARCA usadas en la pantalla
export const TIPOS_DOC: { id: number; label: string }[] = [
  { id: 99, label: 'Consumidor final (sin identificar)' },
  { id: 96, label: 'DNI' },
  { id: 80, label: 'CUIT' },
  { id: 86, label: 'CUIL' },
];

export const CONDICIONES_IVA: { id: number; label: string }[] = [
  { id: 5, label: 'Consumidor Final' },
  { id: 6, label: 'Responsable Monotributo' },
  { id: 1, label: 'IVA Responsable Inscripto' },
  { id: 4, label: 'IVA Sujeto Exento' },
  { id: 15, label: 'IVA No Alcanzado' },
];

export function docTipoLabel(id: number): string {
  return TIPOS_DOC.find((t) => t.id === id)?.label.split(' ')[0] ?? `Doc ${id}`;
}

@Injectable({ providedIn: 'root' })
export class FacturacionService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/api/admin`;
  private estado$?: Observable<EstadoFacturacion>;

  /** Se cachea: la configuración no cambia sin reiniciar el backend */
  estado(): Observable<EstadoFacturacion> {
    this.estado$ ??= this.http
      .get<EstadoFacturacion>(`${this.API}/facturacion/estado`)
      .pipe(shareReplay(1));
    return this.estado$;
  }

  probar(): Observable<EstadoFacturacion> {
    return this.http.post<EstadoFacturacion>(`${this.API}/facturacion/probar`, {});
  }

  facturar(idOrder: number, req: FacturarRequest): Observable<Factura> {
    return this.http.post<Factura>(`${this.API}/orders/${idOrder}/factura`, req);
  }

  porOrden(idOrder: number): Observable<Factura[]> {
    return this.http.get<Factura[]>(`${this.API}/orders/${idOrder}/facturas`);
  }

  obtener(idFactura: number): Observable<Factura> {
    return this.http.get<Factura>(`${this.API}/facturas/${idFactura}`);
  }

  notaCredito(idFactura: number, req: NotaCreditoRequest): Observable<Factura> {
    return this.http.post<Factura>(`${this.API}/facturas/${idFactura}/nota-credito`, req);
  }
}
