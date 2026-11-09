import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of } from 'rxjs';

import { ProductService } from '../services/products.service';
import { ProductResponse } from '../model/product.model';
import { EscanerService } from '../shared/escaner/escaner.service';
import { CamaraLectorComponent } from '../shared/escaner/camara-lector.component';
import { PreciosMediosComponent } from '../shared/precios-medios/precios-medios.component';

/** Consulta rápida desde el celular: escanea o busca y muestra stock y precio por talle. */
@Component({
  selector: 'app-consultar-producto',
  standalone: true,
  imports: [CommonModule, FormsModule, PreciosMediosComponent, CamaraLectorComponent],
  templateUrl: './consultar-producto.component.html',
})
export class ConsultarProductoComponent {
  private productService = inject(ProductService);
  private escaner = inject(EscanerService);

  texto = '';
  buscando = false;
  sinResultados = false;
  resultados: any[] = [];
  producto: ProductResponse | null = null;
  variantEscaneada: number | null = null;

  /** Código escaneado: primero por código de barras; si no, por nombre o SKU */
  buscarCodigo(codigo: string): void {
    this.texto = codigo;
    this.buscando = true;
    this.productService
      .buscarPorBarcode(codigo)
      .pipe(
        catchError(() => of(null)),
        finalize(() => (this.buscando = false))
      )
      .subscribe((data) => {
        if (!data) {
          this.buscar();
          return;
        }
        this.escaner.pitido(true);
        this.producto = data.producto;
        this.variantEscaneada = data.variante?.variantId ?? null;
      });
  }

  buscar(): void {
    const q = this.texto.trim();
    if (!q) return;
    this.limpiar();
    this.texto = q;
    this.buscando = true;
    this.productService
      .listar({ nombre: q, size: 20 })
      .pipe(
        catchError(() => of({ content: [] as any[] })),
        finalize(() => (this.buscando = false))
      )
      .subscribe((pagina) => {
        this.resultados = pagina.content;
        this.sinResultados = pagina.content.length === 0;
        if (pagina.content.length === 1) this.abrir(pagina.content[0]);
      });
  }

  abrir(item: any): void {
    this.productService.getById(item.idProduct).subscribe((p) => {
      this.producto = p;
      this.resultados = [];
    });
  }

  limpiar(): void {
    this.producto = null;
    this.resultados = [];
    this.sinResultados = false;
    this.variantEscaneada = null;
    this.texto = '';
  }

  get variantes(): any[] {
    return ((this.producto as any)?.variantes ?? []).filter((v: any) => v.status !== 'INACTIVO');
  }

  get stockTotal(): number {
    return this.variantes.reduce((a, v) => a + (v.stock ?? 0), 0);
  }
}
