// Impresión en ticketeadora térmica (80 mm o 58 mm).
// Agrega una clase al <body> y un @page temporal: así solo se imprime el
// ticket, con el ancho del rollo, sin afectar la impresión A4 de otras pantallas.

export type AnchoTicket = 80 | 58;

const CLAVE = 'ticketAncho';

export function anchoTicketGuardado(): AnchoTicket {
  try {
    return localStorage.getItem(CLAVE) === '58' ? 58 : 80;
  } catch {
    return 80;
  }
}

export function guardarAnchoTicket(ancho: AnchoTicket): void {
  try {
    localStorage.setItem(CLAVE, String(ancho));
  } catch {
    /* sin storage: queda el default */
  }
}

export function imprimirTicket(ancho: AnchoTicket): void {
  const style = document.createElement('style');
  style.setAttribute('data-ticket', '');
  style.textContent = `@page { size: ${ancho}mm auto; margin: 0; }`;
  document.head.appendChild(style);
  document.body.classList.add('imprimiendo-ticket');

  const limpiar = () => {
    style.remove();
    document.body.classList.remove('imprimiendo-ticket');
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
  // Algunos navegadores no disparan afterprint: limpieza de respaldo
  setTimeout(limpiar, 1000);
}
