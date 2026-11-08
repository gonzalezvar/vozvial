import parametrosJSON from '../../data/normativa/parametros.json';
import { CalculadoraPlazos, type DiasRestantes, type ResultadoPlazo } from '../core/CalculadoraPlazos';
import type { Caso } from '../core/Caso';
import type { Comparendo } from '../core/Comparendo';
import { FechaCivil, type Reloj } from '../core/FechaCivil';
import { FestivosColombia } from '../core/FestivosColombia';
import { ParametrosPlazos, type ParametrosJSON } from '../core/ParametrosPlazos';

/**
 * vencido: ya pasó la fecha límite.
 * hoy: hoy es el último día (CA-12.2).
 * urgente: quedan DIAS_AVISO días hábiles o menos (CA-12.1).
 * en_tiempo: quedan más días.
 */
export type NivelPlazo = 'vencido' | 'hoy' | 'urgente' | 'en_tiempo';

/** CA-12.1: se avisa cuando faltan 2 días hábiles o menos. */
export const DIAS_AVISO = 2;

/** Lo que el conductor debe hacer dentro del plazo, según la descripción de los parámetros verificados. */
export const ACCION_PLAZO = 'presentarte ante la autoridad de tránsito';

export interface EstadoPlazo {
  resultado: ResultadoPlazo;
  hoy: FechaCivil;
  restantes: DiasRestantes;
  nivel: NivelPlazo;
  /** "Te quedan N días hábiles", "Hoy vence tu plazo para …" o "El plazo venció el …". */
  mensaje: string;
}

export interface AlertaPlazo {
  casoId: string;
  numeroComparendo: string;
  estado: EstadoPlazo;
}

const ORDEN_NIVEL: Readonly<Record<NivelPlazo, number>> = { hoy: 0, urgente: 1, en_tiempo: 2, vencido: 3 };

/**
 * Plazos de los comparendos del conductor. Arma CalculadoraPlazos con los
 * parámetros verificados de data/normativa/parametros.json y los festivos de
 * Colombia. El reloj se inyecta: en e2e lo controla page.clock.
 */
export class ServicioPlazos {
  constructor(
    private readonly calculadora: CalculadoraPlazos,
    private readonly reloj: Reloj = () => new Date(),
  ) {}

  /** Lanza ErrorParametroNoVerificado si algún parámetro de plazo no está verificado. */
  static crear(opciones: { reloj?: Reloj; parametros?: ParametrosJSON } = {}): ServicioPlazos {
    const parametros = ParametrosPlazos.desdeJSON(opciones.parametros ?? (parametrosJSON as unknown as ParametrosJSON));
    return new ServicioPlazos(new CalculadoraPlazos(new FestivosColombia(), parametros), opciones.reloj);
  }

  hoy(): FechaCivil {
    return FechaCivil.hoy(this.reloj);
  }

  calcular(comparendo: Comparendo): ResultadoPlazo {
    return this.calculadora.calcular({ tipo: comparendo.tipo, fechaBase: comparendo.fechaBasePlazo() });
  }

  estado(comparendo: Comparendo): EstadoPlazo {
    const resultado = this.calcular(comparendo);
    const hoy = this.hoy();
    const restantes = this.calculadora.diasHabilesRestantes(hoy, resultado.fechaLimite);
    const nivel: NivelPlazo = restantes.vencido
      ? 'vencido'
      : restantes.esHoy
        ? 'hoy'
        : restantes.dias <= DIAS_AVISO
          ? 'urgente'
          : 'en_tiempo';
    return { resultado, hoy, restantes, nivel, mensaje: ServicioPlazos.mensaje(nivel, restantes, resultado) };
  }

  /** Estado del plazo de un caso, o null si todavía no tiene comparendo. */
  estadoDeCaso(caso: Caso): EstadoPlazo | null {
    return caso.comparendo ? this.estado(caso.comparendo) : null;
  }

  /** Casos abiertos cuyo plazo vence hoy o en DIAS_AVISO días hábiles o menos, el más próximo primero. */
  alertas(casos: readonly Caso[]): AlertaPlazo[] {
    const salida: AlertaPlazo[] = [];
    for (const caso of casos) {
      if (caso.estado === 'cerrado' || !caso.comparendo) continue;
      const estado = this.estado(caso.comparendo);
      if (estado.nivel === 'hoy' || estado.nivel === 'urgente') {
        salida.push({ casoId: caso.id, numeroComparendo: caso.comparendo.numero, estado });
      }
    }
    return salida.sort(
      (a, b) => ORDEN_NIVEL[a.estado.nivel] - ORDEN_NIVEL[b.estado.nivel] || a.estado.restantes.dias - b.estado.restantes.dias,
    );
  }

  static mensaje(nivel: NivelPlazo, restantes: DiasRestantes, resultado: ResultadoPlazo): string {
    switch (nivel) {
      case 'vencido':
        return `El plazo venció el ${resultado.fechaLimite.formatoLargo()}.`;
      case 'hoy':
        return `Hoy vence tu plazo para ${ACCION_PLAZO}.`;
      default:
        return restantes.dias === 1 ? 'Te queda 1 día hábil.' : `Te quedan ${restantes.dias} días hábiles.`;
    }
  }
}

let compartido: ServicioPlazos | null = null;

/** Instancia de la app con el reloj del dispositivo. */
export function obtenerServicioPlazos(): ServicioPlazos {
  compartido ??= ServicioPlazos.crear();
  return compartido;
}
