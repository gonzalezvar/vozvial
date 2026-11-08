/**
 * Fecha del calendario civil (año, mes, día) sin hora ni huso horario.
 *
 * Los plazos legales se cuentan por días calendario. Usar Date para esto
 * produce errores cuando el huso del dispositivo corre la fecha un día, por
 * eso el dominio trabaja con esta clase inmutable. La aritmética se hace con
 * un número de días desde 1970-01-01 (algoritmo days_from_civil de Howard
 * Hinnant), sin pasar por Date.
 */

export class ErrorFechaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorFechaInvalida';
  }
}

/** 0 = domingo, 1 = lunes, ..., 6 = sábado (igual que Date.getDay). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Reloj = () => Date;

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const PATRON_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

const ANIO_MINIMO = 1;
const ANIO_MAXIMO = 9999;

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

/** Días transcurridos desde 1970-01-01 (puede ser negativo). */
function diasDesdeEpoca(anio: number, mes: number, dia: number): number {
  const y = mes <= 2 ? anio - 1 : anio;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilDesdeDias(dias: number): { anio: number; mes: number; dia: number } {
  const z = dias + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const dia = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const mes = mp < 10 ? mp + 3 : mp - 9;
  const anio = yoe + era * 400 + (mes <= 2 ? 1 : 0);
  return { anio, mes, dia };
}

function dosDigitos(n: number): string {
  return n.toString().padStart(2, '0');
}

export class FechaCivil {
  readonly anio: number;
  /** 1 = enero, ..., 12 = diciembre. */
  readonly mes: number;
  readonly dia: number;
  private readonly numeroDia: number;

  private constructor(anio: number, mes: number, dia: number) {
    this.anio = anio;
    this.mes = mes;
    this.dia = dia;
    this.numeroDia = diasDesdeEpoca(anio, mes, dia);
    Object.freeze(this);
  }

  /** Crea una fecha validando que exista en el calendario (rechaza 31 de abril, 29 de febrero no bisiesto, etc.). */
  static de(anio: number, mes: number, dia: number): FechaCivil {
    if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
      throw new ErrorFechaInvalida(`Año, mes y día deben ser enteros: ${anio}-${mes}-${dia}`);
    }
    if (anio < ANIO_MINIMO || anio > ANIO_MAXIMO) {
      throw new ErrorFechaInvalida(`Año fuera de rango (${ANIO_MINIMO}-${ANIO_MAXIMO}): ${anio}`);
    }
    if (mes < 1 || mes > 12) {
      throw new ErrorFechaInvalida(`Mes inválido: ${mes}`);
    }
    if (dia < 1 || dia > diasDelMes(anio, mes)) {
      throw new ErrorFechaInvalida(`Día inválido para ${anio}-${dosDigitos(mes)}: ${dia}`);
    }
    return new FechaCivil(anio, mes, dia);
  }

  /** Acepta solo el formato AAAA-MM-DD. */
  static desdeISO(texto: string): FechaCivil {
    const coincidencia = PATRON_ISO.exec(texto);
    if (!coincidencia) {
      throw new ErrorFechaInvalida(`Formato de fecha inválido, se espera AAAA-MM-DD: "${texto}"`);
    }
    return FechaCivil.de(Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3]));
  }

  /**
   * Fecha de hoy según la hora local del dispositivo. El reloj se inyecta para
   * poder probar con una fecha fija.
   */
  static hoy(reloj: Reloj = () => new Date()): FechaCivil {
    const ahora = reloj();
    if (Number.isNaN(ahora.getTime())) {
      throw new ErrorFechaInvalida('El reloj devolvió una fecha inválida');
    }
    return FechaCivil.de(ahora.getFullYear(), ahora.getMonth() + 1, ahora.getDate());
  }

  aISO(): string {
    return `${this.anio.toString().padStart(4, '0')}-${dosDigitos(this.mes)}-${dosDigitos(this.dia)}`;
  }

  diaSemana(): DiaSemana {
    // El 1 de enero de 1970 fue jueves (4).
    return ((((this.numeroDia + 4) % 7) + 7) % 7) as DiaSemana;
  }

  esFinDeSemana(): boolean {
    const d = this.diaSemana();
    return d === 0 || d === 6;
  }

  sumarDias(n: number): FechaCivil {
    if (!Number.isInteger(n)) {
      throw new ErrorFechaInvalida(`Solo se pueden sumar días enteros: ${n}`);
    }
    const { anio, mes, dia } = civilDesdeDias(this.numeroDia + n);
    return FechaCivil.de(anio, mes, dia);
  }

  /** Días calendario desde esta fecha hasta otra (positivo si la otra es posterior). */
  diasHasta(otra: FechaCivil): number {
    return otra.numeroDia - this.numeroDia;
  }

  /** Negativo si esta fecha es anterior, 0 si son iguales, positivo si es posterior. */
  comparar(otra: FechaCivil): number {
    return Math.sign(this.numeroDia - otra.numeroDia);
  }

  esIgual(otra: FechaCivil): boolean {
    return this.numeroDia === otra.numeroDia;
  }

  esAnterior(otra: FechaCivil): boolean {
    return this.numeroDia < otra.numeroDia;
  }

  esPosterior(otra: FechaCivil): boolean {
    return this.numeroDia > otra.numeroDia;
  }

  nombreDia(): string {
    return NOMBRES_DIA[this.diaSemana()];
  }

  nombreMes(): string {
    // El mes ya se validó entre 1 y 12.
    return NOMBRES_MES[this.mes - 1] as string;
  }

  /** "viernes 13 de noviembre de 2026" */
  formatoLargo(): string {
    return `${this.nombreDia()} ${this.dia} de ${this.nombreMes()} de ${this.anio}`;
  }

  toJSON(): string {
    return this.aISO();
  }

  toString(): string {
    return this.aISO();
  }
}
