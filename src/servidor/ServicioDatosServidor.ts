import type { Consultor } from './bd/conexion';
import {
  RepositorioCasosRemotos,
  RepositorioEvidenciasRemotas,
  type EvidenciaRemota,
  type MetadatosEvidenciaRemota,
  type RegistroCasoRemoto,
  type ResultadoEscritura,
} from './bd/RepositorioDatosCifrados';

export interface LimitesDatos {
  maxBytesEvidencia: number;
  cuotaCuentaBytes: number;
}

export type ResultadoEvidencia =
  | { ok: true; resultado: ResultadoEscritura<MetadatosEvidenciaRemota> }
  | { ok: false; error: 'muy_grande' | 'cuota_excedida' | 'caso_no_encontrado' | 'vacia' };

/**
 * Casos y evidencias cifrados de una cuenta. El servidor no tiene la clave: solo guarda,
 * compara marcas de tiempo (gana el mas reciente) y aplica limites de tamano.
 */
export class ServicioDatosServidor {
  private readonly casos: RepositorioCasosRemotos;
  private readonly evidencias: RepositorioEvidenciasRemotas;

  constructor(
    bd: Consultor,
    private readonly limites: LimitesDatos,
  ) {
    this.casos = new RepositorioCasosRemotos(bd);
    this.evidencias = new RepositorioEvidenciasRemotas(bd);
  }

  listarCasos(cuentaId: string, desde?: string): Promise<RegistroCasoRemoto[]> {
    return this.casos.listar(cuentaId, desde);
  }

  obtenerCaso(cuentaId: string, id: string): Promise<RegistroCasoRemoto | null> {
    return this.casos.obtener(cuentaId, id);
  }

  guardarCaso(
    cuentaId: string,
    registro: { id: string; iv: string; datos: string; actualizadoEn: string },
  ): Promise<ResultadoEscritura<RegistroCasoRemoto>> {
    return this.casos.guardar(cuentaId, registro);
  }

  borrarCaso(cuentaId: string, id: string, actualizadoEn: string): Promise<ResultadoEscritura<RegistroCasoRemoto>> {
    return this.casos.borrar(cuentaId, id, actualizadoEn);
  }

  borrarCasos(cuentaId: string, actualizadoEn: string): Promise<number> {
    return this.casos.borrarTodos(cuentaId, actualizadoEn);
  }

  listarEvidencias(cuentaId: string): Promise<MetadatosEvidenciaRemota[]> {
    return this.evidencias.listar(cuentaId);
  }

  obtenerEvidencia(cuentaId: string, id: string): Promise<EvidenciaRemota | null> {
    return this.evidencias.obtener(cuentaId, id);
  }

  async guardarEvidencia(
    cuentaId: string,
    e: { id: string; casoId: string; iv: string; mime: string; actualizadoEn: string; datos: Uint8Array },
  ): Promise<ResultadoEvidencia> {
    if (e.datos.byteLength === 0) return { ok: false, error: 'vacia' };
    if (e.datos.byteLength > this.limites.maxBytesEvidencia) return { ok: false, error: 'muy_grande' };
    const usados = await this.evidencias.bytesUsados(cuentaId, e.id);
    if (usados + e.datos.byteLength > this.limites.cuotaCuentaBytes) return { ok: false, error: 'cuota_excedida' };
    const resultado = await this.evidencias.guardar(cuentaId, e);
    if (!resultado) return { ok: false, error: 'caso_no_encontrado' };
    return { ok: true, resultado };
  }

  borrarEvidencia(cuentaId: string, id: string): Promise<boolean> {
    return this.evidencias.borrar(cuentaId, id);
  }
}
