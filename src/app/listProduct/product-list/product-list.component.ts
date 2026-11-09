import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { EMPTY, catchError, forkJoin, map, of, debounceTime, Subject, Subscription } from 'rxjs';
import {
  CategoryResponse,
  ProductListadoDTO,
  ProductResponse,
  VarianteResponse,
} from '../../model/product.model';
import { ProductService } from '../../services/products.service';
import { CatgoryService } from '../../services/catgory.service';
import { UserService } from '../../services/user.service';
import { ErrorHandleService } from '../../error/error-handle.service';
import { EscanerService } from '../../shared/escaner/escaner.service';
import { EscanerToggleComponent } from '../../shared/escaner/escaner-toggle.component';
import { CamaraLectorComponent } from '../../shared/escaner/camara-lector.component';

/** Lo último leído con la pistola */
interface Escaneado {
  codigo: string;
  producto: ProductResponse;
  variante?: VarianteResponse;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  templateUrl: './product-list.component.html',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ToastModule,
    ConfirmDialogModule,
    EscanerToggleComponent,
    CamaraLectorComponent,
  ],
})
export class ProductListComponent implements OnInit, OnDestroy {
  // ─── Datos ───────────────────────────────────────────────────────────────
  productos: ProductListadoDTO[] = [];
  listCategory: CategoryResponse[] = [];
  isLoading = true;
  totalElementos = 0;

  // ─── Filtros ─────────────────────────────────────────────────────────────
  busqueda = '';
  statusFiltro = 'ACTIVO';
  catFiltro: number | null = null;
  marcaFiltro = '';
  talleFiltro = '';
  colorFiltro = '';
  stockFiltro = '';
  opciones: { marcas: string[]; talles: string[]; colores: string[] } = { marcas: [], talles: [], colores: [] };
  page = 0;
  size = 12;

  // ─── Métricas rápidas ────────────────────────────────────────────────────
  totalProductos = 0;
  conVariantes = 0;
  stockBajoCount = 0;
  sinStockCount = 0;

  // ─── Búsqueda con debounce ───────────────────────────────────────────────
  private searchSubject = new Subject<string>();

  // ─── Lector de códigos ───────────────────────────────────────────────────
  escaneado: Escaneado | null = null;
  private escaner = inject(EscanerService);
  private subs: Subscription[] = [];
  private metricasSub?: Subscription;

  // ─── Inyecciones ─────────────────────────────────────────────────────────
  private productService = inject(ProductService);
  private categoryService = inject(CatgoryService);
  private router = inject(Router);
  private message = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private errorService = inject(ErrorHandleService);

  // Alta, edición y (des)activación son solo ADMIN; el COLABORADOR consulta
  readonly esAdmin = inject(UserService).isAdmin();

  // ─────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.cargarCategorias();
    this.productService.opcionesFiltro().pipe(catchError(() => EMPTY)).subscribe((o) => (this.opciones = o));
    this.cargarProductos();

    // Debounce en búsqueda — espera 400ms antes de buscar
    this.subs.push(
      this.searchSubject.pipe(debounceTime(400)).subscribe(() => {
        this.page = 0;
        this.cargarProductos();
      })
    );

