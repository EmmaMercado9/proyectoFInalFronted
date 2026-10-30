import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Un talle de un modelo = una variante */
export interface TalleImportado {
  talle: string;
  sku: string;
  cantidad: number;
  costoUnitario: number;
  varianteId?: number | null; // si ya existe: se le suma stock
  stockActual?: number | null;
}

/** Un modelo (código de artículo) = un producto */
export interface ModeloImportado {
  codigoArticulo: string;
  nombre: string;
  marca: string;
  subCategoriaId?: number | null; // solo productos nuevos
  precioVenta: number;
  productoId?: string | null; // si ya existe
  productoExistente?: string | null;
  talles: TalleImportado[];
}

/** Vista previa que devuelve el backend y que se manda de vuelta para confirmar */
export interface ImportacionFactura {
  proveedor: string;
  cuit: string;
  numero: string;
  fecha: string;
  total: number;
  sumaLineas: number;
  totalCoincide: boolean;
  yaImportada?: string | null;
  unidades: number;
  modelos: ModeloImportado[];
}

export interface ResultadoImportacion {
  productosCreados: number;
  variantesCreadas: number;
  variantesConStockSumado: number;
  unidades: number;
}

/** Historial: una factura de proveedor ya importada */
export interface FacturaImportada {
  id: number;
  proveedor: string;
  cuit: string;
  numero: string;
  fecha: string;
  total: number;
  unidades: number;
  usuario?: string | null;
  importadaEn: string;
}

@Injectable({ providedIn: 'root' })
export class ImportacionFacturaService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/api/productos/importar-factura`;

  /** Facturas ya importadas, de la más reciente a la más vieja */
  listar(): Observable<FacturaImportada[]> {
    return this.http.get<FacturaImportada[]>(this.API);
  }

  /** Paso 1: sube el PDF y devuelve la vista previa (no guarda nada) */
  leer(archivo: File): Observable<ImportacionFactura> {
    const form = new FormData();
    form.append('archivo', archivo);
    return this.http.post<ImportacionFactura>(this.API, form);
  }

  /** Paso 2: confirma lo revisado */
  confirmar(datos: ImportacionFactura): Observable<ResultadoImportacion> {
    return this.http.post<ResultadoImportacion>(`${this.API}/confirmar`, datos);
  }
}
