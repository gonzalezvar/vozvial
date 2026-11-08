// Tokens visuales de VozVial. Sin dependencias de React para poder probarlos en Node.
// Sistema visual "papel y petroleo": fondo calido, un solo color de accion y terracota solo para urgencias.

export type TamanoLetra = 'normal' | 'grande' | 'muy_grande';

export const TAMANOS_LETRA: readonly { id: TamanoLetra; nombre: string; base: number }[] = [
  { id: 'normal', nombre: 'Normal', base: 18 },
  { id: 'grande', nombre: 'Grande', base: 22 },
  { id: 'muy_grande', nombre: 'Muy grande', base: 26 },
] as const;

/**
 * Paleta "papel y petroleo": fondo de papel calido, superficies blancas, un solo color de accion
 * (azul petroleo) y un acento terracota reservado para urgencias. Razones WCAG 2.1 calculadas con
 * razonContraste() y verificadas en tests/unit/ui/tema.test.ts. AA: 4,5:1 texto, 3:1 bordes de control.
 *
 * texto / fondo ......................... 15,71   textoSuave / fondo .................... 8,57
 * texto / superficie .................... 17,39   textoSuave / superficie ............... 9,48
 * texto / superficieAlterna ............. 14,28   textoSuave / superficieAlterna ........ 7,79
 * texto / primarioSuave ................. 14,67   textoSuave / primarioSuave ............ 8,00
 * sobrePrimario / primario .............. 9,16    primario / fondo ...................... 8,28
 * sobrePrimario / primarioPresionado .... 12,35   primario / primarioSuave .............. 7,73
 * sobreUrgencia / urgencia .............. 5,99    urgencia / fondo ...................... 5,41
 * urgenciaTexto / urgenciaSuave ......... 8,18    peligroTexto / peligroSuave ........... 8,61
 * sobrePeligro / peligro ................ 7,70    exitoTexto / exitoSuave ............... 5,60
 * avisoTexto / avisoSuave ............... 6,99    borde / fondo (control 3:1) ........... 4,34
 * borde / superficie (control 3:1) ...... 4,80    foco / fondo .......................... 8,28
 */
export const colores = {
  // Neutros calidos: el papel cansa menos la vista que el blanco puro como fondo de pagina.
  fondo: '#F6F3EE',
  superficie: '#FFFFFF',
  superficieAlterna: '#EEE8DF',
  texto: '#1B1A18',
  textoSuave: '#4A453F',
  /** Borde de controles (campos, casillas): cumple 3:1. */
  borde: '#7A7164',
  /** Linea fina decorativa: separa tarjetas y filas. No identifica controles. */
  bordeSuave: '#DDD5C9',

  // Azul petroleo propio de VozVial: sobrio y calido, distinto del azul institucional y del verde policial.
  primario: '#0E4F5C',
  primarioPresionado: '#093A44',
  primarioSuave: '#E2EEEF',
  /** Fondo de un boton tonal presionado. */
  primarioSuaveFuerte: '#CFE2E4',
  sobrePrimario: '#FFFFFF',

  // Terracota: solo "Me pararon", grabacion y plazos que vencen. Nunca decoracion.
  urgencia: '#B23A14',
  urgenciaPresionado: '#8E2D0F',
  urgenciaSuave: '#FBE8DF',
  urgenciaTexto: '#7D2709',
  sobreUrgencia: '#FFFFFF',

  // Errores y acciones que borran o cierran.
  peligro: '#A11D2B',
  peligroPresionado: '#7E1520',
  peligroSuave: '#FBE4E6',
  peligroTexto: '#7E1520',
  sobrePeligro: '#FFFFFF',

  exitoSuave: '#E2F0E6',
  exitoTexto: '#1F6A3B',

  avisoSuave: '#FBF0CF',
  avisoTexto: '#6E4A00',

  foco: '#0E4F5C',
} as const;

export type Colores = typeof colores;
export type NombreColor = keyof Colores;

