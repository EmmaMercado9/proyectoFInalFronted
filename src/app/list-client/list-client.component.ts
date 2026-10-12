import { Component } from '@angular/core';

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
      username: ['', Validators.required],
      mail: [''],
      dni: ['', Validators.required],
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

  addClient(): void {
    if (this.formClient.invalid) {
      this.formClient.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    const newClient: ClienteDTO = {
      name: this.formClient.value.name,
      username: this.formClient.value.username,

      mail: this.formClient.value.mail,

      dni: this.formClient.value.dni,
    };

    this._clientService
      .crear(newClient)
      .pipe(
        catchError((err) => {
          this.isLoading = false;
          this.showError(apiErrorMessage(err, 'Error al crear el cliente'));
          return of(null);
        })
      )
      .subscribe((resultado) => {
        if (!resultado) return;

        this.isLoading = false;
        this.visibleClient = false;
        this.formClient.reset();
        this.showSuccess('Usuario creado correctamente');
        this.getClient();
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

  /*deleteClient(idClient: string): void {
    const usuario = this.listClient.find((u) => u.idClient === idClient);

    this.confirmacionServi.confirm({
      message: `El cliente <strong>${usuario?.name}</strong> será eliminado permanentemente y no podrá recuperarse.`,
      header: 'Eliminar cliente',
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this._clientService
          .delete(uuid)
          .pipe(
            catchError(() => {
              this.showError('No se pudo eliminar el usuario');
              return of(null);
            })
          )
          .subscribe((res) => {
            if (res === null) return;
            this.listUsers = this.listUsers.filter((u) => u.uuid !== uuid);
            this.showSuccess(`"${usuario?.name}" fue eliminado`);
          });
      },
    });
  }
  */
  hasError(controlName: string, typeError: string) {
    return (
      this.formClient.get(controlName)?.hasError(typeError) &&
      this.formClient.get(controlName)?.touched
    );
  }
}
