import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastMessageOptions } from 'primeng/api';

/** Cuerpo de error que devuelve el GlobalExceptionHandler del backend */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  fieldErrors?: Record<string, string> | null;
}

/** Texto del error que devolvió el backend, o `fallback` si no vino ninguno */
export function apiErrorMessage(error: any, fallback: string): string {
  return new ErrorHandleService().toMessage(error, fallback).detail ?? fallback;
}

@Injectable({
  providedIn: 'root',
})
export class ErrorHandleService {
  /**
   * Convierte un error HTTP en un mensaje de toast. Prioriza el `message`
   * (y los `fieldErrors`) que manda el backend; si no hay, usa un texto
   * genérico según el status.
   */
  toMessage(error: HttpErrorResponse | any, fallback?: string): ToastMessageOptions {
    const status: number = error?.status ?? -1;
    const detail = this.extractDetail(error) ?? fallback ?? this.defaultDetail(status);
    // 400 sin errores por campo = regla de negocio (ej. "tiene ventas"), no datos mal cargados
    const reglaNegocio =
      status === 400 && !Object.keys(this.fieldErrors(error)).length && !!error?.error?.message;

    return {
      severity: status === 400 || status === 409 || status === 403 ? 'warn' : 'error',
      summary: reglaNegocio ? 'No se puede realizar' : this.summary(status),
      detail,
      life: 5000,
    };
  }

  /** Errores de validación por campo (400 con fieldErrors) */
  fieldErrors(error: HttpErrorResponse | any): Record<string, string> {
    return (error?.error as ApiError | null)?.fieldErrors ?? {};
  }

  /** @deprecated usar toMessage(error) para aprovechar el mensaje del backend */
  getErrorMessage(status: number): ToastMessageOptions[] {
    return [this.toMessage({ status })];
  }

  private extractDetail(error: any): string | null {
    const body = error?.error;
    if (!body) return null;
    // El login y algunos endpoints viejos devuelven texto plano
    if (typeof body === 'string') return body.length < 200 ? body : null;

    const api = body as Partial<ApiError>;
    if (api.fieldErrors && Object.keys(api.fieldErrors).length) {
      return Object.values(api.fieldErrors).join(' · ');
    }
    return api.message ?? (body as any).mensaje ?? null;
  }

  private summary(status: number): string {
    switch (status) {
      case 0:
        return 'Sin conexión';
      case 400:
        return 'Datos inválidos';
      case 401:
        return 'No autorizado';
      case 403:
        return 'Sin permisos';
      case 404:
        return 'No encontrado';
      case 409:
        return 'Conflicto';
      case 502:
        return 'Error de ARCA'; // el backend usa 502 cuando ARCA rechaza o no responde
      default:
        return 'Error';
    }
  }

  private defaultDetail(status: number): string {
    switch (status) {
      case 0:
        return 'No se pudo conectar con el servidor. Comuníquese con el administrador.';
      case 401:
        return 'Credenciales incorrectas o sesión vencida.';
      case 403:
        return 'Tu usuario no tiene permisos para esta acción.';
      case 404:
        return 'Recurso no encontrado.';
      case 409:
        return 'La operación entra en conflicto con datos existentes.';
      case 500:
        return 'Ocurrió un problema en el servidor. Intente más tarde.';
      default:
        return 'Ocurrió un error desconocido.';
    }
  }
}
