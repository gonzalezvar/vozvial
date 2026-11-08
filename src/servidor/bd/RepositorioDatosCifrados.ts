import { aBytes, aISO, type Consultor } from './conexion';

/** Caso tal como lo guarda el servidor: el JSON del caso cifrado con AES-GCM por el cliente. */
export interface RegistroCasoRemoto {
  id: string;
  /** Base64; vacio en un borrado. */
  iv: string;
  /** Base64; vacio en un borrado. */
  datos: string;
  actualizadoEn: string;
  borrado: boolean;
}

export interface MetadatosEvidenciaRemota {
  id: string;
  casoId: string;
  /** IV de AES-GCM en base64. */
  iv: string;
  mime: string;
  /** Bytes del contenido cifrado. */
  tamano: number;
  actualizadoEn: string;
}

export interface EvidenciaRemota extends MetadatosEvidenciaRemota {
  datos: Uint8Array;
}

export interface ResultadoEscritura<T> {
  /** false si el servidor ya tenia una version mas reciente (gana el mas reciente). */
  aplicado: boolean;
  actual: T;
}

interface FilaCaso {
  id: string;
  iv: string;
  datos: string;
  actualizado_en: unknown;
  borrado: boolean;
}

interface FilaEvidencia {
  id: string;
  caso_id: string;
  iv: string;
  mime: string;
  tamano: number;
  actualizado_en: unknown;
  datos?: unknown;
}

function caso(f: FilaCaso): RegistroCasoRemoto {
  return { id: f.id, iv: f.iv, datos: f.datos, actualizadoEn: aISO(f.actualizado_en), borrado: f.borrado === true };
}

function metadatos(f: FilaEvidencia): MetadatosEvidenciaRemota {
  return {
    id: f.id,
    casoId: f.caso_id,
    iv: f.iv,
    mime: f.mime,
    tamano: Number(f.tamano),
    actualizadoEn: aISO(f.actualizado_en),
  };
}

/** Todas las consultas filtran por cuenta_id: una cuenta nunca lee ni pisa datos de otra. */
export class RepositorioCasosRemotos {
  constructor(private readonly bd: Consultor) {}

  async listar(cuentaId: string, desde?: string): Promise<RegistroCasoRemoto[]> {
    const filas = await this.bd.consultar<FilaCaso>(
      `SELECT id, iv, datos, actualizado_en, borrado FROM casos
       WHERE cuenta_id = $1 AND ($2::timestamptz IS NULL OR actualizado_en > $2::timestamptz)
       ORDER BY actualizado_en, id`,
      [cuentaId, desde ?? null],
    );
    return filas.map(caso);
  }

  async obtener(cuentaId: string, id: string): Promise<RegistroCasoRemoto | null> {
    const filas = await this.bd.consultar<FilaCaso>(
      'SELECT id, iv, datos, actualizado_en, borrado FROM casos WHERE cuenta_id = $1 AND id = $2',
      [cuentaId, id],
    );
    return filas[0] ? caso(filas[0]) : null;
  }

  /** Inserta o reemplaza solo si la version que llega es mas reciente que la guardada. */
  async guardar(
    cuentaId: string,
    registro: { id: string; iv: string; datos: string; actualizadoEn: string },
  ): Promise<ResultadoEscritura<RegistroCasoRemoto>> {
    const filas = await this.bd.consultar<FilaCaso>(
      `INSERT INTO casos (cuenta_id, id, iv, datos, actualizado_en, borrado)
       VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (cuenta_id, id) DO UPDATE
         SET iv = EXCLUDED.iv, datos = EXCLUDED.datos, actualizado_en = EXCLUDED.actualizado_en, borrado = false
         WHERE casos.actualizado_en < EXCLUDED.actualizado_en
       RETURNING id, iv, datos, actualizado_en, borrado`,
      [cuentaId, registro.id, registro.iv, registro.datos, new Date(registro.actualizadoEn)],
    );
    if (filas[0]) return { aplicado: true, actual: caso(filas[0]) };
    const actual = await this.obtener(cuentaId, registro.id);
    if (!actual) throw new Error('El caso desaparecio durante la escritura');
    return { aplicado: false, actual };
  }

  /**
   * Borrado con marca: el caso queda como { borrado: true } sin datos, para que los otros
   * dispositivos lo borren al sincronizar. El contenido de sus evidencias se elimina de verdad.
   */
  async borrar(cuentaId: string, id: string, actualizadoEn: string): Promise<ResultadoEscritura<RegistroCasoRemoto>> {
    const filas = await this.bd.consultar<FilaCaso>(
      `INSERT INTO casos (cuenta_id, id, iv, datos, actualizado_en, borrado)
       VALUES ($1, $2, '', '', $3, true)
       ON CONFLICT (cuenta_id, id) DO UPDATE
         SET iv = '', datos = '', actualizado_en = EXCLUDED.actualizado_en, borrado = true
         WHERE casos.actualizado_en <= EXCLUDED.actualizado_en
       RETURNING id, iv, datos, actualizado_en, borrado`,
      [cuentaId, id, new Date(actualizadoEn)],
    );
    if (filas[0]) {
      await this.bd.consultar('DELETE FROM evidencias WHERE cuenta_id = $1 AND caso_id = $2', [cuentaId, id]);
      return { aplicado: true, actual: caso(filas[0]) };
    }
    const actual = await this.obtener(cuentaId, id);
    if (!actual) throw new Error('El caso desaparecio durante el borrado');
    return { aplicado: false, actual };
  }

