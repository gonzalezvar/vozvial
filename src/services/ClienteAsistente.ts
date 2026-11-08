import type { RespuestaAsistente } from '../core/ProveedorRespuesta';

export type CausaErrorAsistente = 'sin_conexion' | 'tiempo_agotado' | 'peticion' | 'servidor';

export class ErrorAsistente extends Error {
  constructor(
    readonly causa: CausaErrorAsistente,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorAsistente';
  }
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface OpcionesCliente {
  /** Origen del API sin barra final. Vacío = mismo origen (Vercel y el servidor e2e). */
  baseUrl?: string;
  tiempoMaximoMs?: number;
  fetch?: Fetch;
  /** Estado de la red; por defecto navigator.onLine. */
  enLinea?: () => boolean;
}

// Expo reemplaza EXPO_PUBLIC_* en el build solo si se escribe el nombre completo.
const URL_API_PREDETERMINADA = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/**
 * Cliente del endpoint del asistente. Privacidad (RNF-01): el cuerpo es solo
 * { pregunta }; no se envía nombre, celular, ubicación, audio ni cookies.
 */
export class ClienteAsistente {
  private readonly url: string;
  private readonly tiempoMaximoMs: number;
  private readonly fetch: Fetch;
  private readonly enLinea: () => boolean;

  constructor(opciones: OpcionesCliente = {}) {
    this.url = `${(opciones.baseUrl ?? URL_API_PREDETERMINADA).replace(/\/+$/, '')}/api/asistente`;
    this.tiempoMaximoMs = opciones.tiempoMaximoMs ?? 15_000;
    this.fetch = opciones.fetch ?? ((url, init) => globalThis.fetch(url, init));
    this.enLinea = opciones.enLinea ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  }

  /** Cuerpo exacto que viaja al servidor. Se expone para poder probarlo. */
  static cuerpo(pregunta: string): string {
    return JSON.stringify({ pregunta: pregunta.trim() });
  }

  async preguntar(pregunta: string): Promise<RespuestaAsistente> {
    if (!this.enLinea()) throw new ErrorAsistente('sin_conexion', 'El asistente necesita internet.');

    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), this.tiempoMaximoMs);
    let respuesta: Response;
    try {
      respuesta = await this.fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ClienteAsistente.cuerpo(pregunta),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: control.signal,
      });
    } catch {
      if (control.signal.aborted) {
        throw new ErrorAsistente('tiempo_agotado', 'El asistente se demoró mucho en responder. Intenta de nuevo.');
      }
      // fetch solo rechaza por fallas de red: se trata como falta de internet.
      throw new ErrorAsistente('sin_conexion', 'El asistente necesita internet.');
    } finally {
      clearTimeout(temporizador);
    }

    let datos: unknown = null;
    try {
      datos = await respuesta.json();
    } catch {
      datos = null;
    }
    if (!respuesta.ok) {
      const mensaje = (datos as { mensaje?: unknown } | null)?.mensaje;
      if (respuesta.status >= 400 && respuesta.status < 500) {
        throw new ErrorAsistente('peticion', typeof mensaje === 'string' ? mensaje : 'Revisa tu pregunta e intenta de nuevo.');
      }
      throw new ErrorAsistente('servidor', 'No pudimos responder. Intenta de nuevo en un momento.');
    }
    if (!esRespuesta(datos)) {
      throw new ErrorAsistente('servidor', 'No pudimos responder. Intenta de nuevo en un momento.');
    }
    return datos;
  }
}

function esRespuesta(datos: unknown): datos is RespuestaAsistente {
  if (typeof datos !== 'object' || datos === null) return false;
  const r = datos as Partial<RespuestaAsistente>;
  const tipoValido = r.tipo === 'respuesta' || r.tipo === 'abstencion' || r.tipo === 'fuera_de_tema';
  // Una respuesta sin cita nunca se muestra como respuesta.
  if (r.tipo === 'respuesta' && (!Array.isArray(r.citas) || r.citas.length === 0)) return false;
  return tipoValido && typeof r.texto === 'string' && Array.isArray(r.citas);
}
