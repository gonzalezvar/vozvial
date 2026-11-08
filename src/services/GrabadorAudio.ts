import { Platform } from 'react-native';

export type CausaErrorGrabacion = 'no_disponible' | 'permiso_negado' | 'sin_microfono' | 'otro';

export const MOTIVO_GRABACION_NO_DISPONIBLE =
  'Este navegador no puede grabar audio. Puedes agregar fotos y notas. Para grabar, abre VozVial en Chrome.';
export const MOTIVO_GRABACION_SIN_PERMISO =
  'No diste permiso para usar el micrófono. El caso se guarda igual, sin audio. Puedes agregar fotos y notas.';
export const MOTIVO_GRABACION_SIN_MICROFONO = 'No encontramos un micrófono. El caso se guarda igual, sin audio.';
export const MOTIVO_GRABACION_NATIVA =
  'En la app del celular la grabación todavía no está disponible. Usa VozVial en el navegador para grabar.';

export class ErrorGrabacion extends Error {
  constructor(
    readonly causa: CausaErrorGrabacion,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorGrabacion';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface AudioGrabado {
  bytes: Uint8Array<ArrayBuffer>;
  mime: string;
  /** Instante (ms) en que empezo la grabacion. */
  iniciadoEn: number;
  duracionMs: number;
}

/** Formatos preferidos: webm/opus (Chrome, Firefox) y luego mp4 (Safari). */
export const MIMES_PREFERIDOS: readonly string[] = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

/** Primer formato soportado, o null para dejar que el navegador elija. */
export function elegirMime(soportado: (mime: string) => boolean, candidatos: readonly string[] = MIMES_PREFERIDOS): string | null {
  for (const mime of candidatos) {
    try {
      if (soportado(mime)) return mime;
    } catch {
      // isTypeSupported puede lanzar en navegadores viejos: se prueba el siguiente.
    }
  }
  return null;
}

interface ConstructorGrabador {
  new (stream: MediaStream, opciones?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported?: (mime: string) => boolean;
}

function constructorGrabador(): ConstructorGrabador | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const c = (window as unknown as { MediaRecorder?: ConstructorGrabador }).MediaRecorder;
  return c ?? null;
}

/** Graba audio del microfono con MediaRecorder (web). En el celular nativo dice que no esta disponible. */
export class GrabadorAudio {
  private grabador: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private trozos: Blob[] = [];
  private inicio: number | null = null;
  private mime = '';

  static disponible(): { ok: true } | { ok: false; motivo: string } {
    if (Platform.OS !== 'web') return { ok: false, motivo: MOTIVO_GRABACION_NATIVA };
    const tieneMicrofono = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
    if (!constructorGrabador() || !tieneMicrofono) return { ok: false, motivo: MOTIVO_GRABACION_NO_DISPONIBLE };
    return { ok: true };
  }

  get grabando(): boolean {
    return this.grabador?.state === 'recording';
  }

  /** Instante (ms) en que empezo la grabacion, o null si no esta grabando. */
  get iniciadoEn(): number | null {
    return this.inicio;
  }

  /** Pide el microfono y empieza a grabar. Lanza ErrorGrabacion con un mensaje para mostrar. */
  async iniciar(): Promise<void> {
    const disponible = GrabadorAudio.disponible();
    if (!disponible.ok) throw new ErrorGrabacion('no_disponible', disponible.motivo);
    if (this.grabador) return;
    const Grabador = constructorGrabador()!;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const nombre = (e as { name?: string }).name;
      if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
        throw new ErrorGrabacion('permiso_negado', MOTIVO_GRABACION_SIN_PERMISO);
      }
      if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
        throw new ErrorGrabacion('sin_microfono', MOTIVO_GRABACION_SIN_MICROFONO);
      }
      throw new ErrorGrabacion('otro', MOTIVO_GRABACION_NO_DISPONIBLE);
    }

    const mime = elegirMime((m) => Grabador.isTypeSupported?.(m) ?? false);
    let grabador: MediaRecorder;
    try {
      grabador = mime ? new Grabador(stream, { mimeType: mime }) : new Grabador(stream);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      throw new ErrorGrabacion('otro', MOTIVO_GRABACION_NO_DISPONIBLE);
    }

    this.trozos = [];
    grabador.ondataavailable = (evento) => {
      if (evento.data && evento.data.size > 0) this.trozos.push(evento.data);
    };
    this.stream = stream;
    this.grabador = grabador;
    // Trozos de un segundo: si algo falla al final, lo ya grabado esta en memoria.
    grabador.start(1000);
    this.inicio = Date.now();
    this.mime = grabador.mimeType || mime || 'audio/webm';
  }

  /** Detiene la grabacion y entrega el audio. Devuelve null si no estaba grabando o no hay datos. */
  async detener(): Promise<AudioGrabado | null> {
    const grabador = this.grabador;
    const inicio = this.inicio;
    if (!grabador || inicio === null) return null;

    if (grabador.state !== 'inactive') {
      await new Promise<void>((resolver) => {
        grabador.onstop = () => resolver();
        grabador.onerror = () => resolver();
        try {
          grabador.stop();
        } catch {
          resolver();
        }
      });
    }
    const duracionMs = Math.max(0, Date.now() - inicio);
    this.liberar();

    const blob = new Blob(this.trozos, { type: this.mime });
    this.trozos = [];
    if (blob.size === 0) return null;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // El mime debe ser de audio para que la evidencia sea valida.
    const mime = this.mime.toLowerCase().startsWith('audio/') ? this.mime : 'audio/webm';
    return { bytes, mime, iniciadoEn: inicio, duracionMs };
  }

  /** Descarta la grabacion sin entregarla. */
  cancelar(): void {
    try {
      if (this.grabador && this.grabador.state !== 'inactive') this.grabador.stop();
    } catch {
      // Ya estaba detenido.
    }
    this.trozos = [];
    this.liberar();
  }

  private liberar(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.grabador = null;
    this.inicio = null;
  }
}
