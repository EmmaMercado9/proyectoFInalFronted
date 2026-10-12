import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CategoryResponse,
  SubCategoriaResponse,
} from '../model/product.model';

// Endpoints de CategoryController (/api/categorias)
@Injectable({
  providedIn: 'root',
})
export class CatgoryService {
  private http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/api/categorias`;

  getCategories(): Observable<CategoryResponse[]> {
    return this.http.get<CategoryResponse[]>(this.url);
  }

  addCategory(nameCategory: string): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(this.url, { nameCategory });
  }

  renameCategory(id: number, nameCategory: string): Observable<CategoryResponse> {
    return this.http.put<CategoryResponse>(`${this.url}/${id}`, { nameCategory });
  }

  // 400 si la categoría tiene productos asociados
  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  addSubCategory(nombre: string, categoryId: number): Observable<SubCategoriaResponse> {
    return this.http.post<SubCategoriaResponse>(`${this.url}/subcategorias`, {
      nombre,
      categoryId,
    });
  }

  moveSubCategory(subId: number, categoryId: number): Observable<SubCategoriaResponse> {
    return this.http.patch<SubCategoriaResponse>(
      `${this.url}/subcategorias/${subId}/mover?categoryId=${categoryId}`,
      {}
    );
  }

  // ACTIVO ↔ INACTIVO
  toggleSubCategoryStatus(subId: number): Observable<void> {
    return this.http.patch<void>(
      `${this.url}/subcategorias/${subId}/toggle-status`,
      {}
    );
  }
}
