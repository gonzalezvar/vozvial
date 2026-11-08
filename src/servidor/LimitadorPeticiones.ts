export interface ResultadoLimite {
  permitido: boolean;
  /** Milisegundos hasta que se abre la ventana siguiente (para Retry-After). */
  msRestantes: number;
}

/**
 * Limite simple de peticiones por clave (por ejemplo "sesiones|<ip>") con ventana fija, en memoria.
 * Sirve para una sola instancia, que es lo que corre en Railway; con varias instancias haria falta
 * un almacen compartido. No guarda nada mas que la clave y un contador.
 */
export class LimitadorPeticiones {
  private readonly ventanas = new Map<string, { inicio: number; cuenta: number }>();
  private ultimaLimpieza = 0;

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs = 60_000,
    private readonly reloj: () => number = () => Date.now(),
  ) {}

  registrar(clave: string): ResultadoLimite {
    const ahora = this.reloj();
    this.limpiar(ahora);
    let ventana = this.ventanas.get(clave);
    if (!ventana || ahora - ventana.inicio >= this.ventanaMs) {
      ventana = { inicio: ahora, cuenta: 0 };
      this.ventanas.set(clave, ventana);
    }
    ventana.cuenta += 1;
    const msRestantes = ventana.inicio + this.ventanaMs - ahora;
    return { permitido: ventana.cuenta <= this.maximo, msRestantes };
  }

  private limpiar(ahora: number): void {
    if (ahora - this.ultimaLimpieza < this.ventanaMs) return;
    this.ultimaLimpieza = ahora;
    for (const [clave, ventana] of this.ventanas) {
      if (ahora - ventana.inicio >= this.ventanaMs) this.ventanas.delete(clave);
    }
  }
}