    // Pistola lectora: solo con la casilla "Lector de códigos" tildada
    this.subs.push(this.escaner.codigos$.subscribe((c) => this.buscarPorCodigo(c)));
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.metricasSub?.unsubscribe();
  }

  // ─── Lector de códigos ───────────────────────────────────────────────────

  /** Busca el código exacto (variante o producto); si no está, lo busca como texto */
  buscarPorCodigo(codigo: string): void {
    this.productService
      .buscarPorBarcode(codigo)
      .pipe(catchError(() => of(null)))
      .subscribe((data: any) => {
        if (data?.producto) {
          this.escaner.pitido(true);
          this.escaneado = { codigo, producto: data.producto, variante: data.variante };
          return;
        }
        this.escaner.pitido(false);
        this.escaneado = null;
        this.message.add({
          severity: 'warn',
          summary: 'Código no registrado',
          detail: `Ningún producto tiene el código ${codigo}. Se buscó como texto.`,
          life: 4000,
        });
        this.busqueda = codigo;
        this.statusFiltro = '';
        this.page = 0;
        this.cargarProductos();
      });
  }

  /** Stock y precio de lo escaneado: los de la variante, o los del producto */
  get escaneadoStock(): number {
    const e = this.escaneado;
    return e ? (e.variante?.stock ?? e.producto.stockTotal) : 0;
  }

  get escaneadoPrecio(): number {
    const e = this.escaneado;
    return e ? (e.variante?.precioVenta ?? e.producto.precioVenta) : 0;
  }

  get escaneadoBajo(): boolean {
    const e = this.escaneado;
    if (!e) return false;
    return e.variante ? e.variante.stock <= e.variante.stockMinimo : e.producto.stockBajo;
  }

  get escaneadoImagen(): string | undefined {
    const e = this.escaneado;
    return e?.variante?.imageModelSetDto?.[0]?.url ?? e?.producto.imageModelSetDto?.[0]?.url;
  }

  get escaneadoInactivo(): boolean {
    const e = this.escaneado;
    return e?.producto.status === 'INACTIVO' || e?.variante?.status === 'INACTIVO';
  }

  // ─── Carga de datos ───────────────────────────────────────────────────────

  cargarProductos(): void {
    this.isLoading = true;
    this.productService
      .listar({
        ...this.filtrosActuales,
        stock: this.stockFiltro || undefined,
        page: this.page,
        size: this.size,
      })
      .pipe(
        catchError(() => {
          this.showError('Error al cargar productos');
          return of({ content: [], totalElements: 0 });
        })
      )
      .subscribe((data) => {
        this.productos = data.content;
        this.totalElementos = data.totalElements;
        this.isLoading = false;
        this.calcularMetricas();
      });
  }

  cargarCategorias(): void {
    this.categoryService
      .getCategories()
      .pipe(catchError(() => of([])))
      .subscribe((data) => (this.listCategory = data));
  }

  // ─── Métricas ────────────────────────────────────────────────────────────

  private get filtrosActuales() {
    return {
      nombre: this.busqueda || undefined,
      status: this.statusFiltro || undefined,
      marca: this.marcaFiltro || undefined,
      categoriaId: this.catFiltro,
      talle: this.talleFiltro || undefined,
      color: this.colorFiltro || undefined,
    };
  }

  /** Las tarjetas cuentan todos los productos, no solo los de la página visible */
  calcularMetricas(): void {
    this.totalProductos = this.totalElementos;
    const contar = (extra: { stock?: string; conVariantes?: boolean }) =>
      this.productService.listar({ ...this.filtrosActuales, ...extra, size: 1 }).pipe(
        map((p) => p.totalElements),
        catchError(() => of(0))
      );
    this.metricasSub?.unsubscribe();
    this.metricasSub = forkJoin({
      conVariantes: contar({ stock: this.stockFiltro || undefined, conVariantes: true }),
      bajo: contar({ stock: 'BAJO' }),
      sin: contar({ stock: 'SIN' }),
    }).subscribe((m) => {
      this.conVariantes = m.conVariantes;
      this.stockBajoCount = m.bajo;
      this.sinStockCount = m.sin;
    });
  }

  // ─── Filtros ─────────────────────────────────────────────────────────────

  onBusqueda(): void {
    this.searchSubject.next(this.busqueda);
  }

  onFiltroChange(): void {
    this.page = 0;
    this.cargarProductos();
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.statusFiltro = 'ACTIVO';
    this.catFiltro = null;
    this.marcaFiltro = '';
    this.talleFiltro = '';
    this.colorFiltro = '';
    this.stockFiltro = '';
    this.page = 0;
    this.cargarProductos();
  }

  get hayFiltros(): boolean {
    return !!(this.busqueda || this.statusFiltro !== 'ACTIVO' || this.catFiltro || this.marcaFiltro
      || this.talleFiltro || this.colorFiltro || this.stockFiltro);
  }

  // ─── Paginación ──────────────────────────────────────────────────────────

  get totalPaginas(): number {
    return Math.ceil(this.totalElementos / this.size);
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    const actual = this.page;
    // Mostrar máximo 5 páginas centradas en la actual
    const inicio = Math.max(0, actual - 2);
    const fin = Math.min(total - 1, inicio + 4);
    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  }

  irPagina(p: number): void {
    if (p < 0 || p >= this.totalPaginas) return;
    this.page = p;
    this.cargarProductos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Acciones ────────────────────────────────────────────────────────────

  verDetalle(id: string): void {
    this.router.navigate(['/admin/productos', id]);
  }

  editar(id: string): void {
    this.router.navigate(['/admin/formProduct', id]);
  }

  desactivar(producto: ProductListadoDTO): void {
    this.confirm.confirm({
      message: `¿Desactivar "${producto.nameProduct}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.productService
          .desactivar(producto.idProduct)
          .pipe(
            catchError((err) => {
              this.message.add(
                this.errorService.toMessage(err, 'Error al desactivar el producto')
              );
              return EMPTY;
            })
          )
          .subscribe(() => {
            this.showSuccess(`"${producto.nameProduct}" desactivado`);
            this.cargarProductos();
          });
      },
    });
  }

  /** Borrado definitivo: el backend lo rechaza si el producto ya tuvo ventas */
  eliminar(producto: ProductListadoDTO): void {
    this.confirm.confirm({
      header: '¿Eliminar producto?',
      message: `"${producto.nameProduct}" y todas sus variantes y fotos se borrarán definitivamente. Si ya tuvo ventas no se podrá eliminar: en ese caso desactivalo.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.productService
          .eliminar(producto.idProduct)
          .pipe(
            catchError((err) => {
              this.message.add(
                this.errorService.toMessage(err, 'No se pudo eliminar el producto')
              );
              return EMPTY;
            })
          )
          .subscribe(() => {
            this.showSuccess(`"${producto.nameProduct}" eliminado`);
            this.cargarProductos();
          });
      },
    });
  }

  reactivar(producto: ProductListadoDTO): void {
    this.confirm.confirm({
      message: `¿Reactivar "${producto.nameProduct}"?`,
      header: 'Reactivar producto',
      icon: 'pi pi-check-circle',
      acceptLabel: 'Sí, reactivar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.productService
          .reactivar(producto.idProduct)
          .pipe(
            catchError((err) => {
              this.message.add(
                this.errorService.toMessage(err, 'Error al reactivar el producto')
              );
              return EMPTY;
            })
          )
          .subscribe(() => {
            this.showSuccess(
              `"${producto.nameProduct}" reactivado correctamente`
            );
            this.cargarProductos();
          });
      },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  getStockClass(producto: ProductListadoDTO): string {
    if (producto.stockTotal === 0) return 'badge-danger';
    if (producto.stockBajo) return 'badge-warning';
    return 'badge-success';
  }

  getStockLabel(producto: ProductListadoDTO): string {
    if (producto.stockTotal === 0) return 'Sin stock';
    if (producto.stockBajo) return `Stock bajo (${producto.stockTotal})`;
    return `${producto.stockTotal} u.`;
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
}