  /** Marca como borrados todos los casos de la cuenta y elimina todas sus evidencias. */
  async borrarTodos(cuentaId: string, actualizadoEn: string): Promise<number> {
    const filas = await this.bd.consultar<{ id: string }>(
      `UPDATE casos SET iv = '', datos = '', borrado = true, actualizado_en = $2
       WHERE cuenta_id = $1 AND borrado = false
       RETURNING id`,
      [cuentaId, new Date(actualizadoEn)],
    );
    await this.bd.consultar('DELETE FROM evidencias WHERE cuenta_id = $1', [cuentaId]);
    return filas.length;
  }
}

export class RepositorioEvidenciasRemotas {
  constructor(private readonly bd: Consultor) {}

  async listar(cuentaId: string): Promise<MetadatosEvidenciaRemota[]> {
    const filas = await this.bd.consultar<FilaEvidencia>(
      `SELECT id, caso_id, iv, mime, tamano, actualizado_en FROM evidencias
       WHERE cuenta_id = $1 ORDER BY actualizado_en, id`,
      [cuentaId],
    );
    return filas.map(metadatos);
  }

  async obtener(cuentaId: string, id: string): Promise<EvidenciaRemota | null> {
    const filas = await this.bd.consultar<FilaEvidencia>(
      'SELECT id, caso_id, iv, mime, tamano, actualizado_en, datos FROM evidencias WHERE cuenta_id = $1 AND id = $2',
      [cuentaId, id],
    );
    const f = filas[0];
    return f ? { ...metadatos(f), datos: aBytes(f.datos) } : null;
  }

  /** Bytes cifrados que ocupa la cuenta, sin contar la evidencia que se va a reemplazar. */
  async bytesUsados(cuentaId: string, excepto?: string): Promise<number> {
    const filas = await this.bd.consultar<{ total: number | string | null }>(
      'SELECT coalesce(sum(tamano), 0) AS total FROM evidencias WHERE cuenta_id = $1 AND id <> $2',
      [cuentaId, excepto ?? ''],
    );
    return Number(filas[0]?.total ?? 0);
  }

  /** null si el caso no existe o esta borrado: no se guardan evidencias sueltas. */
  async guardar(
    cuentaId: string,
    e: { id: string; casoId: string; iv: string; mime: string; actualizadoEn: string; datos: Uint8Array },
  ): Promise<ResultadoEscritura<MetadatosEvidenciaRemota> | null> {
    const casos = await this.bd.consultar<{ borrado: boolean }>(
      'SELECT borrado FROM casos WHERE cuenta_id = $1 AND id = $2',
      [cuentaId, e.casoId],
    );
    if (!casos[0] || casos[0].borrado) return null;
    const filas = await this.bd.consultar<FilaEvidencia>(
      `INSERT INTO evidencias (cuenta_id, id, caso_id, iv, datos, mime, tamano, actualizado_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (cuenta_id, id) DO UPDATE
         SET caso_id = EXCLUDED.caso_id, iv = EXCLUDED.iv, datos = EXCLUDED.datos, mime = EXCLUDED.mime,
             tamano = EXCLUDED.tamano, actualizado_en = EXCLUDED.actualizado_en
         WHERE evidencias.actualizado_en < EXCLUDED.actualizado_en
       RETURNING id, caso_id, iv, mime, tamano, actualizado_en`,
      [cuentaId, e.id, e.casoId, e.iv, e.datos, e.mime, e.datos.byteLength, new Date(e.actualizadoEn)],
    );
    if (filas[0]) return { aplicado: true, actual: metadatos(filas[0]) };
    const actual = await this.obtener(cuentaId, e.id);
    if (!actual) throw new Error('La evidencia desaparecio durante la escritura');
    const { datos: _datos, ...soloMetadatos } = actual;
    return { aplicado: false, actual: soloMetadatos };
  }

  /** Devuelve false si no existia. */
  async borrar(cuentaId: string, id: string): Promise<boolean> {
    const filas = await this.bd.consultar<{ id: string }>(
      'DELETE FROM evidencias WHERE cuenta_id = $1 AND id = $2 RETURNING id',
      [cuentaId, id],
    );
    return filas.length > 0;
  }
}
