import { FechaCivil } from './FechaCivil';

/**
 * Festivos nacionales de Colombia.
 *
 * Sustento: Ley 51 de 1983, art. 1 (entrada L51-1983-art1 de la base
 * normativa). La ley lista los días y dice cuáles se trasladan al lunes
 * siguiente cuando no caen en lunes (y también cuando caen en domingo).
 *
 * La ley no da la fecha de Jueves Santo, Viernes Santo, Ascensión, Corpus
 * Christi ni Sagrado Corazón: se calculan desde el Domingo de Pascua con el
 * algoritmo gregoriano anónimo (Meeus/Jones/Butcher). Ese cálculo es propio
 * de la app, no sale de la norma.
 *
 * Ley 2578 de 2026, art. 6 (L2578-2026-art6): declara festivo el 9 de julio
 * y remite a la Ley 51 para fijar el día de descanso, pero el 9 de julio no
 * está en la lista de traslado de la Ley 51. Esa regla requiere revisión
 * jurídica, así que por defecto no se cuenta y se reporta como "en revisión".
 */

export interface Festivo {
  /** Día en que se disfruta el descanso (ya trasladado si aplica). */
  fecha: FechaCivil;
  /** Nombre para mostrar. Si dos celebraciones caen el mismo día, se unen con " / ". */
  nombre: string;
  celebraciones: string[];
  trasladado: boolean;
  sustento: string[];
}

export interface FestivoEnRevision {
  fecha: FechaCivil;
  nombre: string;
  motivo: string;
  sustento: string[];
}

/**
 * Lo que necesita CalculadoraPlazos de un calendario. Permite inyectar un
 * calendario de prueba o el de otro país sin tocar la calculadora.
 */
export interface CalendarioFestivos {
  esFestivo(fecha: FechaCivil): boolean;
  festivo(fecha: FechaCivil): Festivo | null;
  /** Días que podrían ser festivos pero cuya regla no está decidida. */
  enRevision(fecha: FechaCivil): FestivoEnRevision | null;
  /** Ids de la base normativa que sustentan el calendario. */
  readonly sustento: readonly string[];
}

/**
 * Cómo tratar el 9 de julio (Ley 2578 de 2026):
 * - 'en_revision': no se cuenta como festivo y se reporta en enRevision (predeterminado).
 * - 'fijo': festivo el 9 de julio, sin traslado.
 * - 'trasladable': se aplica el traslado al lunes de la Ley 51.
 * Elegir 'fijo' o 'trasladable' requiere decisión del equipo con revisión jurídica.
 */
export type ReglaNueveDeJulio = 'en_revision' | 'fijo' | 'trasladable';

export interface OpcionesFestivos {
  reglaNueveDeJulio?: ReglaNueveDeJulio;
}

const ANIO_MINIMO = 1984;
const ID_LEY_51 = 'L51-1983-art1';
const ID_LEY_2578 = 'L2578-2026-art6';
const ANIO_INICIO_LEY_2578 = 2026;
const NOMBRE_NUEVE_JULIO = 'Nuestra Señora del Rosario de Chiquinquirá';

export class ErrorAnioNoSoportado extends Error {
  constructor(anio: number) {
    super(`Solo se calculan festivos desde ${ANIO_MINIMO} (Ley 51 de 1983) y años enteros: ${anio}`);
    this.name = 'ErrorAnioNoSoportado';
  }
}

interface Celebracion {
  nombre: string;
  fecha: FechaCivil;
  trasladable: boolean;
  sustento: string;
}

// Fechas fijas del numeral 1 del art. 1 de la Ley 51 de 1983. "trasladable"
// sigue la lista del numeral 2 del mismo artículo.
const FIJAS: readonly { mes: number; dia: number; nombre: string; trasladable: boolean }[] = [
  { mes: 1, dia: 1, nombre: 'Año Nuevo', trasladable: false },
  { mes: 1, dia: 6, nombre: 'Reyes Magos', trasladable: true },
  { mes: 3, dia: 19, nombre: 'San José', trasladable: true },
  { mes: 5, dia: 1, nombre: 'Día del Trabajo', trasladable: false },
  { mes: 6, dia: 29, nombre: 'San Pedro y San Pablo', trasladable: true },
  { mes: 7, dia: 20, nombre: 'Día de la Independencia', trasladable: false },
  { mes: 8, dia: 7, nombre: 'Batalla de Boyacá', trasladable: false },
  { mes: 8, dia: 15, nombre: 'Asunción de la Virgen', trasladable: true },
  { mes: 10, dia: 12, nombre: 'Día de la Raza', trasladable: true },
  { mes: 11, dia: 1, nombre: 'Todos los Santos', trasladable: true },
  { mes: 11, dia: 11, nombre: 'Independencia de Cartagena', trasladable: true },
  { mes: 12, dia: 8, nombre: 'Inmaculada Concepción', trasladable: false },
  { mes: 12, dia: 25, nombre: 'Navidad', trasladable: false },
];

// Desfase en días desde el Domingo de Pascua, antes del traslado.
const MOVILES: readonly { desfase: number; nombre: string; trasladable: boolean }[] = [
  { desfase: -3, nombre: 'Jueves Santo', trasladable: false },
  { desfase: -2, nombre: 'Viernes Santo', trasladable: false },
  { desfase: 39, nombre: 'Ascensión del Señor', trasladable: true },
  { desfase: 60, nombre: 'Corpus Christi', trasladable: true },
  { desfase: 68, nombre: 'Sagrado Corazón de Jesús', trasladable: true },
];

