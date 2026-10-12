import { Component, OnInit, inject } from '@angular/core';
import { UserService } from '../../services/user.service';
import { UserAdmin, UserAdminGet } from '../../user/interfaces/user.model';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ErrorHandleService } from '../../error/error-handle.service';
import { EMPTY, Observable, catchError, finalize } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'app-list-user',
  standalone: true,
  imports: [
    ToastModule,
    TableModule,
    CommonModule,
    ConfirmDialogModule,
    Dialog,
    ReactiveFormsModule,
  ],
  templateUrl: './list-user.component.html',
  styleUrl: './list-user.component.css',
})
export class ListUserComponent implements OnInit {
  private _userService = inject(UserService);
  private mesagge = inject(MessageService);
  private errorService = inject(ErrorHandleService);
  private confirmacionServi = inject(ConfirmationService);

  listUsers: UserAdminGet[] = [];
  visibleUser = false;
  isLoading = false;
  // null = creando; con valor = editando ese usuario
  editingUser: UserAdminGet | null = null;

  formUsersAdmin: FormGroup = inject(FormBuilder).group({
    role: ['', Validators.required],
    name: ['', Validators.required],
    mail: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  ngOnInit(): void {
    this.getUsers();
  }

  getUsers() {
    // El backend responde 204 sin cuerpo si no hay usuarios: el servicio lo normaliza a []
    this.handle(this._userService.getAllUsers()).subscribe(
      (data) => (this.listUsers = data)
    );
  }

  abrirNuevo(): void {
    this.editingUser = null;
    this.formUsersAdmin.reset({ role: '', name: '', mail: '', password: '' });
    this.formUsersAdmin.get('role')?.enable();
    this.setPasswordRequired(true);
    this.visibleUser = true;
  }

  abrirEditar(user: UserAdminGet): void {
    this.editingUser = user;
    this.formUsersAdmin.reset({
      role: user.role,
      name: user.name,
      mail: user.mail,
      password: '',
    });
    // /users/modify solo cambia nombre, mail y (opcional) contraseña
    this.formUsersAdmin.get('role')?.disable();
    this.setPasswordRequired(false);
    this.visibleUser = true;
  }

  private setPasswordRequired(required: boolean): void {
    const ctrl = this.formUsersAdmin.get('password');
    ctrl?.setValidators(
      required
        ? [Validators.required, Validators.minLength(8)]
        : [Validators.minLength(8)]
    );
    ctrl?.updateValueAndValidity();
  }

  guardar(): void {
    if (this.formUsersAdmin.invalid) {
      this.formUsersAdmin.markAllAsTouched();
      return;
    }
    this.editingUser ? this.editUser(this.editingUser) : this.addUser();
  }

  private addUser(): void {
    const { role, name, mail, password } = this.formUsersAdmin.getRawValue();
    const newUser: UserAdmin = {
      role,
      name: name.trim(),
      mail: mail.trim(),
      password,
      status: 'ACTIVO',
    };

    this.isLoading = true;
    // 409 → "El mail ya existe" (lo muestra handle con el mensaje del backend)
    this.handle(this._userService.addUser(newUser))
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe((res) => {
        this.visibleUser = false;
        this.showSuccess(res?.message ?? 'Usuario creado correctamente');
        this.getUsers();
      });
  }

  private editUser(user: UserAdminGet): void {
    const { name, mail, password } = this.formUsersAdmin.getRawValue();

    this.isLoading = true;
    this.handle(
      this._userService.modifyUser({
        idUser: user.uuid,
        role: user.role,
        status: user.status,
        name: name.trim(),
        mail: mail.trim(),
        password: password || null, // vacío = conserva la actual
      })
    )
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe(() => {
        this.visibleUser = false;
        this.showSuccess(`"${name}" fue actualizado`);
        this.getUsers();
      });
  }

  deleteUser(uuid: string): void {
    const usuario = this.listUsers.find((u) => u.uuid === uuid);

    if (uuid === this._userService.getUserId()) {
      this.mesagge.add({
        severity: 'warn',
        summary: 'Acción no permitida',
        detail: 'No podés eliminar tu propio usuario.',
        life: 4000,
      });
      return;
    }

    this.confirmacionServi.confirm({
      message: `El usuario <strong>${usuario?.name}</strong> será eliminado permanentemente y no podrá recuperarse.`,
      header: 'Eliminar usuario',
      icon: 'pi pi-trash',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        // 204 sin cuerpo: el éxito es que no haya error
        this.handle(this._userService.deleteUser(uuid)).subscribe(() => {
          this.listUsers = this.listUsers.filter((u) => u.uuid !== uuid);
          this.showSuccess(`"${usuario?.name}" fue eliminado`);
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

  hasError(controlName: string, typeError: string) {
    const c = this.formUsersAdmin.get(controlName);
    return !!c?.hasError(typeError) && !!c?.touched;
  }

  private handle<T>(request$: Observable<T>): Observable<T> {
    return request$.pipe(
      catchError((err) => {
        this.mesagge.add(this.errorService.toMessage(err));
        return EMPTY;
      })
    );
  }
}
