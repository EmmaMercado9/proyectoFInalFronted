// cart.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartItem {
  variantId: number;
  sku: string;
  productoNombre: string;
  descripcion: string;
  precio: number;
  cantidad: number;
  imagenUrl?: string;
  stockDisponible: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items: CartItem[] = [];
  private items$$ = new BehaviorSubject<CartItem[]>([]);

  // Observable que usan los componentes para reaccionar a cambios
  items$ = this.items$$.asObservable();

  agregar(item: CartItem): void {
    const existente = this.items.find((i) => i.variantId === item.variantId);
    if (existente) {
      // No superar el stock disponible
      const nuevaCantidad = existente.cantidad + item.cantidad;
      existente.cantidad = Math.min(nuevaCantidad, item.stockDisponible);
    } else {
      this.items.push({ ...item });
    }
    this.emitir();
  }

  eliminar(variantId: number): void {
    this.items = this.items.filter((i) => i.variantId !== variantId);
    this.emitir();
  }

  actualizarCantidad(variantId: number, cantidad: number): void {
    const item = this.items.find((i) => i.variantId === variantId);
    if (!item) return;
    if (cantidad <= 0) {
      this.eliminar(variantId);
      return;
    }
    item.cantidad = Math.min(cantidad, item.stockDisponible);
    this.emitir();
  }

  limpiar(): void {
    this.items = [];
    this.emitir();
  }

  get total(): number {
    return this.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  }

  get cantidadTotal(): number {
    return this.items.reduce((acc, i) => acc + i.cantidad, 0);
  }

  get itemsActuales(): CartItem[] {
    return [...this.items];
  }

  estaEnCarrito(variantId: number): boolean {
    return this.items.some((i) => i.variantId === variantId);
  }

  private emitir(): void {
    this.items$$.next([...this.items]);
  }
}
