import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, catchError, switchMap, tap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { UserService } from '../services/user.service';
import { ErrorHandleService } from '../error/error-handle.service';

const DURACION_MINIMA_MS = 900;

@Component({
  selector: 'app-singin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ToastModule],
  templateUrl: './singin.component.html',
  styleUrl: './singin.component.css',
})
export class SinginComponent {
  private router = inject(Router);
  private serviceUser = inject(UserService);
  private errorService = inject(ErrorHandleService);
  private mensaje = inject(MessageService);

  formUser: FormGroup = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  showPassword = false;
  loading = false;
  entrando = false; // login correcto: animación hasta que abre el panel

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    if (this.formUser.invalid || this.loading) {
      this.formUser.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { email, password } = this.formUser.value;

    this.serviceUser
      .generateToken({ email: email.trim(), password })
      .pipe(
        tap(({ token }) => this.serviceUser.loginUser(token)),
        switchMap(() => this.serviceUser.getUserCurrent()),
        catchError((error) => {
          this.loading = false;
          this.serviceUser.logout();
          this.mensaje.add(this.loginError(error));
          return EMPTY;
        })
      )
      .subscribe((user) => {
        this.serviceUser.setUser(user);
        const home = this.serviceUser.homeRoute();
        if (home) {
          this.entrando = true;
          setTimeout(() => {
            this.router.navigate([home]).finally(() => {
              this.entrando = false;
              this.loading = false;
            });
          }, DURACION_MINIMA_MS);
        } else {
          this.loading = false;
          this.serviceUser.logout();
          this.mensaje.add({
            severity: 'warn',
            summary: 'Sin acceso',
            detail: 'Tu usuario no tiene permisos para ingresar.',
          });
        }
      });
  }

  // El login responde 401 con texto plano (en inglés o "inactivo")
  private loginError(error: any) {
    if (error?.status === 401) {
      const inactivo =
        typeof error.error === 'string' && error.error.includes('inactivo');
      return {
        severity: 'warn',
        summary: 'No se pudo ingresar',
        detail: inactivo
          ? 'Tu usuario está inactivo. Contactá a un administrador.'
          : 'Email o contraseña incorrectos.',
        life: 5000,
      };
    }
    return this.errorService.toMessage(error);
  }

  hasError(controlName: string, typeError: string) {
    const control = this.formUser.get(controlName);
    return !!control?.hasError(typeError) && !!control?.touched;
  }
}