/** Lunes siguiente si la fecha no es lunes; si ya es lunes, la misma fecha. */
function trasladarALunes(fecha: FechaCivil): FechaCivil {
  const dia = fecha.diaSemana();
  if (dia === 1) return fecha;
  // Domingo (0) pasa a +1; martes (2) a +6; ...; sábado (6) a +2.
  return fecha.sumarDias((8 - dia) % 7);
}

export class FestivosColombia implements CalendarioFestivos {
  readonly reglaNueveDeJulio: ReglaNueveDeJulio;
  private readonly cache = new Map<number, { festivos: Festivo[]; enRevision: FestivoEnRevision[] }>();

  constructor(opciones: OpcionesFestivos = {}) {
    this.reglaNueveDeJulio = opciones.reglaNueveDeJulio ?? 'en_revision';
  }

  get sustento(): readonly string[] {
    return this.reglaNueveDeJulio === 'en_revision' ? [ID_LEY_51] : [ID_LEY_51, ID_LEY_2578];
  }

  /** Domingo de Pascua con el algoritmo gregoriano anónimo (Meeus/Jones/Butcher). */
  static domingoDePascua(anio: number): FechaCivil {
    const a = anio % 19;
    const b = Math.floor(anio / 100);
    const c = anio % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return FechaCivil.de(anio, mes, dia);
  }

  festivosDelAnio(anio: number): Festivo[] {
    return this.calcularAnio(anio).festivos.slice();
  }

  festivosEnRevisionDelAnio(anio: number): FestivoEnRevision[] {
    return this.calcularAnio(anio).enRevision.slice();
  }

  esFestivo(fecha: FechaCivil): boolean {
    return this.festivo(fecha) !== null;
  }

  festivo(fecha: FechaCivil): Festivo | null {
    return this.calcularAnio(fecha.anio).festivos.find((f) => f.fecha.esIgual(fecha)) ?? null;
  }

  enRevision(fecha: FechaCivil): FestivoEnRevision | null {
    return this.calcularAnio(fecha.anio).enRevision.find((f) => f.fecha.esIgual(fecha)) ?? null;
  }

  private calcularAnio(anio: number): { festivos: Festivo[]; enRevision: FestivoEnRevision[] } {
    if (!Number.isInteger(anio) || anio < ANIO_MINIMO) {
      throw new ErrorAnioNoSoportado(anio);
    }
    const enCache = this.cache.get(anio);
    if (enCache) return enCache;

    const celebraciones: Celebracion[] = FIJAS.map((c) => ({
      nombre: c.nombre,
      fecha: FechaCivil.de(anio, c.mes, c.dia),
      trasladable: c.trasladable,
      sustento: ID_LEY_51,
    }));
    const pascua = FestivosColombia.domingoDePascua(anio);
    for (const c of MOVILES) {
      celebraciones.push({ nombre: c.nombre, fecha: pascua.sumarDias(c.desfase), trasladable: c.trasladable, sustento: ID_LEY_51 });
    }

    const enRevision: FestivoEnRevision[] = [];
    if (anio >= ANIO_INICIO_LEY_2578) {
      const nueveJulio = FechaCivil.de(anio, 7, 9);
      if (this.reglaNueveDeJulio === 'en_revision') {
        enRevision.push(...this.posiblesNueveDeJulio(nueveJulio));
      } else {
        celebraciones.push({
          nombre: NOMBRE_NUEVE_JULIO,
          fecha: nueveJulio,
          trasladable: this.reglaNueveDeJulio === 'trasladable',
          sustento: ID_LEY_2578,
        });
      }
    }

    // Agrupa por día de descanso: en algunos años dos celebraciones caen el mismo lunes.
    const porDia = new Map<string, Festivo>();
    for (const c of celebraciones) {
      const fecha = c.trasladable ? trasladarALunes(c.fecha) : c.fecha;
      const trasladado = !fecha.esIgual(c.fecha);
      const clave = fecha.aISO();
      const existente = porDia.get(clave);
      if (existente) {
        existente.celebraciones.push(c.nombre);
        existente.nombre = existente.celebraciones.join(' / ');
        existente.trasladado = existente.trasladado || trasladado;
        if (!existente.sustento.includes(c.sustento)) existente.sustento.push(c.sustento);
      } else {
        porDia.set(clave, { fecha, nombre: c.nombre, celebraciones: [c.nombre], trasladado, sustento: [c.sustento] });
      }
    }

    const festivos = [...porDia.values()].sort((x, y) => x.fecha.comparar(y.fecha));
    const resultado = {
      festivos,
      // Un día que ya es festivo por la Ley 51 no queda en duda.
      enRevision: enRevision.filter((r) => !porDia.has(r.fecha.aISO())),
    };
    this.cache.set(anio, resultado);
    return resultado;
  }

  /** Días hábiles que serían festivo según cómo se interprete el traslado del 9 de julio. */
  private posiblesNueveDeJulio(nueveJulio: FechaCivil): FestivoEnRevision[] {
    const motivo =
      'La Ley 2578 de 2026 declara festivo el 9 de julio y remite a la Ley 51 de 1983, pero no dice si se pasa al lunes. ' +
      'Requiere revisión jurídica: por ahora no lo contamos como festivo.';
    const candidatos = [nueveJulio, trasladarALunes(nueveJulio)];
    const vistos = new Set<string>();
    const resultado: FestivoEnRevision[] = [];
    for (const fecha of candidatos) {
      if (fecha.esFinDeSemana() || vistos.has(fecha.aISO())) continue;
      vistos.add(fecha.aISO());
      resultado.push({ fecha, nombre: NOMBRE_NUEVE_JULIO, motivo, sustento: [ID_LEY_2578] });
    }
    return resultado;
  }
}
