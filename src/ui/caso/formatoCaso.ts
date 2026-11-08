import type { Caso } from '../../core/Caso';

const ZONA = 'America/Bogota';

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
  return `${fecha.replace(',', '')}, ${hora}`;
}

/** Titulo corto: el numero de comparendo si lo hay, si no la fecha del caso. */
export function tituloCaso(caso: Caso): string {
  if (caso.comparendo) return `Comparendo ${caso.comparendo.numero}`;
  const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(caso.creadoEn),
  );
  return `Caso del ${fecha}`;
}
