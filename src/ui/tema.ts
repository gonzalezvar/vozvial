// Tokens visuales de VozVial. Sin dependencias de React para poder probarlos en Node.

export type TamanoLetra = 'normal' | 'grande' | 'muy_grande';

export const TAMANOS_LETRA: readonly { id: TamanoLetra; nombre: string; base: number }[] = [
  { id: 'normal', nombre: 'Normal', base: 18 },
  { id: 'grande', nombre: 'Grande', base: 22 },
  { id: 'muy_grande', nombre: 'Muy grande', base: 26 },
] as const;

/**
 * Paleta. Razones de contraste WCAG 2.1 calculadas con razonContraste()
 * (las verifica tests/unit/ui/tema.test.ts). AA pide 4,5:1 para texto y 3:1 para bordes de controles.
 *
 * texto / fondo ......................... 15,95
 * texto / superficie .................... 17,18
 * texto / superficieAlterna ............. 14,50
 * texto / primarioSuave ................. 14,09
 * texto / avisoSuave .................... 15,11
 * texto / urgenciaSuave ................. 14,38
 * textoSuave / fondo .................... 8,52
 * textoSuave / superficie ............... 9,18
 * textoSuave / superficieAlterna ........ 7,74
 * sobrePrimario / primario .............. 11,06
 * sobrePrimario / primarioPresionado .... 14,24
 * primario / fondo ...................... 10,27
 * primario / superficie ................. 11,06
 * primario / primarioSuave .............. 9,07
 * sobreUrgencia / urgencia .............. 5,99
 * urgencia / fondo ...................... 5,56
 * urgenciaTexto / urgenciaSuave ......... 8,11
 * sobrePeligro / peligro ................ 7,70
 * peligroTexto / peligroSuave ........... 8,61
 * exitoTexto / exitoSuave ............... 5,60
 * avisoTexto / avisoSuave ............... 6,99
 * borde / fondo (control, 3:1) .......... 4,27
 * borde / superficie (control, 3:1) ..... 4,60
 */
export const colores = {
  // Fondo claro calido: menos deslumbrante que el blanco puro para la vista cansada.
  fondo: '#FAF6EF',
  superficie: '#FFFFFF',
  superficieAlterna: '#F2EBDF',
  texto: '#1D1B18',
  textoSuave: '#4D473F',
  borde: '#7D7466',
  bordeSuave: '#D9CFBF',

  // Azul profundo propio de VozVial (no corresponde a ninguna entidad).
  primario: '#183B70',
  primarioPresionado: '#102A52',
  primarioSuave: '#E3E9F3',
  sobrePrimario: '#FFFFFF',

  // Acento de urgencia: boton "Me pararon" y alertas de plazo.
  urgencia: '#B23A14',
  urgenciaPresionado: '#8E2D0F',
  urgenciaSuave: '#FBE7DD',
  urgenciaTexto: '#7D2709',
  sobreUrgencia: '#FFFFFF',

  peligro: '#A11D2B',
  peligroPresionado: '#7E1520',
  peligroSuave: '#FBE4E6',
  peligroTexto: '#7E1520',
  sobrePeligro: '#FFFFFF',

  exitoSuave: '#E2F0E6',
  exitoTexto: '#1F6A3B',

  avisoSuave: '#FBF0CF',
  avisoTexto: '#6E4A00',

  foco: '#183B70',
} as const;

export type Colores = typeof colores;

/** Pares texto/fondo que deben cumplir 4,5:1 y bordes de control que deben cumplir 3:1. */
export const PARES_TEXTO: readonly [keyof Colores, keyof Colores][] = [
  ['texto', 'fondo'],
  ['texto', 'superficie'],
  ['texto', 'superficieAlterna'],
  ['texto', 'primarioSuave'],
  ['texto', 'avisoSuave'],
  ['texto', 'urgenciaSuave'],
  ['textoSuave', 'fondo'],
  ['textoSuave', 'superficie'],
  ['textoSuave', 'superficieAlterna'],
  ['sobrePrimario', 'primario'],
  ['sobrePrimario', 'primarioPresionado'],
  ['primario', 'fondo'],
  ['primario', 'superficie'],
  ['primario', 'primarioSuave'],
  ['sobreUrgencia', 'urgencia'],
  ['sobreUrgencia', 'urgenciaPresionado'],
  ['urgencia', 'fondo'],
  ['urgenciaTexto', 'urgenciaSuave'],
  ['sobrePeligro', 'peligro'],
  ['sobrePeligro', 'peligroPresionado'],
  ['peligroTexto', 'peligroSuave'],
  ['exitoTexto', 'exitoSuave'],
  ['avisoTexto', 'avisoSuave'],
];

export const PARES_CONTROL: readonly [keyof Colores, keyof Colores][] = [
  ['borde', 'fondo'],
  ['borde', 'superficie'],
  ['foco', 'fondo'],
];

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = canales.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razon de contraste WCAG 2.1 entre dos colores #RRGGBB. */
export function razonContraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

export interface EscalaTipografica {
  base: number;
  /** Texto secundario. Nunca baja de 18 px. */
  nota: number;
  subtitulo: number;
  titulo: number;
  tituloPantalla: number;
  destacado: number;
  alturaLinea: (tamano: number) => number;
}

/** Escala derivada del tamano base elegido en Ajustes (18 / 22 / 26 px). */
export function escalaTipografica(base: number): EscalaTipografica {
  return {
    base,
    nota: Math.max(18, Math.round(base * 0.9)),
    subtitulo: Math.round(base * 1.2),
    titulo: Math.round(base * 1.4),
    tituloPantalla: Math.round(base * 1.6),
    destacado: Math.round(base * 1.9),
    alturaLinea: (tamano: number) => Math.round(tamano * 1.45),
  };
}

export function baseDe(tamano: TamanoLetra): number {
  return TAMANOS_LETRA.find((t) => t.id === tamano)?.base ?? 18;
}

/** Espaciado en multiplos de 4 px, generoso a proposito. */
export const espacio = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radio = {
  s: 8,
  m: 12,
  l: 20,
} as const;

/** Medidas minimas de accesibilidad definidas en CLAUDE.md. */
export const medidas = {
  altoMinimoBoton: 56,
  anchoMaximoContenido: 480,
  grosorFoco: 3,
} as const;

export interface Tema {
  colores: Colores;
  tipo: EscalaTipografica;
  espacio: typeof espacio;
  radio: typeof radio;
  medidas: typeof medidas;
  tamano: TamanoLetra;
}

export function crearTema(tamano: TamanoLetra): Tema {
  return { colores, tipo: escalaTipografica(baseDe(tamano)), espacio, radio, medidas, tamano };
}
