import { Caso, type DatosCaso } from '../core/Caso';
import type { Evidencia } from '../core/Evidencia';
import type { AlmacenCifrado } from './AlmacenCifrado';

export type DatosNuevoCaso = Omit<DatosCaso, 'id' | 'creadoEn'> & { id?: string; creadoEn?: string };

export class ErrorSinSesion extends Error {
  constructor() {
    super('No hay sesión abierta. Entra con tu PIN.');
    this.name = 'ErrorSinSesion';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Casos y evidencias del usuario, siempre cifrados con la clave de datos de la sesion activa. */
export class RepositorioCasos {
  constructor(
    private readonly almacen: AlmacenCifrado,
    private readonly obtenerClave: () => CryptoKey | null,
    private readonly crypto: Crypto,
    private readonly reloj: () => Date = () => new Date(),
  ) {}

  async crear(datos: DatosNuevoCaso): Promise<Caso> {
    const caso = Caso.crear({
      ...datos,
      id: datos.id ?? this.nuevoId(),
      creadoEn: datos.creadoEn ?? this.reloj().toISOString(),
    });
    await this.guardar(caso);
    return caso;
  }

  async guardar(caso: Caso): Promise<void> {
    await this.almacen.guardarCaso(this.clave(), caso);
  }

  obtener(id: string): Promise<Caso | null> {
    return this.almacen.leerCaso(this.clave(), id);
  }

  /** Del mas reciente al mas antiguo. */
  async listar(): Promise<Caso[]> {
    const casos = await this.almacen.listarCasos(this.clave());
    return casos.sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn));
  }

  borrar(id: string): Promise<void> {
    return this.almacen.borrarCaso(id);
  }

  /** Guarda primero el contenido cifrado (audio o foto) y luego el caso con la evidencia nueva. */
  async agregarEvidencia(caso: Caso, evidencia: Evidencia, bytes?: Uint8Array): Promise<Caso> {
    const clave = this.clave();
    if (bytes) await this.almacen.guardarContenidoEvidencia(clave, evidencia.id, caso.id, bytes);
    const actualizado = caso.agregarEvidencia(evidencia);
    await this.almacen.guardarCaso(clave, actualizado);
    return actualizado;
  }

  async quitarEvidencia(caso: Caso, evidenciaId: string): Promise<Caso> {
    const actualizado = caso.quitarEvidencia(evidenciaId);
    await this.almacen.guardarCaso(this.clave(), actualizado);
    await this.almacen.borrarContenidoEvidencia(evidenciaId);
    return actualizado;
  }

  leerContenido(evidenciaId: string): Promise<Uint8Array<ArrayBuffer>> {
    return this.almacen.leerContenidoEvidencia(this.clave(), evidenciaId);
  }

  /** Identificador aleatorio sin datos del usuario. */
  nuevoId(): string {
    if (typeof this.crypto.randomUUID === 'function') return this.crypto.randomUUID();
    const b = this.crypto.getRandomValues(new Uint8Array(16));
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  private clave(): CryptoKey {
    const clave = this.obtenerClave();
    if (!clave) throw new ErrorSinSesion();
    return clave;
  }
}
