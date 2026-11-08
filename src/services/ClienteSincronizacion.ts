import { CodificacionBase64 } from '../core/CodificacionBase64';
import { ClienteApiBase, ErrorApiDatos, type OpcionesApi } from './PeticionApi';

/** Caso cifrado tal como viaja: mismo { iv, datos } en base64 que guarda AlmacenCifrado en IndexedDB. */
export interface CasoRemoto {
  id: string;
  iv: string;
  datos: string;
  actualizadoEn: string;
  /** Marca de borrado: iv y datos vienen vacios. */
  borrado: boolean;
}

export interface MetadatosEvidenciaRemota {
  id: string;
  casoId: string;
  /** IV de AES-GCM en base64. */
  iv: string;
  mime: string;
  /** Bytes cifrados. */
  tamano: number;
  actualizadoEn: string;
}

export interface EvidenciaDescargada extends MetadatosEvidenciaRemota {
  /** Contenido cifrado con AES-GCM (el mismo formato que AlmacenCifrado guarda en "evidencias"). */
  datos: Uint8Array<ArrayBuffer>;
}

/** Resultado de una escritura: si no se aplico, el servidor tenia una version mas nueva y la devuelve. */
export interface ResultadoEscrituraRemota<T> {
  aplicado: boolean;
  actual: T;
}

export interface OpcionesClienteSincronizacion extends OpcionesApi {
  /** Token de la sesion activa (ClienteCuentas.entrar). null = sin sesion. */
  obtenerToken: () => string | null;
}

const CABECERAS = {
  caso: 'X-VozVial-Caso',
  iv: 'X-VozVial-IV',
  mime: 'X-VozVial-Mime',
  actualizadoEn: 'X-VozVial-Actualizado',
} as const;

/**
 * Cliente de /api/casos y /api/evidencias. Sube y baja solo datos ya cifrados en el dispositivo;
 * el servidor no tiene la clave. La estrategia (gana el mas reciente) esta en ResolvedorSincronizacion.
 */
export class ClienteSincronizacion extends ClienteApiBase {
  private readonly obtenerToken: () => string | null;

  constructor(opciones: OpcionesClienteSincronizacion) {
    super(opciones);
    this.obtenerToken = opciones.obtenerToken;
  }

  /** Todos los casos de la cuenta, con marcas de borrado. Con "desde", solo los cambiados despues. */
  async listarCasos(desde?: string): Promise<{ casos: CasoRemoto[]; ahora: string }> {
    const consulta = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    return this.peticionJson({ metodo: 'GET', ruta: `/api/casos${consulta}`, token: this.token() });
  }

  /** null si el servidor no tiene ese caso. */
  async obtenerCaso(id: string): Promise<CasoRemoto | null> {
    try {
      return await this.peticionJson<CasoRemoto>({ metodo: 'GET', ruta: `/api/casos/${encodeURIComponent(id)}`, token: this.token() });
    } catch (error) {
      if (error instanceof ErrorApiDatos && error.causa === 'no_encontrado') return null;
      throw error;
    }
  }

  /**
   * Sube un caso cifrado. Si el servidor ya tenia uno mas reciente, aplicado es false y "actual"
   * trae esa version para guardarla en el dispositivo. Guarda siempre actual.actualizadoEn como
   * marca local (el servidor recorta marcas del futuro a su hora).
   */
  subirCaso(caso: { id: string; iv: string; datos: string; actualizadoEn: string }): Promise<ResultadoEscrituraRemota<CasoRemoto>> {
    return this.peticionJson({
      metodo: 'PUT',
      ruta: `/api/casos/${encodeURIComponent(caso.id)}`,
      token: this.token(),
      json: { iv: caso.iv, datos: caso.datos, actualizadoEn: caso.actualizadoEn },
    });
  }

  /** Deja una marca de borrado (para los otros dispositivos) y elimina sus evidencias del servidor. */
  borrarCaso(id: string, actualizadoEn: string): Promise<ResultadoEscrituraRemota<CasoRemoto>> {
    return this.peticionJson({
      metodo: 'DELETE',
      ruta: `/api/casos/${encodeURIComponent(id)}?actualizadoEn=${encodeURIComponent(actualizadoEn)}`,
      token: this.token(),
    });
  }

  /** Marca como borrados todos los casos de la cuenta. */
  async borrarCasos(): Promise<number> {
    const r = await this.peticionJson<{ borrados: number }>({ metodo: 'DELETE', ruta: '/api/casos', token: this.token() });
    return r.borrados;
  }

  async listarEvidencias(): Promise<MetadatosEvidenciaRemota[]> {
    const r = await this.peticionJson<{ evidencias: MetadatosEvidenciaRemota[] }>({
      metodo: 'GET',
      ruta: '/api/evidencias',
      token: this.token(),
    });
    return r.evidencias;
  }

  /** null si el servidor no tiene esa evidencia. */
  async bajarEvidencia(id: string): Promise<EvidenciaDescargada | null> {
    let respuesta: Response;
    try {
      respuesta = await this.peticion({ metodo: 'GET', ruta: `/api/evidencias/${encodeURIComponent(id)}`, token: this.token() });
    } catch (error) {
      if (error instanceof ErrorApiDatos && error.causa === 'no_encontrado') return null;
      throw error;
    }
    const datos = new Uint8Array(await respuesta.arrayBuffer());
    const h = respuesta.headers;
    return {
      id,
      casoId: h.get(CABECERAS.caso) ?? '',
      iv: h.get(CABECERAS.iv) ?? '',
      mime: h.get(CABECERAS.mime) ?? '',
      tamano: datos.byteLength,
      actualizadoEn: h.get(CABECERAS.actualizadoEn) ?? '',
      datos,
    };
  }

  /**
   * Sube el contenido cifrado de una evidencia (maximo 8 MB). El caso debe existir antes en el
   * servidor: primero subirCaso, luego subirEvidencia. Lanza 'muy_grande', 'cuota_excedida' o 'caso_no_encontrado'.
   * El iv puede llegar en bytes (como lo guarda AlmacenCifrado) o en base64.
   */
  subirEvidencia(
    evidencia: { id: string; casoId: string; iv: Uint8Array | string; mime: string; actualizadoEn: string },
    datosCifrados: Uint8Array | ArrayBuffer,
  ): Promise<ResultadoEscrituraRemota<MetadatosEvidenciaRemota>> {
    const iv = typeof evidencia.iv === 'string' ? evidencia.iv : CodificacionBase64.codificar(evidencia.iv);
    return this.peticionJson({
      metodo: 'PUT',
      ruta: `/api/evidencias/${encodeURIComponent(evidencia.id)}`,
      token: this.token(),
      binario: datosCifrados instanceof Uint8Array ? datosCifrados : new Uint8Array(datosCifrados),
      cabeceras: {
        [CABECERAS.caso]: evidencia.casoId,
        [CABECERAS.iv]: iv,
        [CABECERAS.mime]: evidencia.mime,
        [CABECERAS.actualizadoEn]: evidencia.actualizadoEn,
      },
    });
  }

  async borrarEvidencia(id: string): Promise<boolean> {
    const r = await this.peticionJson<{ borrada: boolean }>({
      metodo: 'DELETE',
      ruta: `/api/evidencias/${encodeURIComponent(id)}`,
      token: this.token(),
    });
    return r.borrada;
  }

  private token(): string {
    const token = this.obtenerToken();
    if (!token) throw new ErrorApiDatos('no_autorizado', 'Tu sesión terminó. Entra otra vez con tu PIN.');
    return token;
  }
}