/** Pares texto/fondo que deben cumplir 4,5:1. */
export const PARES_TEXTO: readonly [NombreColor, NombreColor][] = [
  ['texto', 'fondo'],
  ['texto', 'superficie'],
  ['texto', 'superficieAlterna'],
  ['texto', 'primarioSuave'],
  ['texto', 'avisoSuave'],
  ['texto', 'urgenciaSuave'],
  ['texto', 'peligroSuave'],
  ['texto', 'exitoSuave'],
  ['textoSuave', 'fondo'],
  ['textoSuave', 'superficie'],
  ['textoSuave', 'superficieAlterna'],
  ['textoSuave', 'primarioSuave'],
  ['sobrePrimario', 'primario'],
  ['sobrePrimario', 'primarioPresionado'],
  ['primario', 'fondo'],
  ['primario', 'superficie'],
  ['primario', 'primarioSuave'],
  ['primario', 'superficieAlterna'],
  ['primarioPresionado', 'primarioSuave'],
  ['primario', 'primarioSuaveFuerte'],
  ['sobreUrgencia', 'urgencia'],
  ['sobreUrgencia', 'urgenciaPresionado'],
  ['urgencia', 'fondo'],
  ['urgencia', 'superficie'],
  ['urgenciaTexto', 'urgenciaSuave'],
  ['sobrePeligro', 'peligro'],
  ['sobrePeligro', 'peligroPresionado'],
  ['peligro', 'superficie'],
  ['peligroTexto', 'peligroSuave'],
  ['peligroTexto', 'superficie'],
  ['exitoTexto', 'exitoSuave'],
  ['exitoTexto', 'superficie'],
  ['avisoTexto', 'avisoSuave'],
  ['avisoTexto', 'superficie'],
];

/** Bordes de controles e indicador de foco: deben cumplir 3:1 (WCAG 1.4.11). */
export const PARES_CONTROL: readonly [NombreColor, NombreColor][] = [
  ['borde', 'fondo'],
  ['borde', 'superficie'],
  ['foco', 'fondo'],
  ['foco', 'superficie'],
  ['primario', 'fondo'],
  ['peligro', 'superficie'],
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

/** Pesos de letra: tres y ninguno por encima de 700. */
export const peso = {
  normal: '400',
  medio: '600',
  fuerte: '700',
} as const;

export interface EscalaTipografica {
  base: number;
  /** Texto secundario y metadatos. Nunca baja de 18 px. */
  nota: number;
  /** Titulo de tarjeta o seccion pequena (h3). */
  subtitulo: number;
  /** Titulo de seccion (h2). */
  titulo: number;
  /** Titulo de la pantalla (h1). */
  tituloPantalla: number;
  /** Cifras y palabras clave muy visibles (cronometro, dias que quedan). */
  destacado: number;
  /** Interlineado: 1,5 en texto corrido y 1,25 en titulos. */
  alturaLinea: (tamano: number) => number;
}

/** Escala derivada del tamano base elegido en Ajustes (18 / 22 / 26 px). Razon aproximada 1,15 entre pasos. */
export function escalaTipografica(base: number): EscalaTipografica {
  return {
    base,
    nota: Math.max(18, Math.round(base * 0.9)),
    subtitulo: Math.round(base * 1.15),
    titulo: Math.round(base * 1.3),
    tituloPantalla: Math.round(base * 1.55),
    destacado: Math.round(base * 1.9),
    // Los titulos (desde 1,25 veces la base) van mas apretados; el texto corrido respira.
    alturaLinea: (tamano: number) => Math.round(tamano * (tamano >= base * 1.25 ? 1.25 : 1.5)),
  };
}

export function baseDe(tamano: TamanoLetra): number {
  return TAMANOS_LETRA.find((t) => t.id === tamano)?.base ?? 18;
}

/** Espaciado en multiplos de 4 px. Dentro de un componente: xs a m. Entre bloques: l a xxl. */
export const espacio = {
  xs: 4,
  s: 8,
  ms: 12,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Radios: s para etiquetas, m para controles, l para tarjetas y listas. */
export const radio = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  circulo: 999,
} as const;

/**
 * Elevacion: primero un borde fino; la sombra es suave (alfa menor a 0,08) y solo en lo que se toca
 * o lo que debe destacar. En web se usa boxShadow; en Android, elevation.
 */
export const elevacion = {
  plana: {},
  baja: { boxShadow: '0 1px 3px rgba(27, 26, 24, 0.06)', elevation: 1 },
  media: { boxShadow: '0 4px 14px rgba(27, 26, 24, 0.07)', elevation: 3 },
} as const;

/** Medidas minimas de accesibilidad del proyecto (texto de 18 px y botones de 56 px). */
export const medidas = {
  altoMinimoBoton: 56,
  /** Filas de lista y accesos del inicio: mas altos que un boton para dar aire al texto de dos lineas. */
  altoMinimoFila: 72,
  anchoMaximoContenido: 480,
  grosorFoco: 3,
  icono: 24,
  /** Cuadro que contiene el icono en accesos y filas. */
  cajaIcono: 48,
} as const;

export interface Tema {
  colores: Colores;
  tipo: EscalaTipografica;
  peso: typeof peso;
  espacio: typeof espacio;
  radio: typeof radio;
  elevacion: typeof elevacion;
  medidas: typeof medidas;
  tamano: TamanoLetra;
}

export function crearTema(tamano: TamanoLetra): Tema {
  return { colores, tipo: escalaTipografica(baseDe(tamano)), peso, espacio, radio, elevacion, medidas, tamano };
}
