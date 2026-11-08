import type { DisponibilidadVoz, OpcionesEscucha, ProveedorVoz } from '../core/ProveedorVoz';

export type CausaErrorVoz = 'no_disponible' | 'permiso_negado' | 'sin_voz' | 'sin_red' | 'interrumpido' | 'otro';

/** Error de reconocimiento con un mensaje en lenguaje sencillo para mostrar en pantalla. */
export class ErrorVoz extends Error {
  constructor(
    readonly causa: CausaErrorVoz,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorVoz';
  }
}

export const MOTIVO_SIN_RECONOCIMIENTO =
  'Este navegador no puede reconocer la voz. Escribe tu pregunta. Si quieres hablar, abre VozVial en Chrome.';
export const MOTIVO_PERMISO_NEGADO =
  'No diste permiso para usar el micrófono. Escribe tu pregunta. Si quieres hablar, permite el micrófono en el navegador.';
export const MOTIVO_SIN_VOZ = 'No te escuché. Toca "Hablar" y di tu pregunta, o escríbela.';

/** Tipos mínimos de la Web Speech API: TypeScript no los trae en lib.dom. */
interface AlternativaReconocida {
  transcript: string;
}
interface ResultadoReconocido {
  readonly length: number;
  readonly isFinal?: boolean;
  [indice: number]: AlternativaReconocida | undefined;
}
interface EventoResultado {
  resultIndex?: number;
  results: { readonly length: number; [indice: number]: ResultadoReconocido | undefined };
}
interface EventoErrorVoz {
  error?: string;
}
interface ReconocedorWeb {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((evento: EventoResultado) => void) | null;
  onerror: ((evento: EventoErrorVoz) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocedor = new () => ReconocedorWeb;

function constructorReconocedor(): ConstructorReconocedor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Reconocimiento de voz con la Web Speech API en español de Colombia. */
export class ProveedorVozWeb implements ProveedorVoz {
  private activo: ReconocedorWeb | null = null;

  async disponible(): Promise<DisponibilidadVoz> {
    if (!constructorReconocedor()) return { ok: false, motivo: MOTIVO_SIN_RECONOCIMIENTO };
    // Si la persona ya negó el micrófono, se avisa antes de que toque el botón.
    try {
      const permisos = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
      if (permisos) {
        const estado = await permisos.query({ name: 'microphone' as PermissionName });
        if (estado.state === 'denied') return { ok: false, motivo: MOTIVO_PERMISO_NEGADO };
      }
    } catch {
      // Algunos navegadores no permiten consultar este permiso: se pregunta al escuchar.
    }
    return { ok: true };
  }

  escuchar(opciones: OpcionesEscucha = {}): Promise<string> {
    const Reconocedor = constructorReconocedor();
    if (!Reconocedor) return Promise.reject(new ErrorVoz('no_disponible', MOTIVO_SIN_RECONOCIMIENTO));
    this.detener();

    return new Promise<string>((resolve, reject) => {
      const reconocedor = new Reconocedor();
      reconocedor.lang = opciones.idioma ?? 'es-CO';
      reconocedor.continuous = false;
      reconocedor.interimResults = Boolean(opciones.alParcial);
      reconocedor.maxAlternatives = 1;

      let texto = '';
      let error: ErrorVoz | null = null;
      let terminado = false;
      let temporizador: ReturnType<typeof setTimeout> | null = null;

      const terminar = () => {
        if (terminado) return;
        terminado = true;
        if (temporizador) clearTimeout(temporizador);
        if (this.activo === reconocedor) this.activo = null;
        const limpio = texto.replace(/\s+/g, ' ').trim();
        if (error) reject(error);
        else if (limpio) resolve(limpio);
        else reject(new ErrorVoz('sin_voz', MOTIVO_SIN_VOZ));
      };

      reconocedor.onresult = (evento) => {
        // Se arma el texto con todos los resultados: los finales y el parcial más reciente.
        const partes: string[] = [];
        for (let i = 0; i < evento.results.length; i++) {
          const alternativa = evento.results[i]?.[0];
          if (alternativa?.transcript) partes.push(alternativa.transcript);
        }
        texto = partes.join(' ');
        opciones.alParcial?.(texto.trim());
      };
      reconocedor.onerror = (evento) => {
        error = traducirError(evento.error);
      };
      reconocedor.onend = terminar;

      if (opciones.tiempoMaximoMs) {
        temporizador = setTimeout(() => reconocedor.stop(), opciones.tiempoMaximoMs);
      }
      this.activo = reconocedor;
      try {
        reconocedor.start();
      } catch {
        error = new ErrorVoz('otro', MOTIVO_SIN_VOZ);
        terminar();
      }
    });
  }

  detener(): void {
    // stop() entrega lo que ya se reconoció y dispara onend.
    this.activo?.stop();
  }
}

function traducirError(codigo: string | undefined): ErrorVoz | null {
  switch (codigo) {
    case 'not-allowed':
    case 'service-not-allowed':
      return new ErrorVoz('permiso_negado', MOTIVO_PERMISO_NEGADO);
    case 'no-speech':
      return new ErrorVoz('sin_voz', MOTIVO_SIN_VOZ);
    case 'network':
      return new ErrorVoz('sin_red', 'No pudimos reconocer tu voz porque falló la conexión. Escribe tu pregunta.');
    case 'aborted':
      return null;
    case 'audio-capture':
      return new ErrorVoz('no_disponible', 'No encontramos un micrófono. Escribe tu pregunta.');
    default:
      return new ErrorVoz('otro', MOTIVO_SIN_VOZ);
  }
}
