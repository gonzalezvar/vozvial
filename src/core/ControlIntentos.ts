export interface OpcionesControlIntentos {
  maxIntentos?: number;
  /** Duracion del bloqueo. CA-02.3 pide 5 minutos; en pruebas se acorta. */
  bloqueoMs?: number;
  reloj?: () => Date;
}

export interface EstadoIntentos {
  bloqueado: boolean;
  intentosRestantes: number;
  msRestantes: number;
}

export interface IntentosSerializados {
  fallos: number;
  /** Instante (ms epoch) en que termina el bloqueo, o null si no hay bloqueo. */
  bloqueadoHasta: number | null;
}

export const MAX_INTENTOS_POR_DEFECTO = 5;
export const BLOQUEO_MS_POR_DEFECTO = 5 * 60 * 1000;

/**
 * Cuenta los PIN fallidos seguidos (HU-02). Al llegar a maxIntentos bloquea
 * durante bloqueoMs; cuando el bloqueo vence, el contador vuelve a cero.
 */
export class ControlIntentos {
  readonly maxIntentos: number;
  readonly bloqueoMs: number;
  private readonly reloj: () => Date;
  private fallos = 0;
  private bloqueadoHasta: number | null = null;

  constructor(opciones: OpcionesControlIntentos = {}) {
    this.maxIntentos = opciones.maxIntentos ?? MAX_INTENTOS_POR_DEFECTO;
    this.bloqueoMs = opciones.bloqueoMs ?? BLOQUEO_MS_POR_DEFECTO;
    this.reloj = opciones.reloj ?? (() => new Date());
    if (!Number.isInteger(this.maxIntentos) || this.maxIntentos < 1) {
      throw new RangeError('maxIntentos debe ser un entero mayor que 0');
    }
    if (!Number.isFinite(this.bloqueoMs) || this.bloqueoMs <= 0) {
      throw new RangeError('bloqueoMs debe ser un numero mayor que 0');
    }
  }

  /** Durante el bloqueo no cuenta fallos nuevos ni alarga el bloqueo. */
  registrarFallo(): EstadoIntentos {
    this.liberarSiVencio();
    if (this.bloqueadoHasta !== null) return this.estado();
    this.fallos += 1;
    if (this.fallos >= this.maxIntentos) {
      this.bloqueadoHasta = this.ahora() + this.bloqueoMs;
    }
    return this.estado();
  }

  registrarExito(): EstadoIntentos {
    this.fallos = 0;
    this.bloqueadoHasta = null;
    return this.estado();
  }

  estado(): EstadoIntentos {
    this.liberarSiVencio();
    if (this.bloqueadoHasta !== null) {
      return {
        bloqueado: true,
        intentosRestantes: 0,
        msRestantes: this.bloqueadoHasta - this.ahora(),
      };
    }
    return {
      bloqueado: false,
      intentosRestantes: this.maxIntentos - this.fallos,
      msRestantes: 0,
    };
  }

  serializar(): IntentosSerializados {
    this.liberarSiVencio();
    return { fallos: this.fallos, bloqueadoHasta: this.bloqueadoHasta };
  }

  /** Acepta el objeto de serializar() o su JSON en texto. Datos invalidos dan un control limpio. */
  static desdeJSON(
    json: IntentosSerializados | string | null | undefined,
    opciones: OpcionesControlIntentos = {},
  ): ControlIntentos {
    const control = new ControlIntentos(opciones);
    let datos: unknown = json;
    if (typeof json === 'string') {
      try {
        datos = JSON.parse(json);
      } catch {
        datos = null;
      }
    }
    if (typeof datos !== 'object' || datos === null) return control;
    const { fallos, bloqueadoHasta } = datos as Record<string, unknown>;
    if (typeof fallos === 'number' && Number.isInteger(fallos) && fallos >= 0) {
      control.fallos = Math.min(fallos, control.maxIntentos);
    }
    if (typeof bloqueadoHasta === 'number' && Number.isFinite(bloqueadoHasta)) {
      // Si alguien edita el almacenamiento, el bloqueo nunca dura mas de bloqueoMs desde ahora.
      control.bloqueadoHasta = Math.min(bloqueadoHasta, control.ahora() + control.bloqueoMs);
    }
    control.liberarSiVencio();
    return control;
  }

  private ahora(): number {
    return this.reloj().getTime();
  }

  private liberarSiVencio(): void {
    if (this.bloqueadoHasta !== null && this.ahora() >= this.bloqueadoHasta) {
      this.bloqueadoHasta = null;
      this.fallos = 0;
    }
  }
}
