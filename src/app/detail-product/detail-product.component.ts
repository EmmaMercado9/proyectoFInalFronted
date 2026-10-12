// detail-product.component.ts
import { Component, inject, OnInit } from '@angular/core';
import {
  ImageResponse,
  ProductResponse,
  VarianteResponse,
} from '../model/product.model';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { ProductService } from '../services/products.service';
import { MessageService } from 'primeng/api';
import { catchError, of } from 'rxjs';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { CartService } from '../services/cart.service';

@Component({
  selector: 'app-detail-product',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastModule, DecimalPipe],
  templateUrl: './detail-product.component.html',
  styleUrl: './detail-product.component.css',
})
export class DetailProductComponent implements OnInit {
  // ─── Datos ───────────────────────────────────────────────────────────────
  producto!: ProductResponse;
  isLoading = true;

  // ─── Selección actual ────────────────────────────────────────────────────
  varianteSeleccionada: VarianteResponse | null = null;
  imagenActiva!: ImageResponse;

  // ─── Grupos para la UI ───────────────────────────────────────────────────
  coloresUnicos: VarianteResponse[] = [];
  tallasFiltradas: VarianteResponse[] = [];

  // ─── Carrito lateral ─────────────────────────────────────────────────────
  carritoVisible = false;

  // ─── Inyecciones ─────────────────────────────────────────────────────────
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private message = inject(MessageService);
  public cartService = inject(CartService); // public → accesible en el template

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/products']);
      return;
    }

    this.productService
      .getById(id)
      .pipe(
        catchError(() => {
          this.message.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudo cargar el producto',
          });
          return of(null);
        })
      )
      .subscribe((p) => {
        this.isLoading = false;
        if (!p) return;
        // Las variantes desactivadas no se ofrecen para vender
        p.variantes = (p.variantes ?? []).filter((v) => v.status !== 'INACTIVO');
        this.producto = p;

        if (p.tieneVariantes && p.variantes?.length) {
          this.coloresUnicos = this.getVariantesPorColor(p.variantes);
          const primera =
            p.variantes.find((v: any) => v.stock > 0) ?? p.variantes[0];
          this.seleccionarVariante(primera);
        } else {
          // Sin variantes — asignar variante default para que el carrito funcione
          const vDefault =
            p.variantes?.find((v: any) => v.esDefault) ?? p.variantes?.[0];
          if (vDefault) {
            this.varianteSeleccionada = vDefault;
          }
          this.imagenActiva = p.imageModelSetDto?.[0];
        }
      });
  }

  // ─── Selección ───────────────────────────────────────────────────────────

  seleccionarVariante(variante: VarianteResponse): void {
    this.varianteSeleccionada = variante;

    this.imagenActiva =
      variante.imageModelSetDto?.find((i: any) => i.esPrincipal) ??
      variante.imageModelSetDto?.[0];

    const colorActivo = this.getColor(variante);
    this.tallasFiltradas = this.producto.variantes.filter(
      (v: any) => this.getColor(v) === colorActivo
    );
  }

  seleccionarColor(variante: VarianteResponse): void {
    const colorNuevo = this.getColor(variante);
    const tallaActual = this.varianteSeleccionada
      ? this.getTalla(this.varianteSeleccionada)
      : '';

    const mismaEnNuevoColor = this.producto.variantes.find(
      (v: any) =>
        this.getColor(v) === colorNuevo && this.getTalla(v) === tallaActual
    );

    this.seleccionarVariante(
      mismaEnNuevoColor ??
        this.producto.variantes.find(
          (v: any) => this.getColor(v) === colorNuevo && v.stock > 0
        ) ??
        variante
    );
  }

  seleccionarImagen(img: ImageResponse): void {
    this.imagenActiva = img;
  }

  // ─── Carrito lateral ─────────────────────────────────────────────────────

  abrirCarrito(): void {
    this.carritoVisible = true;
  }
  cerrarCarrito(): void {
    this.carritoVisible = false;
  }

  get itemsCarrito() {
    return this.cartService.itemsActuales;
  }
  get totalCarrito() {
    return this.cartService.total;
  }
  get cantidadCarrito() {
    return this.cartService.cantidadTotal;
  }

  // ─── Getters de UI ───────────────────────────────────────────────────────

  get imagenesActivas(): ImageResponse[] {
    if (this.producto?.tieneVariantes) {
      return this.varianteSeleccionada?.imageModelSetDto ?? [];
    }
    return this.producto?.imageModelSetDto ?? [];
  }

  get precioActivo(): number {
    return (
      this.varianteSeleccionada?.precioVenta ?? this.producto?.precioVenta ?? 0
    );
  }

  get precioProActivo(): number | undefined {
    return this.varianteSeleccionada?.precioPro ?? this.producto?.precioPro;
  }

  get stockBajo(): boolean {
    const v = this.varianteSeleccionada;
    return !!v && v.stock > 0 && v.stock <= v.stockMinimo;
  }

  get sinStock(): boolean {
    return (this.varianteSeleccionada?.stock ?? 1) === 0;
  }

  get yaEnCarrito(): boolean {
    return this.varianteSeleccionada
      ? this.cartService.estaEnCarrito(this.varianteSeleccionada.variantId)
      : false;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  getColor(v: VarianteResponse): string {
    return v.atributos?.['Color'] ?? '';
  }

  getTalla(v: VarianteResponse): string {
    return v.atributos?.['Talla'] ?? v.atributos?.['Talle'] ?? '';
  }

  isColorActivo(v: VarianteResponse): boolean {
    if (!this.varianteSeleccionada) return false;
    return this.getColor(this.varianteSeleccionada) === this.getColor(v);
  }

  isTallaActiva(v: VarianteResponse): boolean {
    return this.varianteSeleccionada?.variantId === v.variantId;
  }

  getVariantesPorColor(variantes: VarianteResponse[]): VarianteResponse[] {
    const vistos = new Set<string>();
    return variantes.filter((v) => {
      const color = this.getColor(v);
      if (!color || vistos.has(color)) return false;
      vistos.add(color);
      return true;
    });
  }

  getImagenColor(v: VarianteResponse): string {
    const img =
      v.imageModelSetDto?.find((i: any) => i.esPrincipal) ??
      v.imageModelSetDto?.[0];
    return img?.url ?? '';
  }

  calcularDescuento(precio: number, precioPro: number): number {
    return Math.round(((precio - precioPro) / precio) * 100);
  }

  isImagenActiva(img: ImageResponse): boolean {
    return this.imagenActiva?.imageId === img.imageId;
  }

  volver(): void {
    this.router.navigate(['/admin/products']);
  }

  // ─── Agregar al carrito ───────────────────────────────────────────────────

  agregarAlCarrito(): void {
    if (!this.varianteSeleccionada || this.sinStock) return;

    const imgs = this.varianteSeleccionada.imageModelSetDto ?? [];
    const imgProd = this.producto.imageModelSetDto ?? [];
    const imagenUrl = imgs[0]?.url ?? imgProd[0]?.url;

    this.cartService.agregar({
      variantId: this.varianteSeleccionada.variantId,
      sku: this.varianteSeleccionada.sku,
      productoNombre: this.producto.nameProduct,
      descripcion: this.varianteSeleccionada.descripcion,
      precio: this.varianteSeleccionada.precioVenta,
      cantidad: 1,
      imagenUrl,
      stockDisponible: this.varianteSeleccionada.stock,
    });

    // Abrir carrito lateral automáticamente al agregar
    this.carritoVisible = true;
  }
}
