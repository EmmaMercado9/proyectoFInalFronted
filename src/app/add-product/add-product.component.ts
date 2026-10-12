import { apiErrorMessage } from '../error/error-handle.service';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import {
  Observable,
  catchError,
  concatMap,
  finalize,
  from,
  of,
  switchMap,
  toArray,
} from 'rxjs';
import {
  AtributoResponse,
  CategoryResponse,
  ImageResponse,
  ProductRequest,
  ProductResponse,
  ProductUpdateRequest,
  SubCategoriaResponse,
  VarianteRequest,
  VarianteResponse,
} from '../model/product.model';
import { ProductService } from '../services/products.service';
import { CatgoryService } from '../services/catgory.service';
import { ToastModule } from 'primeng/toast';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
// ─── Interface local — no es una entidad JPA, solo ayuda al frontend ─────────
interface AtributoValorLocal {
  atributoId: number;
  nombre: string; // "Talla", "Color"
  valor: string; // "42",   "Negro"
}

@Component({
  selector: 'app-add-product',
  standalone: true,
  templateUrl: './add-product.component.html',
  imports: [
    ReactiveFormsModule,
    ToastModule,
    ConfirmDialogModule,
    FormsModule,
    CommonModule,
    RouterModule,
  ],
})
export class AddProductComponent implements OnInit {
  // Imágenes seleccionadas por variante — clave: índice de la variante en el FormArray
  imagenesVariante: { [index: number]: File[] } = {};
  previewsVariante: { [index: number]: string[] } = {};

  fileInputsVariante: HTMLInputElement[] = [];
  // ─── Formulario principal ─────────────────────────────────────────────────
  formProduct: FormGroup;

  // ─── Estado ───────────────────────────────────────────────────────────────
  edit = false;
  private productId: string | null = null;
  // Valores para completar todas las variantes de una vez
  bulkPrecio: number | null = null;
  bulkCosto: number | null = null;
  bulkStock: number | null = null;
  // Variante default (productos sin variantes): su stock se edita con PATCH
  private varianteDefault: VarianteResponse | null = null;
  // Categoría padre elegida en el <select> (no viaja al backend)
  categoriaSeleccionadaId: number | null = null;
  // Valores (por nombre de atributo) que usan las variantes ya guardadas.
  // Se muestran marcados y bloqueados en "Configurar variantes".
  valoresGuardados: { [atribNombre: string]: Set<string> } = {};
  private productoCargado = false;
  // Fotos ya guardadas en Cloudinary, por índice de variante (solo lectura)
  imagenesExistentesVariante: { [index: number]: string[] } = {};
  isLoading = false;

  // ─── Categorías ───────────────────────────────────────────────────────────
  listCategory: CategoryResponse[] = [];
  subCategories: SubCategoriaResponse[] = [];

  // ─── Atributos — lista plana sin GrupoAtributoEntity ─────────────────────
  //
  //   GET /api/atributos devuelve:
  //   [ { atributoId: 1, nombre: "Talla" },
  //     { atributoId: 2, nombre: "Color" },
  //     { atributoId: 3, nombre: "Material" } ]
  //
  //   NO hay grupoId, NO hay grupoNombre — solo id y nombre.
  //
  atributos: AtributoResponse[] = [];

  // Valores disponibles por atributo. Clave = atributoId.
  // Se precarga con valores típicos del DataSeeder y el usuario puede agregar más.
  valoresPorAtributo: { [atributoId: number]: string[] } = {};

  // Valores que el usuario seleccionó para el producto cartesiano.
  // Clave = nombre del atributo ("Talla", "Color").
  seleccion: { [atribNombre: string]: AtributoValorLocal[] } = {};

  // Texto del input "agregar valor personalizado", uno por atributo.
  nuevoValorInput: { [atributoId: number]: string } = {};

  // Atributo actualmente expandido en el panel (accordion).
  atributoExpandido: AtributoResponse | null = null;

  // ─── Visibilidad del panel lateral ────────────────────────────────────────
  visiblePropiedadModal = false; // panel principal (lista de atributos)
  visibleModalNuevoPropiedad = false; // alias para compatibilidad con el HTML original

  // ─── Imágenes ─────────────────────────────────────────────────────────────
  selectedFiles: File[] = [];
  selectedPreviews: string[] = [];

  // ─── Inyecciones ──────────────────────────────────────────────────────────
  private _productService = inject(ProductService);
  private _categoryService = inject(CatgoryService);
  private confirm = inject(ConfirmationService);

