// factura.component.ts — Factura C / Nota de Crédito C imprimible con QR de ARCA
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';
import QRCode from 'qrcode';

import { Factura, FacturacionService, docTipoLabel } from '../services/facturacion.service';

@Component({
  selector: 'app-factura',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './factura.component.html',
  styleUrl: './factura.component.css',
})
export class FacturaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private facturacion = inject(FacturacionService);

  readonly docTipoLabel = docTipoLabel;
  factura: Factura | null = null;
  qrDataUrl = '';
  error = false;

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('id'));
      this.factura = null;
      this.facturacion
        .obtener(id)
        .pipe(
          catchError(() => {
            this.error = true;
            return of(null);
          })
        )
        .subscribe((f) => {
          this.factura = f;
          if (f?.qrUrl) {
            QRCode.toDataURL(f.qrUrl, { margin: 0, width: 220, errorCorrectionLevel: 'M' })
              .then((url) => (this.qrDataUrl = url))
              .catch(() => (this.qrDataUrl = ''));
          }
        });
    });
  }

  /** Código de comprobante con 3 dígitos (011, 013) */
  get codigo(): string {
    return String(this.factura?.codigoTipo ?? '').padStart(3, '0');
  }

  get esNotaCredito(): boolean {
    return this.factura?.tipo === 'NOTA_CREDITO_C';
  }

  imprimir(): void {
    window.print();
  }
}
