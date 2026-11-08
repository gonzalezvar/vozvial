import type { Caso } from '../../core/Caso';

const ZONA = 'America/Bogota';

/** "10:15 a. m." con espacios no separables: la hora nunca se parte en dos lineas. */
export function horaSinCorte(hora: string): string {
  return hora.replace(/\s*([ap])\.\s*m\./g, '\u00A0$1.\u00A0m.');
}

/** "sábado 8 de noviembre de 2026, 10:15 a. m." en hora de Colombia. */
export function fechaHoraCaso(caso: Caso): string {
  const d = new Date(caso.creadoEn);
  const fecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  const hora = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }).format(d);
  return `${fecha.replace(',', '')}, ${horaSinCorte(hora)}`;
}

/** Titulo corto: el numero de comparendo si lo hay, si no la fecha del caso. */
export function tituloCaso(caso: Caso): string {
  if (caso.comparendo) return `Comparendo ${caso.comparendo.numero}`;
  const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(caso.creadoEn),
  );
  return `Caso del ${fecha}`;
}
