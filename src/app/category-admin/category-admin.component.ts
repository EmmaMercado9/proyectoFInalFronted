import { Component, OnInit, inject } from '@angular/core';
import { CatgoryService } from '../services/catgory.service';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EMPTY, Observable, catchError, finalize } from 'rxjs';
import { ErrorHandleService } from '../error/error-handle.service';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import {
  CategoryResponse,
  SubCategoriaResponse,
} from '../model/product.model';

@Component({
  selector: 'app-category-admin',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CommonModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
  ],
  templateUrl: './category-admin.component.html',
  styleUrl: './category-admin.component.css',
})
export class CategoryAdminComponent implements OnInit {
  private _categoryService = inject(CatgoryService);
  private mesagge = inject(MessageService);
  private errorService = inject(ErrorHandleService);
  private confirmacionService = inject(ConfirmationService);
  private fb = inject(FormBuilder);

  listCategory: CategoryResponse[] = [];
  expanded: number[] = [];
  saving = false;

  // Modal categoría (crear o renombrar)
  visible = false;
  editingCategoryId: number | null = null;
  formCategory: FormGroup = this.fb.group({
    nameCategory: ['', [Validators.required, Validators.maxLength(60)]],
  });

  // Modal subcategoría
  modalSubcategoriaVisible = false;
  selectedCategoryId = 0;
  formSubCategory: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
  });

  // Modal mover subcategoría
  subAMover: SubCategoriaResponse | null = null;
  destinoCategoryId: number | null = null;

  ngOnInit(): void {
    this.getCategorys();
  }

  // ─── Validación ────────────────────────────────────────────────────────────

  hasErrorCat(controlName: string, typeError: string): boolean {
    const c = this.formCategory.get(controlName);
    return !!(c?.hasError(typeError) && c?.touched);
  }

  hasErrorSub(controlName: string, typeError: string): boolean {
    const c = this.formSubCategory.get(controlName);
    return !!(c?.hasError(typeError) && c?.touched);
  }

  // ─── Expandir / colapsar subcategorías ─────────────────────────────────────

  toggleExpanded(id: number): void {
    const index = this.expanded.indexOf(id);
    index > -1 ? this.expanded.splice(index, 1) : this.expanded.push(id);
  }

  // ─── Carga de datos ────────────────────────────────────────────────────────

  getCategorys(): void {
    this.handle(this._categoryService.getCategories()).subscribe(
      (data) => (this.listCategory = data)
    );
  }

  // ─── Crear / renombrar categoría ───────────────────────────────────────────

  abrirNuevaCategoria(): void {
    this.editingCategoryId = null;
    this.formCategory.reset({ nameCategory: '' });
    this.visible = true;
  }

  abrirRenombrar(cat: CategoryResponse): void {
    this.editingCategoryId = cat.idCategory;
    this.formCategory.reset({ nameCategory: cat.nameCategory });
    this.visible = true;
  }

  saveCategory(): void {
    if (this.formCategory.invalid) {
      this.formCategory.markAllAsTouched();
      return;
    }
    const nombre: string = this.formCategory.value.nameCategory.trim();
    const editing = this.editingCategoryId;
    const request$ =
      editing === null
        ? this._categoryService.addCategory(nombre)
        : this._categoryService.renameCategory(editing, nombre);

    this.saving = true;
    this.handle(request$)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.visible = false;
        this.getCategorys();
        this.success(
          editing === null
            ? `Categoría "${nombre}" creada`
            : `Categoría renombrada a "${nombre}"`
        );
      });
  }

  // ─── Crear subcategoría ────────────────────────────────────────────────────

  abrirModalSubcategoria(id: number): void {
    this.selectedCategoryId = id;
    this.formSubCategory.reset({ nombre: '' });
    this.modalSubcategoriaVisible = true;
  }

  addSubCategory(): void {
    if (this.formSubCategory.invalid) {
      this.formSubCategory.markAllAsTouched();
      return;
    }
    const nombre: string = this.formSubCategory.value.nombre.trim();
    const categoryId = this.selectedCategoryId;

    this.saving = true;
    this.handle(this._categoryService.addSubCategory(nombre, categoryId))
      .pipe(finalize(() => (this.saving = false)))
      .subscribe(() => {
        this.modalSubcategoriaVisible = false;
        if (!this.expanded.includes(categoryId)) this.expanded.push(categoryId);
        this.getCategorys();
        this.success(`Subcategoría "${nombre}" creada`);
      });
  }

  // ─── Acciones sobre subcategorías ──────────────────────────────────────────

  toggleSubStatus(sub: SubCategoriaResponse): void {
    this.handle(this._categoryService.toggleSubCategoryStatus(sub.subId)).subscribe(
      () => {
        sub.status = sub.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        this.success(
          `"${sub.nombre}" ${sub.status === 'ACTIVO' ? 'activada' : 'desactivada'}`
        );
      }
    );
  }

  abrirMover(sub: SubCategoriaResponse): void {
    this.subAMover = sub;
    this.destinoCategoryId = null;
  }

  get categoriasDestino(): CategoryResponse[] {
    return this.listCategory.filter(
      (c) => c.idCategory !== this.subAMover?.categoryId
    );
  }

  confirmarMover(): void {
    const sub = this.subAMover;
    const destino = this.destinoCategoryId;
    if (!sub || destino === null) return;

    this.saving = true;
    this.handle(this._categoryService.moveSubCategory(sub.subId, destino))
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((moved) => {
        this.subAMover = null;
        if (!this.expanded.includes(destino)) this.expanded.push(destino);
        this.getCategorys();
        this.success(
          `"${sub.nombre}" se movió a ${moved.categoryNombre ?? 'la nueva categoría'}`
        );
      });
  }

  // ─── Eliminar categoría ────────────────────────────────────────────────────

  deleteCategory(cat: CategoryResponse): void {
    if (cat.cantidadProductos > 0) {
      this.mesagge.add({
        severity: 'warn',
        summary: 'No se puede eliminar',
        detail: `"${cat.nameCategory}" tiene ${cat.cantidadProductos} producto(s). Mové sus subcategorías primero.`,
        life: 5000,
      });
      return;
    }

    this.confirmacionService.confirm({
      message: `Se eliminará "${cat.nameCategory}" junto con sus subcategorías. Esta acción no se puede deshacer.`,
      header: '¿Eliminar categoría?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.handle(this._categoryService.deleteCategory(cat.idCategory)).subscribe(
          () => {
            this.listCategory = this.listCategory.filter(
              (item) => item.idCategory !== cat.idCategory
            );
            this.success(`"${cat.nameCategory}" fue eliminada`);
          }
        );
      },
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Muestra el mensaje de error del backend y corta el flujo */
  private handle<T>(request$: Observable<T>): Observable<T> {
    return request$.pipe(
      catchError((err) => {
        this.mesagge.add(this.errorService.toMessage(err));
        return EMPTY;
      })
    );
  }

  private success(detail: string): void {
    this.mesagge.add({ severity: 'success', summary: 'Listo', detail, life: 3000 });
  }
}
