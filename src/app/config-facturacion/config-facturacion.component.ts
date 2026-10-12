// config-facturacion.component.ts — Configuración → Facturación (solo ADMIN)
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { finalize } from 'rxjs';

import {
  ConfiguracionFacturacion,
  FacturacionService,
} from '../services/facturacion.service';
import { ErrorHandleService } from '../error/error-handle.service';

@Component({
  selector: 'app-config-facturacion',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogModule],
  templateUrl: './config-facturacion.component.html',
})
export class ConfigFacturacionComponent implements OnInit {
  private facturacion = inject(FacturacionService);
  private message = inject(MessageService);
  private confirm = inject(ConfirmationService);
  private errorService = inject(ErrorHandleService);

  config: ConfiguracionFacturacion | null = null;
  // Copia editable del formulario
  form: ConfiguracionFacturacion = this.vacio();
  cargando = true;
  guardando = false;
  generando = false;
  instalando = false;
  probando = false;

  csrTexto = '';
  certificadoPem = '';
  certificadoArchivo = '';

  ngOnInit(): void {
    this.cargar();
  }

  private vacio(): ConfiguracionFacturacion {
    return {
      habilitada: false,
      cuit: null,
      puntoVenta: null,
      razonSocial: null,
      domicilio: null,
      iibb: null,
      inicioActividades: null,
    };
  }

  private cargar(): void {
    this.cargando = true;
    this.facturacion
      .config()
      .pipe(finalize(() => (this.cargando = false)))
      .subscribe({
        next: (c) => this.aplicar(c),
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  private aplicar(c: ConfiguracionFacturacion): void {
    this.config = c;
    this.form = {
      habilitada: c.habilitada,
      cuit: c.cuit,
      puntoVenta: c.puntoVenta,
      razonSocial: c.razonSocial,
      domicilio: c.domicilio,
      iibb: c.iibb,
      inicioActividades: c.inicioActividades,
    };
    if (c.csrDisponible && !this.csrTexto) {
      this.facturacion.csr().subscribe({ next: (t) => (this.csrTexto = t), error: () => {} });
    }
  }

  get listo(): boolean {
    return !!this.config && !this.config.faltantes?.length;
  }

  get datosGuardados(): boolean {
    return !!this.config?.cuit && !!this.config?.razonSocial;
  }

  // ─── Datos del emisor ───────────────────────────────────────────────────

  guardar(): void {
    this.guardando = true;
    this.facturacion
      .guardarConfig(this.form)
      .pipe(finalize(() => (this.guardando = false)))
      .subscribe({
        next: (c) => {
          this.aplicar(c);
          this.message.add({ severity: 'success', summary: 'Guardado', detail: 'Datos de facturación actualizados', life: 3000 });
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  // ─── Certificado ────────────────────────────────────────────────────────

  generarCsr(): void {
    if (this.config?.certificadoSujeto) {
      this.confirm.confirm({
        header: '¿Generar una clave nueva?',
        message:
          'Ya hay un certificado instalado. Si generás una clave nueva, ese certificado deja de servir y vas a tener que pedir otro en ARCA.',
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: 'Sí, generar',
        rejectLabel: 'Cancelar',
        acceptButtonStyleClass: 'p-button-danger',
        rejectButtonStyleClass: 'p-button-text p-button-secondary',
        accept: () => this.ejecutarCsr(true),
      });
      return;
    }
    this.ejecutarCsr(false);
  }

  private ejecutarCsr(reemplazar: boolean): void {
    this.generando = true;
    this.facturacion
      .generarCsr(reemplazar)
      .pipe(finalize(() => (this.generando = false)))
      .subscribe({
        next: (csr) => {
          this.csrTexto = csr;
          this.descargarCsr();
          this.message.add({
            severity: 'success',
            summary: 'Pedido de certificado generado',
            detail: 'Se descargó arca.csr. La clave privada quedó guardada en el servidor.',
            life: 6000,
          });
          this.cargar();
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  descargarCsr(): void {
    if (!this.csrTexto) return;
    const url = URL.createObjectURL(new Blob([this.csrTexto], { type: 'application/pkcs10' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arca.csr';
    a.click();
    URL.revokeObjectURL(url);
  }

  copiarCsr(): void {
    navigator.clipboard?.writeText(this.csrTexto).then(() =>
      this.message.add({ severity: 'info', summary: 'Copiado', detail: 'CSR copiado al portapapeles', life: 2500 })
    );
  }

  onArchivoCertificado(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.certificadoArchivo = file.name;
    file.text().then((t) => (this.certificadoPem = t));
  }

  instalarCertificado(): void {
    this.instalando = true;
    this.facturacion
      .instalarCertificado(this.certificadoPem)
      .pipe(finalize(() => (this.instalando = false)))
      .subscribe({
        next: (c) => {
          this.aplicar(c);
          this.certificadoPem = '';
          this.certificadoArchivo = '';
          this.message.add({ severity: 'success', summary: 'Certificado instalado', detail: 'Verificado contra la clave y el CUIT', life: 4000 });
        },
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }

  probar(): void {
    this.probando = true;
    this.facturacion
      .probar()
      .pipe(finalize(() => (this.probando = false)))
      .subscribe({
        next: (e) =>
          this.message.add({
            severity: e.habilitada ? 'success' : 'info',
            summary: 'Conexión con ARCA',
            detail: e.mensaje,
            life: 8000,
          }),
        error: (err) => this.message.add(this.errorService.toMessage(err)),
      });
  }
}
