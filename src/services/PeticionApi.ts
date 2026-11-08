/**
 * Causas de error de la API de cuentas y datos. Las pantallas eligen el mensaje con la causa;
 * "mensaje" ya trae un texto sencillo listo para mostrar y leer en voz alta.
 */
export type CausaErrorApi =
  | 'sin_conexion'
  | 'tiempo_agotado'
  | 'credenciales_invalidas'
  | 'codigo_invalido'
  | 'bloqueada'
  | 'ya_existe'
  | 'no_autorizado'
  | 'limite_peticiones'
  | 'muy_grande'
  | 'cuota_excedida'
  | 'caso_no_encontrado'
  | 'no_encontrado'
  | 'datos_invalidos'
  | 'bd_no_disponible'
  | 'servidor';

export class ErrorApiDatos extends Error {
  constructor(
    readonly causa: CausaErrorApi,
    mensaje: string,
    readonly estado: number | null = null,
    /** Solo en 'credenciales_invalidas' al entrar. */
    readonly intentosRestantes: number | null = null,
    /** En 'bloqueada' y 'limite_peticiones'. */
    readonly msRestantes: number | null = null,
  ) {
    super(mensaje);
    this.name = 'ErrorApiDatos';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface OpcionesApi {
  /** Origen del API sin barra final. Vacio = mismo origen (Railway y el servidor e2e). */
  baseUrl?: string;
  tiempoMaximoMs?: number;
  fetch?: Fetch;
  enLinea?: () => boolean;
}

// Expo reemplaza EXPO_PUBLIC_* en el build solo si se escribe el nombre completo.
const URL_API_PREDETERMINADA = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

const CAUSAS_CONOCIDAS = new Set<CausaErrorApi>([
  'credenciales_invalidas',
  'codigo_invalido',
  'bloqueada',
  'ya_existe',
  'no_autorizado',
  'limite_peticiones',
  'muy_grande',
  'cuota_excedida',
  'caso_no_encontrado',
  'no_encontrado',
  'datos_invalidos',
  'bd_no_disponible',
]);

export interface PeticionApiDatos {
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE';
  ruta: string;
  token?: string | null;
  json?: unknown;
  binario?: Uint8Array;
  cabeceras?: Record<string, string>;
}

/** fetch al API con tiempo maximo, sin cookies ni referer, y errores traducidos a ErrorApiDatos. */
export class ClienteApiBase {
  protected readonly baseUrl: string;
  private readonly tiempoMaximoMs: number;
  private readonly fetchFn: Fetch;
  private readonly enLinea: () => boolean;

  constructor(opciones: OpcionesApi = {}) {
    this.baseUrl = (opciones.baseUrl ?? URL_API_PREDETERMINADA).replace(/\/+$/, '');
    this.tiempoMaximoMs = opciones.tiempoMaximoMs ?? 20_000;
    this.fetchFn = opciones.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.enLinea = opciones.enLinea ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  }

  protected async peticion(p: PeticionApiDatos): Promise<Response> {
    if (!this.enLinea()) throw new ErrorApiDatos('sin_conexion', 'Necesitas internet para esto.');
    const cabeceras: Record<string, string> = { ...(p.cabeceras ?? {}) };
    let cuerpo: BodyInit | undefined;
    if (p.json !== undefined) {
      cabeceras['Content-Type'] = 'application/json';
      cuerpo = JSON.stringify(p.json);
    } else if (p.binario) {
      cabeceras['Content-Type'] = 'application/octet-stream';
      // Copia a un ArrayBuffer propio para que fetch no reciba una vista parcial.
      const copia = new Uint8Array(p.binario.byteLength);
      copia.set(p.binario);
      cuerpo = copia.buffer;
    }
    if (p.token) cabeceras.Authorization = `Bearer ${p.token}`;

    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), this.tiempoMaximoMs);
    let respuesta: Response;
    try {
      respuesta = await this.fetchFn(`${this.baseUrl}${p.ruta}`, {
        method: p.metodo,
        headers: cabeceras,
        body: cuerpo,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: control.signal,
      });
    } catch {
      if (control.signal.aborted) throw new ErrorApiDatos('tiempo_agotado', 'El servidor se demoró mucho. Intenta de nuevo.');
      throw new ErrorApiDatos('sin_conexion', 'Necesitas internet para esto.');
    } finally {
      clearTimeout(temporizador);
    }
    if (!respuesta.ok) throw await ClienteApiBase.error(respuesta);
    return respuesta;
  }

  protected async peticionJson<T>(p: PeticionApiDatos): Promise<T> {
    const respuesta = await this.peticion(p);
    try {
      return (await respuesta.json()) as T;
    } catch {
      throw new ErrorApiDatos('servidor', 'No pudimos leer la respuesta. Intenta de nuevo.', respuesta.status);
    }
  }

  private static async error(respuesta: Response): Promise<ErrorApiDatos> {
    let datos: Record<string, unknown> = {};
    try {
      datos = ((await respuesta.json()) as Record<string, unknown>) ?? {};
    } catch {
      datos = {};
    }
    const codigo = typeof datos.error === 'string' ? datos.error : '';
    const mensaje = typeof datos.mensaje === 'string' ? datos.mensaje : 'Algo falló. Intenta de nuevo en un momento.';
    const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    let causa: CausaErrorApi;
    if (codigo === 'json_invalido') causa = 'datos_invalidos';
    else if (CAUSAS_CONOCIDAS.has(codigo as CausaErrorApi)) causa = codigo as CausaErrorApi;
    else causa = 'servidor';
    return new ErrorApiDatos(causa, mensaje, respuesta.status, numero(datos.intentosRestantes), numero(datos.msRestantes));
  }
}
