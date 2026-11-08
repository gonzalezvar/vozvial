// Iconos propios de VozVial: trazos simples en una reticula de 24 x 24, linea de 2 px y puntas redondas.
// Son datos puros (sin React) para poder probarlos y dibujarlos en web con SVG.

export type FormaIcono =
  | { t: 'path'; d: string; relleno?: boolean }
  | { t: 'circle'; cx: number; cy: number; r: number; relleno?: boolean }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; relleno?: boolean };

const p = (d: string, relleno?: boolean): FormaIcono => ({ t: 'path', d, relleno });
const c = (cx: number, cy: number, r: number, relleno?: boolean): FormaIcono => ({ t: 'circle', cx, cy, r, relleno });
const r = (x: number, y: number, w: number, h: number, rx = 2, relleno?: boolean): FormaIcono => ({ t: 'rect', x, y, w, h, rx, relleno });

export const ICONOS = {
  // Navegacion
  volver: [p('M15 18l-6-6 6-6')],
  siguiente: [p('M9 6l6 6-6 6')],
  abajo: [p('M6 9l6 6 6-6')],
  arriba: [p('M18 15l-6-6-6 6')],
  cerrar: [p('M6 6l12 12'), p('M18 6L6 18')],
  inicio: [p('M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1v-9z')],
  externo: [p('M14 4h6v6'), p('M20 4l-9 9'), p('M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5')],

  // Voz y lectura
  escuchar: [p('M11 5L6 9H3v6h3l5 4V5z'), p('M15.5 8.5a5 5 0 010 7'), p('M18.5 5.5a9 9 0 010 13')],
  detener: [r(6, 6, 12, 12, 2, true)],
  microfono: [r(9, 3, 6, 11, 3), p('M5 11a7 7 0 0014 0'), p('M12 18v3'), p('M8 21h8')],
  enviar: [p('M5 12h14'), p('M13 6l6 6-6 6')],
  conversacion: [p('M4 5h16v11H9l-5 4V5z'), p('M8 9h8'), p('M8 12h5')],

  // Casos y evidencias
  grabar: [c(12, 12, 9), c(12, 12, 4, true)],
  casos: [p('M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z')],
  comparendo: [p('M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z'), p('M14 3v5h5'), p('M9 13h6'), p('M9 17h6')],
  solicitud: [p('M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z'), p('M14 3v5h5'), p('M9 14l2 2 4-4')],
  camara: [p('M4 8a2 2 0 012-2h2l1.5-2h5L16 6h2a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z'), c(12, 12.5, 3.5)],
  foto: [r(3, 4, 18, 16, 2), c(9, 10, 2), p('M21 16l-5-5-9 9')],
  audio: [p('M4 10v4'), p('M8 7v10'), p('M12 4v16'), p('M16 7v10'), p('M20 10v4')],
  nota: [p('M4 20h4L19 9l-4-4L4 16v4z'), p('M13.5 6.5l4 4')],
  ubicacion: [p('M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z'), c(12, 9.5, 2.5)],
  reloj: [c(12, 12, 9), p('M12 7v5l3 2')],
  calendario: [r(3, 5, 18, 16, 2), p('M3 10h18'), p('M8 3v4'), p('M16 3v4')],
  descargar: [p('M12 4v11'), p('M7 10l5 5 5-5'), p('M5 20h14')],
  mas: [p('M12 5v14'), p('M5 12h14')],
  borrar: [p('M4 7h16'), p('M9 7V4h6v3'), p('M6 7l1 13h10l1-13')],

  // Ley y privacidad
  ley: [p('M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z'), p('M5 17a3 3 0 013-3h11')],
  escudo: [p('M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z'), p('M9 12l2 2 4-4')],
  candado: [r(5, 11, 14, 10, 2), p('M8 11V8a4 4 0 018 0v3')],
  llave: [c(8, 15, 4), p('M11 12l9-9'), p('M17 6l3 3')],
  usuario: [c(12, 8, 4), p('M4 21a8 8 0 0116 0')],

  // Estados y avisos
  info: [c(12, 12, 9), p('M12 11v5'), p('M12 8h.01')],
  alerta: [p('M12 3.5l9 16H3l9-16z'), p('M12 10v4'), p('M12 17h.01')],
  check: [p('M5 12.5l4.5 4.5L19 7')],
  ayuda: [c(12, 12, 9), p('M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 3.5'), p('M12 17h.01')],

  // Ajustes y sesion
  ajustes: [p('M4 7h9'), p('M17 7h3'), c(15, 7, 2), p('M4 17h3'), p('M11 17h9'), c(9, 17, 2)],
  letra: [p('M3 19l5-14 5 14'), p('M5 14h6'), p('M14 19l3.5-9 3.5 9'), p('M15.2 16h4.6')],
  salir: [p('M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3'), p('M14 17l5-5-5-5'), p('M19 12H9')],
} as const satisfies Record<string, readonly FormaIcono[]>;

export type NombreIcono = keyof typeof ICONOS;

export const NOMBRES_ICONOS = Object.keys(ICONOS) as NombreIcono[];