  constructor(
    private fb: FormBuilder,
    private message: MessageService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private activeRoute: ActivatedRoute
  ) {
    this.formProduct = this.fb.group({
      nameProduct: ['', Validators.required],
      codigoBarra: [''],
      sku: [''],
      description: [''],
      marca: ['', Validators.required],
      modelo: [''],
      precioVenta: [null, [Validators.required, Validators.min(0.01)]],
      precioPro: [null],
      costo: [null, [Validators.required, Validators.min(0)]],
      margen: [{ value: null, disabled: true }],
      tieneVariantes: [false],
      stockInicial: [0],
      stockMinimo: [5],
      subCategoriaId: [{ value: null, disabled: true }],
      listVariants: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    const id = this.activeRoute.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.edit = true;
      this.productId = id;
    }

    this.formProduct
      .get('precioVenta')
      ?.valueChanges.subscribe(() => this.calcularMargen());
    this.formProduct
      .get('costo')
      ?.valueChanges.subscribe(() => this.calcularMargen());

    this.cargarCategorias();
    this.cargarAtributos();
  }

  // 4. Agregar métodos de manejo de fotos por variante
  onFilesVariante(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;

    if (!this.imagenesVariante[index]) this.imagenesVariante[index] = [];
    if (!this.previewsVariante[index]) this.previewsVariante[index] = [];

    Array.from(input.files).forEach((file) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        this.showError(`${file.name}: tipo no válido`);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.showError(`${file.name}: supera 2MB`);
        return;
      }
      const yaExiste = this.imagenesVariante[index].some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (yaExiste) return;

      this.imagenesVariante[index].push(file);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewsVariante[index].push(e.target.result);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removeImagenVariante(variantIndex: number, imgIndex: number): void {
    this.imagenesVariante[variantIndex]?.splice(imgIndex, 1);
    this.previewsVariante[variantIndex]?.splice(imgIndex, 1);
    this.cdr.detectChanges();
  }

  getPreviewsVariante(index: number): string[] {
    return this.previewsVariante[index] ?? [];
  }

  getImagenesVariante(index: number): File[] {
    return this.imagenesVariante[index] ?? [];
  }
  limpiarVariantes(): void {
    this.seleccion = {};
    this.quitarVariantesNuevas();
  }

  /** Quita las variantes sin guardar; las existentes no se pueden borrar */
  private quitarVariantesNuevas(): void {
    for (let i = this.listVariants.length - 1; i >= 0; i--) {
      if (!this.listVariants.at(i).value.variantId) this.eliminarVariante(i);
    }
  }
  // ─── Getters ──────────────────────────────────────────────────────────────

  get listVariants(): FormArray {
    return this.formProduct.get('listVariants') as FormArray;
  }

  get tieneVariantes(): boolean {
    return this.formProduct.get('tieneVariantes')?.value ?? false;
  }

  get margen(): number | null {
    return this.formProduct.get('margen')?.value;
  }

  /** Cantidad total de combinaciones que se van a generar */
  get totalCombinaciones(): number {
    const keys = Object.keys(this.seleccion).filter(
      (k) => this.seleccion[k].length > 0
    );
    if (!keys.length) return 0;
    const total = keys.reduce((acc, k) => acc * this.seleccion[k].length, 1);
    // Al editar, las combinaciones que ya tienen variante guardada no se generan
    return total - this.combinacionesGuardadasSeleccionadas(keys);
  }

  /** Variantes guardadas cuyas combinaciones están todas dentro de la selección actual */
  private combinacionesGuardadasSeleccionadas(keys: string[]): number {
    return this.listVariants.controls.filter((c) => {
      if (!c.value.variantId) return false;
      const atribs: AtributoValorLocal[] = c.value.atributos ?? [];
      return (
        atribs.length === keys.length &&
        atribs.every((a) => this.isValorSeleccionado(a.nombre, a.valor))
      );
    }).length;
  }

  /** Resumen textual de lo seleccionado, para mostrar en el panel */
  get resumenSeleccion(): string {
    return Object.entries(this.seleccion)
      .filter(([, vals]) => vals.length > 0)
      .map(
        ([nombre, vals]) => `${nombre}: ${vals.map((v) => v.valor).join(', ')}`
      )
      .join(' · ');
  }

  eliminarVariante(index: number): void {
    this.listVariants.removeAt(index);
    // Limpiar fotos de esa variante y reindexar las demás
    const newImagenes: { [i: number]: File[] } = {};
    const newPreviews: { [i: number]: string[] } = {};
    Object.keys(this.imagenesVariante).forEach((k) => {
      const ki = +k;
      if (ki < index) {
        newImagenes[ki] = this.imagenesVariante[ki];
        newPreviews[ki] = this.previewsVariante[ki];
      } else if (ki > index) {
        newImagenes[ki - 1] = this.imagenesVariante[ki];
        newPreviews[ki - 1] = this.previewsVariante[ki];
      }
    });
    this.imagenesVariante = newImagenes;
    this.previewsVariante = newPreviews;

    const newExistentes: { [i: number]: string[] } = {};
    Object.keys(this.imagenesExistentesVariante).forEach((k) => {
      const ki = +k;
      if (ki < index) newExistentes[ki] = this.imagenesExistentesVariante[ki];
      else if (ki > index) newExistentes[ki - 1] = this.imagenesExistentesVariante[ki];
    });
    this.imagenesExistentesVariante = newExistentes;
  }

  // ─── Variantes guardadas: eliminar / activar (impactan en el momento) ────

  varianteActiva(index: number): boolean {
    return this.listVariants.at(index)?.value.status !== 'INACTIVO';
  }

  /** Borra una variante guardada. El backend lo rechaza si ya tuvo ventas. */
  eliminarVarianteGuardada(index: number): void {
    const g = this.listVariants.at(index).value;
    const nombre = this.getDescripcionVariante(g.atributos) || g.sku;
    this.confirm.confirm({
      header: '¿Eliminar variante?',
      message: `"${nombre}" (${g.sku}) se borrará definitivamente. Si ya tuvo ventas no se podrá: en ese caso desactivala.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this._productService.eliminarVariante(g.variantId).subscribe({
          next: () => {
            this.eliminarVariante(index);
            this.showSuccess(`Variante ${g.sku} eliminada`);
          },
          error: (err) =>
            this.showError(apiErrorMessage(err, 'No se pudo eliminar la variante')),
        });
      },
    });
  }

  toggleEstadoVariante(index: number): void {
    const ctrl = this.listVariants.at(index);
    const activar = !this.varianteActiva(index);
    this._productService
      .cambiarEstadoVariante(ctrl.value.variantId, activar)
      .subscribe({
        next: (v) => {
          ctrl.patchValue({ status: v.status });
          this.showSuccess(
            `Variante ${v.sku} ${activar ? 'activada' : 'desactivada: no se venderá'}`
          );
        },
        error: (err) =>
          this.showError(apiErrorMessage(err, 'No se pudo cambiar el estado')),
      });
  }
  // ─── Carga de datos ───────────────────────────────────────────────────────

  cargarCategorias(): void {
    this._categoryService
      .getCategories()
      .pipe(
        catchError(() => {
          this.showError('Error al cargar categorías');
          return of([]);
        })
      )
      .subscribe((data) => {
        this.listCategory = data;
        if (this.productId) this.cargarProducto(this.productId);
      });
  }

  /**
   * Carga GET /api/atributos — lista plana sin grupos.
   * Respuesta: [ { atributoId: 1, nombre: "Talla" }, ... ]
   */

  /** Valores default por nombre de atributo, igual a lo que carga el DataSeeder */

  cargarProducto(id: string): void {
    this._productService
      .getById(id)
      .pipe(
        catchError(() => {
          this.showError('Error al cargar el producto');
          return of(null);
        })
      )
      .subscribe((p) => {
        if (p) this.cargarFormulario(p);
      });
  }

  // ─── Margen ───────────────────────────────────────────────────────────────

  calcularMargen(): void {
    const precio = +this.formProduct.get('precioVenta')?.value || 0;
    const costo = +this.formProduct.get('costo')?.value || 0;
    if (precio > 0 && costo >= 0) {
      this.formProduct
        .get('margen')
        ?.setValue(Math.round(((precio - costo) / precio) * 100));
    } else {
      this.formProduct.get('margen')?.setValue(null);
    }
  }

  // ─── Categorías ───────────────────────────────────────────────────────────

  onCategoryChange(event: Event): void {
    this.seleccionarCategoria(+(event.target as HTMLSelectElement).value, null);
  }

  private seleccionarCategoria(catId: number | null, subId: number | null): void {
    this.categoriaSeleccionadaId = catId;
    const cat = this.listCategory.find((c) => c.idCategory === catId);
    // Solo subcategorías activas (o la que ya tenía el producto)
    this.subCategories = (cat?.subCategorias ?? []).filter(
      (s) => s.status === 'ACTIVO' || s.subId === subId
    );
    this.formProduct.patchValue({ subCategoriaId: subId });
    this.subCategories.length > 0
      ? this.formProduct.get('subCategoriaId')?.enable()
      : this.formProduct.get('subCategoriaId')?.disable();
  }

  // ─── Toggle variantes ─────────────────────────────────────────────────────

  toggleVariantes(): void {
    // El backend no permite cambiar tieneVariantes de un producto existente
    if (this.edit) return;
    const nuevo = !this.tieneVariantes;
    this.formProduct.patchValue({ tieneVariantes: nuevo });
    this.actualizarValidadoresPrecio();
    if (!nuevo) {
      this.listVariants.clear();
      this.seleccion = {};
      this.atributoExpandido = null;
    }
  }

  /**
   * Con variantes, precio y costo se cargan en cada variante (la sección de
   * precios del producto se oculta), así que dejan de ser obligatorios acá.
   */
  private actualizarValidadoresPrecio(): void {
    const conVariantes = this.tieneVariantes;
    const precio = this.formProduct.get('precioVenta');
    const costo = this.formProduct.get('costo');
    precio?.setValidators(
      conVariantes ? null : [Validators.required, Validators.min(0.01)]
    );
    costo?.setValidators(
      conVariantes ? null : [Validators.required, Validators.min(0)]
    );
    precio?.updateValueAndValidity();
    costo?.updateValueAndValidity();
  }

  /** Fila de la tabla de variantes: precio y costo propios, obligatorios */
  private crearGrupoVariante(v: {
    variantId?: number | null;
    sku: string;
    codigoBarra?: string;
    precioVenta?: number | null;
    precioPro?: number | null;
    costo?: number | null;
    stock: number;
    stockMinimo: number;
    atributos: AtributoValorLocal[];
    status?: string;
  }): FormGroup {
    return this.fb.group({
      variantId: [v.variantId ?? null],
      status: [v.status ?? 'ACTIVO'],
      stockOriginal: [v.variantId ? v.stock : null],
      sku: [v.sku, Validators.required],
      codigoBarra: [v.codigoBarra ?? ''],
      precioVenta: [v.precioVenta ?? null, [Validators.required, Validators.min(0.01)]],
      precioPro: [v.precioPro ?? null, Validators.min(0)],
      costo: [v.costo ?? null, [Validators.required, Validators.min(0)]],
      stock: [v.stock, [Validators.required, Validators.min(0)]],
      stockMinimo: [v.stockMinimo, Validators.min(0)],
      atributos: [v.atributos],
    });
  }

  /** Completa precio / costo / stock en todas las variantes (solo los campos cargados) */
  aplicarATodas(): void {
    const patch: Record<string, number> = {};
    if (this.bulkPrecio !== null && `${this.bulkPrecio}` !== '') patch['precioVenta'] = +this.bulkPrecio;
    if (this.bulkCosto !== null && `${this.bulkCosto}` !== '') patch['costo'] = +this.bulkCosto;
    if (this.bulkStock !== null && `${this.bulkStock}` !== '') patch['stock'] = +this.bulkStock;
    if (!Object.keys(patch).length) return;
    this.listVariants.controls.forEach((c) => {
      c.patchValue(patch);
      c.markAsDirty();
    });
  }

  /** Margen % de una variante según su precio y costo */
  margenVariante(index: number): number | null {
    const { precioVenta, costo } = this.listVariants.at(index)?.value ?? {};
    const precio = +precioVenta;
    if (!precio || costo === null || costo === '' || costo === undefined) return null;
    return Math.round(((precio - +costo) / precio) * 100);
  }

  /**
   * El backend exige precioVenta (> 0) y costo en el producto. Si tiene
   * variantes, se usan los más bajos de las variantes ("desde $X" en listados);
   * cada variante guarda igual su propio precio y costo.
   */
  private preciosProducto(val: any): {
    precioVenta: number;
    costo: number;
    precioPro?: number;
  } {
    if (!val.tieneVariantes) {
      return {
        precioVenta: +val.precioVenta,
        costo: +val.costo,
        precioPro: val.precioPro || undefined,
      };
    }
    const variantes = this.listVariants.getRawValue();
    return {
      precioVenta: Math.min(...variantes.map((v: any) => +v.precioVenta)),
      costo: Math.min(...variantes.map((v: any) => +v.costo)),
    };
  }

  // ─── Imágenes ─────────────────────────────────────────────────────────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach((file) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        this.showError(`${file.name}: tipo no válido`);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.showError(`${file.name}: supera 2MB`);
        return;
      }
      if (
        this.selectedFiles.some(
          (f) => f.name === file.name && f.size === file.size
        )
      )
        return;
      this.selectedFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e: any) => this.selectedPreviews.push(e.target.result);
      reader.readAsDataURL(file);
    });
    input.value = '';
  }

  removeImage(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.selectedPreviews.splice(index, 1);
  }

  // ─── Panel de variantes — lógica ─────────────────────────────────────────

  /** Expande / colapsa un atributo en el accordion del panel */
  toggleAtributoExpandido(atrib: AtributoResponse): void {
    this.atributoExpandido =
      this.atributoExpandido?.atributoId === atrib.atributoId ? null : atrib;
  }

  isExpandido(atrib: AtributoResponse): boolean {
    return this.atributoExpandido?.atributoId === atrib.atributoId;
  }

  /** ¿Está este valor seleccionado para este atributo? */
  isValorSeleccionado(atribNombre: string, valor: string): boolean {
    return this.seleccion[atribNombre]?.some((v) => v.valor === valor) ?? false;
  }
  /** Hay variantes guardadas: solo se pueden usar sus mismos atributos */
  private get hayGuardadas(): boolean {
    return Object.keys(this.valoresGuardados).length > 0;
  }

  /** El atributo no lo usan las variantes existentes: combinarlo las dejaría incoherentes */
  atributoNoUsado(atrib: AtributoResponse): boolean {
    return this.edit && this.hayGuardadas && !this.valoresGuardados[atrib.nombre];
  }

  esValorGuardado(atrib: AtributoResponse, valor: string): boolean {
    return !!this.valoresGuardados[atrib.nombre]?.has(valor);
  }

  puedeSeleccionar(atrib: AtributoResponse): boolean {
    if (this.atributoNoUsado(atrib)) return false;
    // Si el atributo es "Talla", verificar que "Talle" no esté seleccionado
    if (atrib.nombre === 'Talla') {
      return !(this.seleccion['Talle']?.length > 0);
    }
    // Si el atributo es "Talle", verificar que "Talla" no esté seleccionado
    if (atrib.nombre === 'Talle') {
      return !(this.seleccion['Talla']?.length > 0);
    }
    return true;
  }

  // Modificar toggleValor para respetar la restricción
  toggleValor(atrib: AtributoResponse, valor: string, checked: boolean): void {
    // Verificar conflicto Talla/Talle
    if (!checked && this.esValorGuardado(atrib, valor)) {
      this.showError(
        `Ya hay una variante guardada con ${atrib.nombre} ${valor}. ` +
          `Para quitarla, eliminala o desactivala desde la tabla.`
      );
      return;
    }
    if (checked && this.atributoNoUsado(atrib)) {
      this.showError(
        `Las variantes de este producto no usan "${atrib.nombre}". ` +
          `Solo podés agregar valores de los atributos que ya tiene.`
      );
      return;
    }
    if (checked && !this.puedeSeleccionar(atrib)) {
      const conflicto = atrib.nombre === 'Talla' ? 'Talle' : 'Talla';
      this.showError(
        `No podés combinar "${atrib.nombre}" con "${conflicto}". ` +
          `Desseleccioná todos los valores de "${conflicto}" primero.`
      );
      return;
    }

    if (!this.seleccion[atrib.nombre]) this.seleccion[atrib.nombre] = [];

    if (checked) {
      const existe = this.seleccion[atrib.nombre].some(
        (v) => v.valor === valor
      );
      if (!existe) {
        this.seleccion[atrib.nombre].push({
          atributoId: atrib.atributoId,
          nombre: atrib.nombre,
          valor,
        });
      }
    } else {
      this.seleccion[atrib.nombre] = this.seleccion[atrib.nombre].filter(
        (v) => v.valor !== valor
      );
      if (!this.seleccion[atrib.nombre].length) {
        delete this.seleccion[atrib.nombre];
      }
    }
  }

  /** El usuario escribe un valor personalizado y lo agrega */
  agregarValorCustom(atrib: AtributoResponse): void {
    const val = (this.nuevoValorInput[atrib.atributoId] ?? '').trim();
    if (!val) return;
    if (!this.valoresPorAtributo[atrib.atributoId]) {
      this.valoresPorAtributo[atrib.atributoId] = [];
    }
    if (!this.valoresPorAtributo[atrib.atributoId].includes(val)) {
      this.valoresPorAtributo[atrib.atributoId].push(val);
    }
    // Lo seleccionamos automáticamente
    this.toggleValor(atrib, val, true);
    this.nuevoValorInput[atrib.atributoId] = '';
  }

  /**
   * Genera el producto cartesiano de todos los atributos seleccionados
   * y llena el FormArray listVariants con una fila por combinación.
   *
   * Ejemplo: Talla [40, 42] × Color [Negro, Rojo] = 4 variantes
   */
  generarVariantes(): void {
    const grupos = Object.keys(this.seleccion).filter(
      (k) => this.seleccion[k].length > 0
    );

    if (!grupos.length) {
      this.quitarVariantesNuevas();
      this.visiblePropiedadModal = false;
      return;
    }

    let combinaciones: AtributoValorLocal[][] = this.seleccion[grupos[0]].map(
      (v) => [{ ...v }]
    );

    for (let i = 1; i < grupos.length; i++) {
      const nuevas: AtributoValorLocal[][] = [];
      for (const combo of combinaciones) {
        for (const atrib of this.seleccion[grupos[i]]) {
          nuevas.push([...combo, { ...atrib }]);
        }
      }
      combinaciones = nuevas;
    }

    const skuBase = (this.formProduct.get('sku')?.value ?? 'VAR').toString();

    // Las variantes ya guardadas (con variantId) se conservan: el backend no
    // permite borrarlas ni cambiar sus atributos. Solo se regeneran las nuevas.
    this.quitarVariantesNuevas();
    const existentes = new Set(
      this.listVariants.controls.map((c) => this.firma(c.value.atributos))
    );

    combinaciones.forEach((combo) => {
      if (existentes.has(this.firma(combo))) return;
      const sufijo = combo
        .map((a) => a.valor.toUpperCase().replace(/\s+/g, '').slice(0, 4))
        .join('-');

      this.listVariants.push(
        this.crearGrupoVariante({
          sku: `${skuBase}-${sufijo}`,
          // Si se cargó un precio/costo para "aplicar a todas", se usa de inicio
          precioVenta: this.bulkPrecio,
          costo: this.bulkCosto,
          stock: this.bulkStock ?? 0,
          stockMinimo: 5,
          atributos: combo,
        })
      );
    });

    this.visiblePropiedadModal = false;
    this.visibleModalNuevoPropiedad = false;
    this.atributoExpandido = null;
    this.cdr.detectChanges();
  }

  /** Identifica una combinación por "nombre:valor" sin importar el orden */
  private firma(atributos: AtributoValorLocal[]): string {
    return (atributos ?? [])
      .map((a) => `${a.nombre}:${a.valor}`.toLowerCase())
      .sort()
      .join('|');
  }

  esVarianteGuardada(index: number): boolean {
    return !!this.listVariants.at(index)?.value.variantId;
  }

  getImagenesExistentes(index: number): string[] {
    return this.imagenesExistentesVariante[index] ?? [];
  }

  getDescripcionVariante(atributos: AtributoValorLocal[]): string {
    if (!atributos || !atributos.length) return '';
    return atributos.map((a) => `${a.nombre}: ${a.valor}`).join(' / ');
  }
  // ─── Guardar ──────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.tieneVariantes && this.listVariants.length === 0) {
      this.showError('Generá al menos una variante con "Configurar variantes"');
      return;
    }
    if (this.formProduct.invalid) {
      this.formProduct.markAllAsTouched();
      this.showError(
        this.tieneVariantes && this.listVariants.invalid
          ? 'Cada variante necesita SKU, precio de venta y costo'
          : 'Completá los campos obligatorios'
      );
      return;
    }
    this.edit ? this.editarProducto() : this.crearProducto();
  }

  crearProducto(): void {
    this.isLoading = true;
    const val = this.formProduct.getRawValue();

    const dto: ProductRequest = {
      nameProduct: val.nameProduct,
      codigoBarra: val.codigoBarra || undefined,
      sku: val.sku || undefined,
      description: val.description || undefined,
      marca: val.marca,
      modelo: val.modelo || undefined,
      ...this.preciosProducto(val),
      tieneVariantes: val.tieneVariantes,
      subCategoriaId: val.subCategoriaId ? +val.subCategoriaId : undefined,
      stockInicial: !val.tieneVariantes ? val.stockInicial : undefined,
      stockMinimo: !val.tieneVariantes ? val.stockMinimo : undefined,
    };

    this._productService
      .crearProducto(dto, this.selectedFiles)
      .pipe(
        catchError((err) => {
          this.isLoading = false;
          this.showError(apiErrorMessage(err, 'Error al crear el producto'));
          return of(null);
        })
      )
      .subscribe((producto) => {
        if (!producto) return;
        if (val.tieneVariantes && this.listVariants.length > 0) {
          this.crearVariantesSecuencialmente(producto.idProduct, 0);
        } else {
          this.isLoading = false;
          // El aviso se muestra al llegar: el toast de esta pantalla se destruye al navegar
          this.router
            .navigate(['/admin/products'])
            .then(() => this.showSuccess('Producto creado correctamente'));
        }
      });
  }

  /** Crea las variantes una por una (secuencial, no paralelo) */
  private crearVariantesSecuencialmente(
    productId: string,
    index: number
  ): void {
    if (index >= this.listVariants.length) {
      this.isLoading = false;
      // El aviso se muestra al llegar: el toast de esta pantalla se destruye al navegar
      this.router
        .navigate(['/admin/products'])
        .then(() => this.showSuccess('Producto y variantes creados correctamente'));
      return;
    }

    const dto = this.toVarianteRequest(this.listVariants.at(index).value);
    const files = this.getImagenesVariante(index);

    this._productService
      .agregarVariante(productId, dto, files)
      .pipe(
        catchError((err) => {
          this.isLoading = false;
          this.showError(
            `Error en variante ${index + 1}: ${apiErrorMessage(err, 'no se pudo crear')}`
          );
          return of(null);
        })
      )
      .subscribe((variante) => {
        if (!variante) return;

        this.crearVariantesSecuencialmente(productId, index + 1);
      });
  }
  // ─── Helpers ──────────────────────────────────────────────────────────────

  hasError(campo: string, tipo: string): boolean {
    const ctrl = this.formProduct.get(campo);
    return !!(ctrl?.hasError(tipo) && ctrl?.touched);
  }

  showSuccess(msg: string): void {
    this.message.add({
      severity: 'success',
      summary: 'Éxito',
      detail: msg,
      life: 3000,
    });
  }

  showError(msg: string): void {
    this.message.add({
      severity: 'error',
      summary: 'Error',
      detail: msg,
      life: 4000,
    });
  }

  // ─── AGREGAR en la clase AddProductComponent ──────────────────────────────

  // Valor que se está editando. Clave: "atributoId-valor"
  valorEnEdicion: { [key: string]: string } = {};

  /** Activa el modo edición de un chip */
  iniciarEdicion(atrib: AtributoResponse, valor: string): void {
    if (this.esValorGuardado(atrib, valor)) {
      this.showError(`${atrib.nombre} ${valor} lo usa una variante guardada: no se puede renombrar`);
      return;
    }
    const key = `${atrib.atributoId}-${valor}`;
    this.valorEnEdicion[key] = valor;
  }

  /** Verifica si un chip está en modo edición */
  estaEnEdicion(atrib: AtributoResponse, valor: string): boolean {
    const key = `${atrib.atributoId}-${valor}`;
    return key in this.valorEnEdicion;
  }

  /** Guarda el nuevo valor editado */
  guardarEdicion(
    atrib: AtributoResponse,
    valorOriginal: string,
    event?: Event
  ): void {
    const key = `${atrib.atributoId}-${valorOriginal}`;
    const nuevoValor = (this.valorEnEdicion[key] ?? '').trim();

    // Cancelar si viene vacío
    if (!nuevoValor) {
      this.cancelarEdicion(atrib, valorOriginal);
      return;
    }

    // Cancelar si es igual al original (no cambió nada)
    if (nuevoValor === valorOriginal) {
      this.cancelarEdicion(atrib, valorOriginal);
      return;
    }

    // Verificar que no exista ya ese valor
    if (this.valoresPorAtributo[atrib.atributoId].includes(nuevoValor)) {
      this.showError(`El valor "${nuevoValor}" ya existe en ${atrib.nombre}`);
      this.cancelarEdicion(atrib, valorOriginal);
      return;
    }

    // 1. Reemplazar en la lista de disponibles
    const idx =
      this.valoresPorAtributo[atrib.atributoId].indexOf(valorOriginal);
    if (idx >= 0) {
      this.valoresPorAtributo[atrib.atributoId][idx] = nuevoValor;
    }

    // 2. Reemplazar en la selección si estaba seleccionado
    if (this.seleccion[atrib.nombre]) {
      const sel = this.seleccion[atrib.nombre].find(
        (v) => v.valor === valorOriginal
      );
      if (sel) sel.valor = nuevoValor;
    }

    // 3. Reemplazar en las variantes ya generadas en el FormArray
    this.listVariants.controls.forEach((ctrl) => {
      const atributos: AtributoValorLocal[] = ctrl.value.atributos ?? [];
      const a = atributos.find(
        (x) => x.atributoId === atrib.atributoId && x.valor === valorOriginal
      );
      if (a) {
        a.valor = nuevoValor;
        // Forzar detección de cambios en el FormArray
        ctrl.patchValue({ atributos: [...atributos] });
      }
    });

    delete this.valorEnEdicion[key];
  }

  /** Cancela la edición sin guardar */
  cancelarEdicion(atrib: AtributoResponse, valor: string): void {
    const key = `${atrib.atributoId}-${valor}`;
    delete this.valorEnEdicion[key];
  }

  /** Maneja Enter y Escape en el input de edición */
  onEdicionKeydown(
    event: KeyboardEvent,
    atrib: AtributoResponse,
    valor: string
  ): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.guardarEdicion(atrib, valor);
    }
    if (event.key === 'Escape') {
      this.cancelarEdicion(atrib, valor);
    }
  }

  /** Elimina un valor de la lista y lo deselecciona */
  eliminarValor(atrib: AtributoResponse, valor: string): void {
    if (this.esValorGuardado(atrib, valor)) {
      this.showError(`${atrib.nombre} ${valor} lo usa una variante guardada`);
      return;
    }
    this.valoresPorAtributo[atrib.atributoId] = this.valoresPorAtributo[
      atrib.atributoId
    ].filter((v) => v !== valor);

    if (this.seleccion[atrib.nombre]) {
      this.seleccion[atrib.nombre] = this.seleccion[atrib.nombre].filter(
        (v) => v.valor !== valor
      );
      if (!this.seleccion[atrib.nombre].length) {
        delete this.seleccion[atrib.nombre];
      }
    }
  }

  /** Placeholder de ejemplo según el nombre del atributo */
  ejemploValor(nombre: string): string {
    const mapa: { [k: string]: string } = {
      Talla: '40',
      Talle: 'M',
      Color: 'Negro',
      Material: 'Cuero',
    };
    return mapa[nombre] ?? 'valor';
  }

  cargarAtributos(): void {
    this._productService
      .getAtributos()
      .pipe(
        catchError(() => {
          this.showError('Error al cargar atributos');
          return of([]);
        })
      )
      .subscribe((data) => {
        this.atributos = data;

        // Valores default por atributo — el usuario los puede editar en el panel
        const nuevosValores: { [atributoId: number]: string[] } = {};
        data.forEach((a) => {
          nuevosValores[a.atributoId] = this.valoresDefault(a.nombre);
        });
        this.valoresPorAtributo = nuevosValores;
        if (this.productoCargado) this.sincronizarConGuardadas();
        this.cdr.detectChanges();
      });
  }

  private valoresDefault(nombre: string): string[] {
    const mapa: { [k: string]: string[] } = {
      Talla: ['36', '37', '38', '39', '40', '41', '42', '43', '44'],
      Talle: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      Color: ['Negro', 'Blanco', 'Rojo', 'Azul', 'Verde', 'Amarillo'],
      Material: ['Cuero', 'Tela', 'Sintético', 'Goma'],
    };
    return mapa[nombre] ?? [];
  }
  // Borrar el método valoresDefault() que tenés actualmente

  // PUT del producto y, en secuencia, las operaciones de cada variante
  editarProducto(): void {
    const id = this.productId;
    if (!id) return;
    this.isLoading = true;
    const val = this.formProduct.getRawValue();

    const dto: ProductUpdateRequest = {
      nameProduct: val.nameProduct,
      codigoBarra: val.codigoBarra || undefined,
      sku: val.sku || undefined,
      description: val.description || undefined,
      marca: val.marca,
      modelo: val.modelo || undefined,
      ...this.preciosProducto(val),
      subCategoriaId: val.subCategoriaId ? +val.subCategoriaId : undefined,
    };

    this._productService
      .actualizar(id, dto)
      .pipe(
        switchMap(() => {
          const ops = this.operacionesVariantes(id, val);
          return ops.length
            ? from(ops).pipe(concatMap((op) => op), toArray())
            : of([]);
        }),
        finalize(() => (this.isLoading = false))
      )
      .subscribe({
        next: () => {
          // El aviso se muestra al llegar: el toast de esta pantalla se destruye al navegar
          this.router
            .navigate(['/admin/products'])
            .then(() => this.showSuccess('Producto actualizado correctamente'));
        },
        error: (err) =>
          this.showError(apiErrorMessage(err, 'Error al actualizar el producto')),
      });
  }

  private operacionesVariantes(productId: string, val: any): Observable<unknown>[] {
    const ops: Observable<unknown>[] = [];

    // Producto simple: stock y stock mínimo viven en la variante default
    if (!val.tieneVariantes) {
      const def = this.varianteDefault;
      if (!def) return ops;
      if (+val.stockInicial !== def.stock) {
        ops.push(this._productService.actualizarStock(def.variantId, +val.stockInicial));
      }
      if (+val.stockMinimo !== def.stockMinimo) {
        ops.push(
          this._productService.actualizarVariante(def.variantId, {
            sku: def.sku,
            codigoBarra: def.codigoBarra || undefined,
            stockMinimo: +val.stockMinimo,
          })
        );
      }
      return ops;
    }

    this.listVariants.controls.forEach((ctrl, i) => {
      const g = ctrl.value;
      const files = this.getImagenesVariante(i);

      if (!g.variantId) {
        // Variante nueva
        ops.push(
          this._productService.agregarVariante(productId, this.toVarianteRequest(g), files)
        );
        return;
      }

      ops.push(
        this._productService.actualizarVariante(g.variantId, {
          sku: g.sku,
          codigoBarra: g.codigoBarra || undefined,
          precioVenta: +g.precioVenta,
          precioPro: g.precioPro || null,
          costo: +g.costo,
          stockMinimo: +g.stockMinimo,
        })
      );
      if (+g.stock !== g.stockOriginal) {
        ops.push(this._productService.actualizarStock(g.variantId, +g.stock));
      }
      if (files.length) {
        ops.push(this._productService.subirImagenesVariante(g.variantId, files));
      }
    });
    return ops;
  }

  private toVarianteRequest(g: any): VarianteRequest {
    return {
      sku: g.sku,
      codigoBarra: g.codigoBarra || undefined,
      precioVenta: +g.precioVenta,
      precioPro: g.precioPro || undefined,
      costo: +g.costo,
      stock: +g.stock,
      stockMinimo: +g.stockMinimo,
      atributos: (g.atributos as AtributoValorLocal[]).map((a) => ({
        atributoId: a.atributoId,
        valor: a.valor,
      })),
    };
  }

  tieneTallaOTalle(): boolean {
    return (
      (this.seleccion['Talla']?.length ?? 0) > 0 ||
      (this.seleccion['Talle']?.length ?? 0) > 0
    );
  }
  cargarFormulario(producto: ProductResponse): void {
    this.formProduct.patchValue({
      nameProduct: producto.nameProduct,
      codigoBarra: producto.codigoBarra,
      sku: producto.sku,
      description: producto.description,
      marca: producto.marca,
      modelo: producto.modelo,
      precioVenta: producto.precioVenta,
      precioPro: producto.precioPro,
      costo: producto.costo,
      tieneVariantes: producto.tieneVariantes,
    });

    this.actualizarValidadoresPrecio();

    // Preseleccionar categoría padre y subcategoría
    const cat = this.listCategory.find((c) =>
      c.subCategorias?.some((s) => s.subId === producto.subCategoriaId)
    );
    this.seleccionarCategoria(cat?.idCategory ?? null, producto.subCategoriaId ?? null);

    // Fotos existentes: la URL ya es absoluta (Cloudinary)
    this.selectedPreviews = (producto.imageModelSetDto ?? []).map((img) => img.url);

    // Producto simple: stock en la variante default
    this.varianteDefault =
      (producto.variantes ?? []).find((v) => v.esDefault) ?? null;
    if (!producto.tieneVariantes && this.varianteDefault) {
      this.formProduct.patchValue({
        stockInicial: this.varianteDefault.stock,
        stockMinimo: this.varianteDefault.stockMinimo,
      });
    }

    // Cargar variantes existentes (solo las no-default)
    this.listVariants.clear();
    this.imagenesExistentesVariante = {};
    (producto.variantes ?? [])
      .filter((v) => !v.esDefault)
      .forEach((v, i) => {
        this.imagenesExistentesVariante[i] = (v.imageModelSetDto ?? []).map(
          (img) => img.url
        );
        const atributos: AtributoValorLocal[] = Object.entries(v.atributos).map(
          ([nombre, valor]) => {
            const a = this.atributos.find((x) => x.nombre === nombre);
            return { atributoId: a?.atributoId ?? 0, nombre, valor };
          }
        );

        this.listVariants.push(
          this.crearGrupoVariante({
            variantId: v.variantId,
            sku: v.sku,
            codigoBarra: v.codigoBarra ?? '',
            precioVenta: v.precioVenta,
            precioPro: v.precioPro,
            costo: v.costo ?? null,
            stock: v.stock,
            stockMinimo: v.stockMinimo,
            atributos,
            status: v.status,
          })
        );
      });

    this.productoCargado = true;
    if (this.atributos.length) this.sincronizarConGuardadas();
  }

  /**
   * Marca en "Configurar variantes" los valores de las variantes guardadas y
   * corrige su atributoId (los atributos pueden llegar después que el producto).
   */
  private sincronizarConGuardadas(): void {
    this.valoresGuardados = {};
    this.seleccion = {};

    this.listVariants.controls.forEach((ctrl) => {
      if (!ctrl.value.variantId) return;
      const atributos: AtributoValorLocal[] = (ctrl.value.atributos ?? []).map(
        (a: AtributoValorLocal) => {
          const atrib = this.atributos.find(
            (x) => x.nombre.toLowerCase() === a.nombre.toLowerCase()
          );
          return { ...a, atributoId: atrib?.atributoId ?? a.atributoId, nombre: atrib?.nombre ?? a.nombre };
        }
      );
      ctrl.patchValue({ atributos }, { emitEvent: false });

      atributos.forEach((a) => {
        (this.valoresGuardados[a.nombre] ??= new Set()).add(a.valor);
        if (!this.isValorSeleccionado(a.nombre, a.valor)) {
          (this.seleccion[a.nombre] ??= []).push({ ...a });
        }
        const lista = (this.valoresPorAtributo[a.atributoId] ??= []);
        if (!lista.includes(a.valor)) lista.push(a.valor);
      });
    });
  }

  getSeleccionLength(atribNombre: string): number {
    return this.seleccion[atribNombre]?.length ?? 0;
  }
}
