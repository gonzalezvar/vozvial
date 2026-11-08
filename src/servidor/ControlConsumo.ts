/**
 * Topes de consumo del asistente con Claude, en memoria (SOLO SERVIDOR).
 *
 * Cada consulta a Claude cuesta créditos de la API, y el endpoint es público y sin
 * cuenta. Hay dos topes:
 * - Por cliente (IP): N por minuto y M por día. Al pasarse, el endpoint responde 429.
 * - Global por día: al pasarse, ya no se llama a Claude y responde el modo verificado.
 *
 * Ventanas fijas que empiezan con la primera petición. Sirve para una sola instancia,
 * que es lo que corre en Railway; con varias instancias haría falta un almacén
 * compartido. Solo guarda la IP y un contador, nunca la pregunta, y olvida las
 * ventanas vencidas.
 */
export interface LimitesConsumo {
  porMinuto: number;
  porDia: number;
  globalPorDia: number;
}

export interface ResultadoCupo {
  permitido: boolean;
  /** Milisegundos hasta que se abre la ventana que bloqueó (para Retry-After). */
  msRestantes: number;
}

export const LIMITES_PREDETERMINADOS: LimitesConsumo = { porMinuto: 10, porDia: 100, globalPorDia: 300 };

const MINUTO_MS = 60_000;
const DIA_MS = 24 * 60 * 60_000;

interface Ventana {
  inicio: number;
  cuenta: number;
}

class Contador {
  private readonly ventanas = new Map<string, Ventana>();
  private ultimaLimpieza = 0;

  constructor(
    private readonly maximo: number,
    private readonly duracionMs: number,
  ) {}

  /** Suma una petición a la clave y dice si sigue dentro del tope. */
  sumar(clave: string, ahora: number): ResultadoCupo {
    this.limpiar(ahora);
    let ventana = this.ventanas.get(clave);
    if (!ventana || ahora - ventana.inicio >= this.duracionMs) {
      ventana = { inicio: ahora, cuenta: 0 };
      this.ventanas.set(clave, ventana);
    }
    ventana.cuenta += 1;
    return { permitido: ventana.cuenta <= this.maximo, msRestantes: ventana.inicio + this.duracionMs - ahora };
  }

  private limpiar(ahora: number): void {
    if (ahora - this.ultimaLimpieza < MINUTO_MS) return;
    this.ultimaLimpieza = ahora;
    for (const [clave, ventana] of this.ventanas) {
      if (ahora - ventana.inicio >= this.duracionMs) this.ventanas.delete(clave);
    }
  }
}

export class ControlConsumo {
  private readonly minuto: Contador;
  private readonly dia: Contador;
  private readonly global: Contador;

  constructor(
    readonly limites: LimitesConsumo = LIMITES_PREDETERMINADOS,
    private readonly reloj: () => number = () => Date.now(),
  ) {
    this.minuto = new Contador(limites.porMinuto, MINUTO_MS);
    this.dia = new Contador(limites.porDia, DIA_MS);
    this.global = new Contador(limites.globalPorDia, DIA_MS);
  }

  /** Lee ASISTENTE_LIMITE_MINUTO, ASISTENTE_LIMITE_DIA y ASISTENTE_LIMITE_GLOBAL_DIA (enteros positivos). */
  static limitesDesdeEntorno(env: Record<string, string | undefined>): LimitesConsumo {
    const leer = (nombre: string, predeterminado: number) => {
      const valor = Number(env[nombre]);
      return Number.isInteger(valor) && valor > 0 ? valor : predeterminado;
    };
    return {
      porMinuto: leer('ASISTENTE_LIMITE_MINUTO', LIMITES_PREDETERMINADOS.porMinuto),
      porDia: leer('ASISTENTE_LIMITE_DIA', LIMITES_PREDETERMINADOS.porDia),
      globalPorDia: leer('ASISTENTE_LIMITE_GLOBAL_DIA', LIMITES_PREDETERMINADOS.globalPorDia),
    };
  }

  /** Registra una petición del cliente. Cuenta en las dos ventanas aunque una ya esté llena. */
  registrarCliente(clave: string): ResultadoCupo {
    const ahora = this.reloj();
    const porMinuto = this.minuto.sumar(clave, ahora);
    const porDia = this.dia.sumar(clave, ahora);
    if (!porDia.permitido) return porDia;
    return porMinuto;
  }

  /** Consume una consulta del cupo global diario. false: no se debe llamar a Claude. */
  consumirGlobal(): boolean {
    return this.global.sumar('global', this.reloj()).permitido;
  }
}
