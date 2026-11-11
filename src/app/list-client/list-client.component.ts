import { Component, inject } from '@angular/core';
import { UserService } from '../services/user.service';

import { ClienteDTO, ClientService } from '../services/client.service';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ErrorHandleService, apiErrorMessage } from '../error/error-handle.service';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Toast, ToastModule } from 'primeng/toast';
import { Dialog, DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
@Component({
  selector: 'app-list-client',
  standalone: true,
  imports: [
    CommonModule,
    ToastModule,
    DialogModule,
    ReactiveFormsModule,
    ConfirmDialogModule,
  ],
  templateUrl: './list-client.component.html',
  styleUrl: './list-client.component.css',
})
export class ListClientComponent {
  listClient: ClienteDTO[] = [];
  formClient: FormGroup;
  bande: boolean = false;
  visibleClient: boolean = false;
  isLoading = false;
  /** Eliminar clientes es solo del administrador */
  readonly esAdmin = inject(UserService).isAdmin();
  constructor(
    private _clientService: ClientService,
    form: FormBuilder,
    private mesagge: MessageService,
    private errorService: ErrorHandleService,
    private confirmacionServi: ConfirmationService,
    private router: Router
  ) {
    this.formClient = form.group({
      name: ['', Validators.required],
      username: [''],
      mail: [''],
      dni: [''],
    });
  }
  ngOnInit(): void {
    this.getClient();
  }

  getClient() {
    this._clientService
      .getClients()
      .pipe(
        catchError((error) => {
          this.mesagge.add(this.errorService.toMessage(error));
          return of([]);
        })
      )
      .subscribe((data: ClienteDTO[]) => {
        this.listClient = data ?? [];
      });
  }

  /** Cliente que se está editando (null: se está creando uno nuevo) */
  editando: ClienteDTO | null = null;

  abrirNuevo(): void {
    this.editando = null;
    this.formClient.reset({ name: '', username: '', mail: '', dni: '' });
    this.visibleClient = true;
  }

  abrirEditar(cliente: ClienteDTO): void {
    this.editando = cliente;
    this.formClient.reset({
      name: cliente.name ?? '',
      username: cliente.username ?? '',
      mail: cliente.mail ?? '',
      dni: cliente.dni ?? '',
    });
    this.visibleClient = true;
  }

  /** Crea o guarda los cambios, según cómo se abrió el formulario */
  guardar(): void {
    if (this.formClient.invalid) {
      this.formClient.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    const v = this.formClient.value;
    const datos: ClienteDTO = { name: v.name, username: v.username, mail: v.mail, dni: v.dni };
    const editando = this.editando;
    const pedido = editando?.idClient
      ? this._clientService.actualizar(editando.idClient, datos)
      : this._clientService.crear(datos);

    pedido
      .pipe(
        catchError((err) => {
          this.isLoading = false;
          this.showError(apiErrorMessage(err, editando ? 'No se pudo guardar el cliente' : 'Error al crear el cliente'));
          return of(null);
        })
      )
      .subscribe((resultado) => {
        if (!resultado) return;
        this.isLoading = false;
        this.visibleClient = false;
        this.formClient.reset();
        this.showSuccess(editando ? 'Cliente actualizado' : 'Cliente creado correctamente');
        this.editando = null;
        this.getClient();
      });
  }

  eliminar(cliente: ClienteDTO): void {
    if (!cliente.idClient) return;
    const id = cliente.idClient;
    this.confirmacionServi.confirm({
      message: `¿Eliminar a "${cliente.name}${cliente.username ? ' ' + cliente.username : ''}"? No se puede deshacer. Si tiene ventas registradas no se podrá eliminar.`,
      header: 'Eliminar cliente',
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this._clientService
          .eliminar(id)
          .pipe(
            catchError((err) => {
              this.showError(apiErrorMessage(err, 'No se pudo eliminar el cliente'));
              return of('error' as const);
            })
          )
          .subscribe((r) => {
            if (r === 'error') return;
            this.listClient = this.listClient.filter((c) => c.idClient !== id);
            this.showSuccess(`"${cliente.name}" fue eliminado`);
          });
      },
    });
  }

  showSuccess(msg: string): void {
    this.mesagge.add({
      severity: 'success',
      summary: 'Éxito',
      detail: msg,
      life: 3000,
    });
  }

  showError(msg: string): void {
    this.mesagge.add({
      severity: 'error',
      summary: 'Error',
      detail: msg,
      life: 4000,
    });
  }

  hasError(controlName: string, typeError: string) {
    return (
      this.formClient.get(controlName)?.hasError(typeError) &&
      this.formClient.get(controlName)?.touched
    );
  }
}
