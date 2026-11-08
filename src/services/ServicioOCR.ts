import type { PalabraOCR } from '../core/ParserComparendo';

/**
 * Lee el texto de la foto del comparendo con tesseract.js (idioma spa) en el
 * navegador. La foto no sale del dispositivo.
 *
 * La librería, el worker, el núcleo wasm y el idioma están autoalojados en
 * public/tesseract (ver public/tesseract/LEEME.txt): no se usa ningún CDN.
 * La librería se carga solo cuando se pide leer una foto, con una etiqueta
 * <script> a /tesseract/tesseract.min.js, para no pesar en el resto de la app.
 */

export type EtapaOCR = 'preparando' | 'leyendo';

export interface ProgresoOCR {
  etapa: EtapaOCR;
  /** 0 a 1. */
  progreso: number;
}

export interface ResultadoOCR {
  texto: string;
  palabras: PalabraOCR[];
}

export type ImagenOCR = Blob | string;

export class ErrorOCR extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorOCR';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Forma mínima de la API global de tesseract.min.js que se usa aquí.
interface PalabraTesseract {
  text: string;
  confidence: number;
}
interface PaginaTesseract {
  text: string;
  blocks?: { paragraphs: { lines: { words: PalabraTesseract[] }[] }[] }[] | null;
}
interface WorkerTesseract {
  recognize(imagen: ImagenOCR, opciones?: object, salida?: { text?: boolean; blocks?: boolean }): Promise<{ data: PaginaTesseract }>;
  terminate(): Promise<unknown>;
}
interface MensajeTesseract {
  status: string;
  progress: number;
}
interface TesseractGlobal {
  createWorker(
    idioma: string,
    oem: number,
    opciones: {
      workerPath: string;
      corePath: string;
      langPath: string;
      gzip: boolean;
      workerBlobURL: boolean;
      cacheMethod: string;
      logger: (m: MensajeTesseract) => void;
    },
  ): Promise<WorkerTesseract>;
}

const OEM_LSTM = 1;

let cargaLibreria: Promise<TesseractGlobal> | null = null;

function cargarLibreria(url: string): Promise<TesseractGlobal> {
  const ventana = globalThis as unknown as { Tesseract?: TesseractGlobal; document?: Document };
  if (ventana.Tesseract) return Promise.resolve(ventana.Tesseract);
  if (!ventana.document) return Promise.reject(new ErrorOCR('El lector de fotos solo funciona en el navegador.'));
  cargaLibreria ??= new Promise<TesseractGlobal>((resolver, rechazar) => {
    const script = ventana.document!.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => (ventana.Tesseract ? resolver(ventana.Tesseract) : rechazar(new ErrorOCR('No se pudo preparar el lector.')));
    script.onerror = () => {
      cargaLibreria = null;
      rechazar(new ErrorOCR('No se pudo preparar el lector.'));
    };
    ventana.document!.head.appendChild(script);
  });
  return cargaLibreria;
}

/** Recorre bloques, párrafos y líneas para sacar cada palabra con su confianza (0 a 100). */
export function palabrasDe(pagina: PaginaTesseract): PalabraOCR[] {
  const palabras: PalabraOCR[] = [];
  for (const bloque of pagina.blocks ?? []) {
    for (const parrafo of bloque.paragraphs) {
      for (const linea of parrafo.lines) {
        for (const palabra of linea.words) palabras.push({ texto: palabra.text, confianza: palabra.confidence });
      }
    }
  }
  return palabras;
}

export class ServicioOCR {
  /** base: carpeta pública con los archivos de tesseract. */
  constructor(private readonly base: string = '/tesseract') {}

  async leer(imagen: ImagenOCR, alProgreso?: (p: ProgresoOCR) => void): Promise<ResultadoOCR> {
    // El worker resuelve rutas desde su propia URL: se le pasan absolutas.
    const origen = typeof location !== 'undefined' ? location.href : 'http://localhost/';
    const raiz = new URL(this.base.replace(/\/$/, '') + '/', origen).href;
    alProgreso?.({ etapa: 'preparando', progreso: 0 });
    const Tesseract = await cargarLibreria(`${raiz}tesseract.min.js`);
    const worker = await Tesseract.createWorker('spa', OEM_LSTM, {
      workerPath: `${raiz}worker.min.js`,
      corePath: `${raiz}core`,
      langPath: `${raiz}lang`,
      gzip: false,
      // Worker desde un archivo propio y no desde un blob: así cumple la CSP worker-src 'self'.
      workerBlobURL: false,
      // No guarda el idioma en otra base de IndexedDB; la caché HTTP basta.
      cacheMethod: 'none',
      logger: (m) => {
        if (!alProgreso) return;
        const leyendo = m.status === 'recognizing text';
        alProgreso({ etapa: leyendo ? 'leyendo' : 'preparando', progreso: Math.max(0, Math.min(1, m.progress || 0)) });
      },
    });
    try {
      const { data } = await worker.recognize(imagen, {}, { text: true, blocks: true });
      return { texto: data.text ?? '', palabras: palabrasDe(data) };
    } catch {
      throw new ErrorOCR('No pudimos leer la foto.');
    } finally {
      void worker.terminate();
    }
  }
}
