import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { EMPTY, catchError, of, debounceTime, Subject } from 'rxjs';
import { CategoryResponse, ProductListadoDTO } from '../../model/product.model';
import { ProductService } from '../../services/products.service';
import { CatgoryService } from '../../services/catgory.service';
import { UserService } from '../../services/user.service';
import { ErrorHandleService } from '../../error/error-handle.service';

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
  ],
})
export class ProductListComponent implements OnInit {
  // ─── Datos ───────────────────────────────────────────────────────────────
  productos: ProductListadoDTO[] = [];
  listCategory: CategoryResponse[] = [];
  isLoading = true;
  totalElementos = 0;

  // ─── Filtros ─────────────────────────────────────────────────────────────
  busqueda = '';
  statusFiltro = 'ACTIVO';
  catFiltro = '';
  page = 0;
  size = 12;

  // ─── Métricas rápidas ────────────────────────────────────────────────────
  totalProductos = 0;
  conVariantes = 0;
  stockBajoCount = 0;
  sinStockCount = 0;

  // ─── Búsqueda con debounce ───────────────────────────────────────────────
  private searchSubject = new Subject<string>();

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
    this.cargarProductos();

    // Debounce en búsqueda — espera 400ms antes de buscar
    this.searchSubject.pipe(debounceTime(400)).subscribe(() => {
      this.page = 0;
      this.cargarProductos();
    });
  }

  // ─── Carga de datos ───────────────────────────────────────────────────────

  cargarProductos(): void {
    this.isLoading = true;
    this.productService
      .listar({
        nombre: this.busqueda || undefined,
        status: this.statusFiltro || undefined,
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

  calcularMetricas(): void {
    this.totalProductos = this.totalElementos;
    this.conVariantes = this.productos.filter((p) => p.tieneVariantes).length;
    this.stockBajoCount = this.productos.filter(
      (p) => p.stockBajo && p.stockTotal > 0
    ).length;
    this.sinStockCount = this.productos.filter(
      (p) => p.stockTotal === 0
    ).length;
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
    this.catFiltro = '';
    this.page = 0;
    this.cargarProductos();
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
