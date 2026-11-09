// Textos y colores compartidos para estados de venta, medios de pago y devoluciones

const STATUS_LABEL: Record<string, string> = {
  COMPLETADA: 'Completada',
  PENDIENTE: 'Pendiente',
  CANCELADA: 'Cancelada',
  EN_ENVIO: 'En envío',
  DEVUELTA_PARCIAL: 'Devolución parcial',
  DEVUELTA: 'Devuelta',
};

const STATUS_CLASS: Record<string, string> = {
  COMPLETADA: 'bg-green-100 text-green-700',
  PENDIENTE: 'bg-amber-100 text-amber-700',
  CANCELADA: 'bg-red-100 text-red-600',
  EN_ENVIO: 'bg-blue-100 text-blue-700',
  DEVUELTA_PARCIAL: 'bg-orange-100 text-orange-700',
  DEVUELTA: 'bg-gray-200 text-gray-600',
};

const PAYMENT_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA_DEBITO: 'Tarjeta débito',
  TARJETA_CREDITO: 'Tarjeta crédito',
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'Mercado Pago',
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_LABEL) as (
  | 'EFECTIVO'
  | 'TARJETA_DEBITO'
  | 'TARJETA_CREDITO'
  | 'TRANSFERENCIA'
  | 'MERCADOPAGO'
)[];

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusClass(status: string): string {
  return STATUS_CLASS[status] ?? 'bg-gray-100 text-gray-500';
}

export function paymentLabel(payment?: string | null): string {
  if (!payment) return '—';
  // Listados de pagos combinados: "EFECTIVO + TARJETA_DEBITO"
  return payment.split(' + ').map((m) => PAYMENT_LABEL[m] ?? m).join(' + ');
}

/** "Tarjeta crédito · 6 cuotas" */
export function pagoConCuotas(orden: {
  payment?: string | null;
  cuotas?: number | null;
  pagos?: { medio: string; cuotas: number; total: number }[];
}): string {
  if ((orden.pagos?.length ?? 0) > 1) {
    return orden.pagos!
      .map((p) => `${pagoConCuotas({ payment: p.medio, cuotas: p.cuotas })} $${p.total.toLocaleString('es-AR')}`)
      .join(' + ');
  }
  const cuotas = orden.cuotas ?? 1;
  return paymentLabel(orden.payment) + (cuotas > 1 ? ` · ${cuotas} cuotas` : '');
}

/** "Descuento efectivo (−10 %)" / "Recargo 6 cuotas (+15 %)" */
export function ajusteMedioLabel(orden: {
  payment?: string | null;
  cuotas?: number | null;
  ajustePorcentaje?: number | null;
  ajusteMedioPago?: number | null;
  pagos?: unknown[];
}): string {
  if ((orden.pagos?.length ?? 0) > 1) {
    return `${(orden.ajusteMedioPago ?? 0) < 0 ? 'Descuento' : 'Recargo'} por pago combinado`;
  }
  const pct = orden.ajustePorcentaje ?? 0;
  const signo = pct > 0 ? '+' : '−';
  return (orden.ajusteMedioPago ?? 0) < 0
    ? `Descuento ${paymentLabel(orden.payment).toLowerCase()} (${signo}${Math.abs(pct)} %)`
    : `Recargo ${orden.cuotas ?? 1} cuotas (${signo}${Math.abs(pct)} %)`;
}

export function formaReintegroLabel(forma?: string | null, paymentOriginal?: string | null): string {
  if (forma === 'EFECTIVO') return 'Efectivo';
  if (forma === 'MISMO_MEDIO') return `Mismo medio (${paymentLabel(paymentOriginal)})`;
  return '—';
}

/** Se puede devolver/cambiar: estado válido y dentro del plazo */
export function admiteDevolucion(orden: {
  status: string;
  fechaLimiteDevolucion?: string;
}): boolean {
  if (orden.status !== 'COMPLETADA' && orden.status !== 'DEVUELTA_PARCIAL') return false;
  return !orden.fechaLimiteDevolucion || new Date(orden.fechaLimiteDevolucion) >= new Date();
}
