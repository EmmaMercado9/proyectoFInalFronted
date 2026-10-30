import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MessageService } from 'primeng/api';
import { finalize } from 'rxjs';

import {
  FacturaImportada,
  ImportacionFactura,
  ImportacionFacturaService,
  ModeloImportado,
  ResultadoImportacion,
} from '../services/importacion-factura.service';
import { CatgoryService } from '../services/catgory.service';
import { SubCategoriaResponse } from '../model/product.model';
import { ErrorHandleService } from '../error/error-handle.service';

/**
 * Importar productos desde la factura PDF de un proveedor:
 * 1) se sube el PDF y el backend devuelve la vista previa agrupada por modelo;
 * 2) el usuario revisa (nombre, subcategoría, precio, talles) y confirma.
 */
@Component({
  selector: 'app-importar-factura',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './importar-factura.component.html',
})
export class ImportarFacturaComponent implements OnInit {
  private importacion = inject(ImportacionFacturaService);
  private categorias = inject(CatgoryService);
  private message = inject(MessageService);
  private errorService = inject(ErrorHandleService);
  private router = inject(Router);

  archivo: File | null = null;
  leyendo = false;
  confirmando = false;
  arrastrando = false;

  vista: ImportacionFactura | null = null;
  resultado: ResultadoImportacion | null = null;
  revisoDiferencia = false; // obligatorio si la suma no coincide con el total
  subcategorias: (SubCategoriaResponse & { etiqueta: string })[] = [];
  subcategoriaGeneral: number | null = null;
  historial: FacturaImportada[] = [];
  cargandoHistorial = true;

  ngOnInit(): void {
    this.cargarHistorial();
    this.categorias.getCategories().subscribe({
      next: (cats) =>
        (this.subcategorias = cats.flatMap((c) =>
          (c.subCategorias ?? []).map((s) => ({ ...s, etiqueta: `${c.nameCategory} › ${s.nombre}` }))
        )),
    });
  }

  cargarHistorial(): void {
    this.cargandoHistorial = true;
    this.importacion
      .listar()
      .pipe(finalize(() => (this.cargandoHistorial = false)))
      .subscribe({ next: (h) => (this.historial = h), error: () => (this.historial = []) });
  }

  // ─── Paso 1: elegir y leer el PDF ─────────────────────────────────────────

  elegir(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.leer(input.files[0]);
    input.value = '';
  }

  soltar(event: DragEvent): void {
    event.preventDefault();
    this.arrastrando = false;
    const f = event.dataTransfer?.files?.[0];
    if (f) this.leer(f);
  }

  leer(archivo: File): void {
    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
      this.message.add({ severity: 'warn', summary: 'Archivo', detail: 'Elegí un archivo PDF.', life: 3000 });
      return;
    }
    this.archivo = archivo;
    this.vista = null;
    this.resultado = null;
    this.revisoDiferencia = false;
    this.leyendo = true;
    this.importacion
      .leer(archivo)
      .pipe(finalize(() => (this.leyendo = false)))
      .subscribe({
        next: (v) => (this.vista = v),
        error: (err) => this.message.add(this.errorService.toMessage(err, 'No se pudo leer la factura')),
      });
  }

  // ─── Vista previa ──────────────────────────────────────────────────────────

  esNuevo(m: ModeloImportado): boolean {
    return !m.productoId;
  }

  aplicarSubcategoria(): void {
    this.vista?.modelos.filter((m) => this.esNuevo(m)).forEach((m) => (m.subCategoriaId = this.subcategoriaGeneral));
  }

  unidades(m: ModeloImportado): number {
    return m.talles.reduce((a, t) => a + t.cantidad, 0);
  }

  get productosNuevos(): number {
    return this.vista?.modelos.filter((m) => this.esNuevo(m)).length ?? 0;
  }

  get variantesNuevas(): number {
    return this.vista?.modelos.reduce((a, m) => a + m.talles.filter((t) => !t.varianteId).length, 0) ?? 0;
  }

  get puedeConfirmar(): boolean {
    const v = this.vista;
    if (!v || v.yaImportada || this.confirmando) return false;
    if (!v.totalCoincide && !this.revisoDiferencia) return false;
    return v.modelos.every(
      (m) => m.nombre?.trim() && m.precioVenta > 0 && m.talles.every((t) => t.talle?.trim())
    );
  }

  // ─── Paso 2: confirmar ─────────────────────────────────────────────────────

  confirmar(): void {
    if (!this.vista || !this.puedeConfirmar) return;
    this.confirmando = true;
    this.importacion
      .confirmar(this.vista)
      .pipe(finalize(() => (this.confirmando = false)))
      .subscribe({
        next: (r) => {
          this.resultado = r;
          this.cargarHistorial();
          this.message.add({
            severity: 'success',
            summary: 'Factura importada',
            detail: `${r.unidades} unidades cargadas`,
            life: 4000,
          });
        },
        error: (err) => this.message.add(this.errorService.toMessage(err, 'No se pudo importar la factura')),
      });
  }

  otra(): void {
    this.archivo = null;
    this.vista = null;
    this.resultado = null;
  }

  irAlInventario(): void {
    this.router.navigate(['/admin/products']);
  }
}
