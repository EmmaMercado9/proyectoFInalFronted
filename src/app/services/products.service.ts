import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { Page } from './order.service';
import {
  AtributoResponse,
  ImageResponse,
  ProductListadoDTO,
  ProductRequest,
  ProductResponse,
  ProductUpdateRequest,
  VarianteRequest,
  VarianteResponse,
  VarianteUpdateRequest,
} from '../model/product.model';

// services/product.service.ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly API = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) {}

  // Crear producto — usa FormData para enviar archivos
  crearProducto(
    dto: ProductRequest,
    files?: File[]
  ): Observable<ProductResponse> {
    const formData = new FormData();
    formData.append(
      'datos',
      new Blob([JSON.stringify(dto)], { type: 'application/json' })
    );
    if (files && files.length > 0) {
      files.forEach((f) => formData.append('files', f));
    }
    return this.http.post<ProductResponse>(`${this.API}/productos`, formData);
  }

  // Agregar variante con sus imágenes
  agregarVariante(
    productId: string,
    dto: VarianteRequest,
    files?: File[]
  ): Observable<VarianteResponse> {
    const formData = new FormData();
    formData.append(
      'datos',
      new Blob([JSON.stringify(dto)], { type: 'application/json' })
    );
    if (files && files.length > 0) {
      files.forEach((f) => formData.append('files', f));
    }
    return this.http.post<VarianteResponse>(
      `${this.API}/productos/${productId}/variantes`,
      formData
    );
  }
  // { tipo: 'VARIANTE', variante, producto } | { tipo: 'PRODUCTO', producto } · 404 si no existe
  buscarPorBarcode(codigo: string): Observable<any> {
    return this.http.get<any>(
      `${this.API}/productos/variantes/barcode/${encodeURIComponent(codigo)}`
    );
  }

  getById(id: string): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.API}/productos/${id}`);
  }

  // DELETE — solo si nunca se vendió; si tiene ventas el backend responde 400
  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API}/productos/${id}`);
  }

  eliminarVariante(variantId: number): Observable<void> {
    return this.http.delete<void>(`${this.API}/productos/variantes/${variantId}`);
  }

  // Una variante inactiva no se vende ni suma stock
  cambiarEstadoVariante(variantId: number, activa: boolean): Observable<VarianteResponse> {
    return this.http.patch<VarianteResponse>(
      `${this.API}/productos/variantes/${variantId}/${activa ? 'reactivar' : 'desactivar'}`,
      {}
    );
  }

  desactivar(id: string): Observable<void> {
    return this.http.patch<void>(`${this.API}/productos/${id}/desactivar`, {});
  }

  reactivar(id: string): Observable<void> {
    return this.http.patch<void>(`${this.API}/productos/${id}/reactivar`, {});
  }
  listar(
    params: {
      nombre?: string;
      status?: string;
      page?: number;
      size?: number;
    } = {}
  ): Observable<Page<ProductListadoDTO>> {
    const q = new URLSearchParams();
    if (params.nombre) q.set('nombre', params.nombre);
    if (params.status) q.set('status', params.status);
    q.set('page', String(params.page ?? 0));
    q.set('size', String(params.size ?? 12));
    return this.http.get<Page<ProductListadoDTO>>(
      `${this.API}/productos?${q.toString()}`
    );
  }

  // Atributos para el selector de variantes
  getAtributos(): Observable<AtributoResponse[]> {
    return this.http.get<AtributoResponse[]>(`${this.API}/atributos`);
  }
  // PUT /api/productos/{id} — datos generales (sin stock ni variantes)
  actualizar(id: string, dto: ProductUpdateRequest): Observable<ProductResponse> {
    return this.http.put<ProductResponse>(`${this.API}/productos/${id}`, dto);
  }

  // PUT /api/productos/variantes/{variantId}
  actualizarVariante(
    variantId: number,
    dto: VarianteUpdateRequest
  ): Observable<VarianteResponse> {
    return this.http.put<VarianteResponse>(
      `${this.API}/productos/variantes/${variantId}`,
      dto
    );
  }

  // PATCH /api/productos/variantes/{variantId}/stock?cantidad=N — fija el stock (valor absoluto)
  actualizarStock(variantId: number, cantidad: number): Observable<VarianteResponse> {
    return this.http.patch<VarianteResponse>(
      `${this.API}/productos/variantes/${variantId}/stock?cantidad=${cantidad}`,
      {}
    );
  }

  // POST /api/productos/variantes/{variantId}/imagenes (multipart, campo "files")
  subirImagenesVariante(variantId: number, files: File[]): Observable<ImageResponse[]> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return this.http.post<ImageResponse[]>(
      `${this.API}/productos/variantes/${variantId}/imagenes`,
      formData
    );
  }
}
