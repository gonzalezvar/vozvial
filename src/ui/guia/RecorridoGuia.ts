// Estado del recorrido de bienvenida por pasos. Clase pura: la pantalla /guia solo la orquesta.

export class RecorridoGuia {
  private constructor(
    readonly total: number,
    readonly indice: number,
  ) {}

  static crear(total: number, indice = 0): RecorridoGuia {
    if (!Number.isInteger(total) || total < 1) throw new Error('El recorrido necesita al menos un paso');
    return new RecorridoGuia(total, RecorridoGuia.acotar(indice, total));
  }

  /** Lee el paso de la URL ("3" es el tercer paso). Cualquier valor raro vuelve al primero. */
  static desdeParametro(total: number, parametro: string | string[] | undefined): RecorridoGuia {
    const texto = Array.isArray(parametro) ? parametro[0] : parametro;
    const numero = texto && /^\d+$/.test(texto) ? Number(texto) - 1 : 0;
    return RecorridoGuia.crear(total, numero);
  }

  private static acotar(indice: number, total: number): number {
    if (!Number.isFinite(indice)) return 0;
    return Math.min(Math.max(Math.trunc(indice), 0), total - 1);
  }

  get esPrimero(): boolean {
    return this.indice === 0;
  }

  get esUltimo(): boolean {
    return this.indice === this.total - 1;
  }

  /** Numero del paso para mostrar y para la URL (empieza en 1). */
  get numero(): number {
    return this.indice + 1;
  }

  get textoProgreso(): string {
    return `Paso ${this.numero} de ${this.total}`;
  }

  siguiente(): RecorridoGuia {
    return this.esUltimo ? this : new RecorridoGuia(this.total, this.indice + 1);
  }

  atras(): RecorridoGuia {
    return this.esPrimero ? this : new RecorridoGuia(this.total, this.indice - 1);
  }
}
