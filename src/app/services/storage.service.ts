import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  constructor() {}
  /*
  loadProduct(): Observable<ProductItemCart[]> {
    if (typeof localStorage === 'undefined') {
      // Si no estamos en un navegador, retorna un arreglo vacío
      return of([]);
    }
    const rawProduct = localStorage.getItem('products');
    return of(rawProduct ? JSON.parse(rawProduct) : []);
  }

  saveProducts(products: ProductItemCart[]): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('products', JSON.stringify(products));
    }
  }*/
}
