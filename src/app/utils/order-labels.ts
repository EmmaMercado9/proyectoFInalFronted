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
  return payment ? (PAYMENT_LABEL[payment] ?? payment) : '—';
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
