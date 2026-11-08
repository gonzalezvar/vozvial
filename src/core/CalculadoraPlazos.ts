import { FechaCivil } from './FechaCivil';
import type { CalendarioFestivos, Festivo, FestivoEnRevision } from './FestivosColombia';
import type { ParametrosPlazos, PuntoPartida, TipoPlazo } from './ParametrosPlazos';

/**
 * Calcula la fecha límite de un plazo en días hábiles: sin sábados, domingos
 * ni festivos. Cuántos días y desde cuándo se cuentan lo dicen los
 * ParametrosPlazos (sacados de la base normativa), no esta clase.
 */

export interface SolicitudPlazo {
  tipo: TipoPlazo;
  /** Fecha del comparendo (vía) o de la notificación (fotodetección), según el punto de partida del parámetro. */
  fechaBase: FechaCivil;
}

export interface ResultadoPlazo {
  tipo: TipoPlazo;
  fechaBase: FechaCivil;
  fechaLimite: FechaCivil;
  diasHabiles: number;
  puntoPartida: PuntoPartida;
  /** Festivos entre fechaBase (excluida) y fechaLimite que no se contaron. */
  festivosOmitidos: Festivo[];
  /** Días dentro del plazo cuya condición de festivo está en revisión jurídica. */
  diasEnRevision: FestivoEnRevision[];
  advertencias: string[];
  explicacion: string;
  /** Ids de la base normativa: los del parámetro y los del calendario de festivos. */
  sustento: string[];
}

export interface DiasRestantes {
  /** Días hábiles después de hoy hasta la fecha límite, incluida. 0 si hoy es el último día o ya venció. */
  dias: number;
  vencido: boolean;
  /** Hoy es el último día del plazo. */
  esHoy: boolean;
}

const DESCRIPCION_PUNTO_PARTIDA: Readonly<Record<PuntoPartida, { desde: string; usamos: string }>> = {
  dia_siguiente_evento: {
    desde: 'Contamos desde el día siguiente al comparendo',
    usamos: 'usamos la fecha del comparendo',
  },
  dia_siguiente_notificacion: {
    desde: 'Contamos desde el día siguiente a la notificación',
    usamos: 'usamos la fecha en que recibiste la notificación',
  },
};

function plural(n: number, singular: string, varios: string): string {
  return n === 1 ? singular : varios;
}

export class CalculadoraPlazos {
  constructor(
    private readonly festivos: CalendarioFestivos,
    private readonly parametros: ParametrosPlazos,
  ) {}

  esDiaHabil(fecha: FechaCivil): boolean {
    return !fecha.esFinDeSemana() && !this.festivos.esFestivo(fecha);
  }

  calcular(solicitud: SolicitudPlazo): ResultadoPlazo {
    const parametro = this.parametros.obtener(solicitud.tipo);
    const { fechaBase } = solicitud;

    // Los dos puntos de partida conocidos empiezan el día siguiente a la fecha base.
    let cursor = fechaBase;
    let contados = 0;
    const festivosOmitidos: Festivo[] = [];
    const diasEnRevision: FestivoEnRevision[] = [];
    while (contados < parametro.diasHabiles) {
      cursor = cursor.sumarDias(1);
      if (cursor.esFinDeSemana()) continue;
      const festivo = this.festivos.festivo(cursor);
      if (festivo) {
        festivosOmitidos.push(festivo);
        continue;
      }
      const revision = this.festivos.enRevision(cursor);
      if (revision) diasEnRevision.push(revision);
      contados++;
    }
    const fechaLimite = cursor;

    const advertencias = diasEnRevision.map(
      (r) =>
        `El ${r.fecha.formatoLargo()} podría ser festivo (${r.nombre}). ${r.motivo} ` +
        'Si lo fuera, tu plazo iría un día hábil más.',
    );

    const sustento = [...new Set([...parametro.sustento, ...this.festivos.sustento])];

    return {
      tipo: solicitud.tipo,
      fechaBase,
      fechaLimite,
      diasHabiles: parametro.diasHabiles,
      puntoPartida: parametro.puntoPartida,
      festivosOmitidos,
      diasEnRevision,
      advertencias,
      explicacion: this.explicar(parametro.puntoPartida, parametro.diasHabiles, fechaBase, fechaLimite, festivosOmitidos, advertencias),
      sustento,
    };
  }

  diasHabilesRestantes(hoy: FechaCivil, fechaLimite: FechaCivil): DiasRestantes {
    if (hoy.esPosterior(fechaLimite)) return { dias: 0, vencido: true, esHoy: false };
    if (hoy.esIgual(fechaLimite)) return { dias: 0, vencido: false, esHoy: true };
    let dias = 0;
    for (let f = hoy.sumarDias(1); !f.esPosterior(fechaLimite); f = f.sumarDias(1)) {
      if (this.esDiaHabil(f)) dias++;
    }
    return { dias, vencido: false, esHoy: false };
  }

  private explicar(
    puntoPartida: PuntoPartida,
    diasHabiles: number,
    fechaBase: FechaCivil,
    fechaLimite: FechaCivil,
    festivosOmitidos: Festivo[],
    advertencias: string[],
  ): string {
    const textos = DESCRIPCION_PUNTO_PARTIDA[puntoPartida];
    const partes = [
      `${textos.desde}: ${textos.usamos}, ${fechaBase.formatoLargo()}.`,
      `Sumamos ${diasHabiles} ${plural(diasHabiles, 'día hábil', 'días hábiles')}, sin sábados, domingos ni festivos.`,
    ];
    if (festivosOmitidos.length > 0) {
      const lista = festivosOmitidos.map((f) => `${f.fecha.formatoLargo()} (${f.nombre})`).join('; ');
      partes.push(`${plural(festivosOmitidos.length, 'No contamos este festivo', 'No contamos estos festivos')}: ${lista}.`);
    }
    partes.push(`Tu fecha límite es el ${fechaLimite.formatoLargo()}.`);
    partes.push(...advertencias);
    return partes.join(' ');
  }
}
