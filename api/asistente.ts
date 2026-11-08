import type { VercelRequest, VercelResponse } from '@vercel/node';

import { MAX_CARACTERES_PREGUNTA, type AsistenteNormativo } from '../src/core/AsistenteNormativo';
import type { FuncionFetch } from '../src/core/ProveedorLLM';
import { ControlConsumo, type ResultadoCupo } from '../src/servidor/ControlConsumo';
import { crearAsistenteServidor } from '../src/servidor/crearAsistenteServidor';

/**
 * Endpoint del asistente: POST { pregunta } -> RespuestaAsistente.
 * Privacidad: solo acepta el campo "pregunta" (cualquier otro dato se rechaza
 * con 400) y nunca escribe el contenido de la pregunta ni de la respuesta en los logs.
 * Con ANTHROPIC_API_KEY la respuesta la redacta Claude: a Anthropic viaja solo
 * el texto de la pregunta (más la base normativa en el system).
 *
 * Gasto: solo acepta Content-Type application/json (415 si no). Así un sitio ajeno
 * no puede mandar la pregunta desde el navegador de un visitante sin una
 * verificación previa de CORS, que este servidor no autoriza. En modo Claude
 * además hay tope por IP (429) y un cupo global diario (ver ControlConsumo).
 */

type RequestMinimo = Pick<VercelRequest, 'method' | 'body' | 'headers'> & Partial<Pick<VercelRequest, 'socket'>>;
type ResponseMinimo = Pick<VercelResponse, 'setHeader' | 'status' | 'json'>;
type Handler = (req: RequestMinimo, res: ResponseMinimo) => Promise<void>;

interface ErrorPeticion {
  error: string;
  mensaje: string;
}

/** Valida el cuerpo. Devuelve la pregunta limpia o el error para responder 400. */
export function validarCuerpo(cuerpo: unknown): { pregunta: string } | ErrorPeticion {
  let datos = cuerpo;
  if (typeof datos === 'string') {
    try {
      datos = JSON.parse(datos);
    } catch {
      return { error: 'json_invalido', mensaje: 'Envía un JSON con el campo "pregunta".' };
    }
  }
  if (typeof datos !== 'object' || datos === null || Array.isArray(datos)) {
    return { error: 'cuerpo_invalido', mensaje: 'Envía un JSON con el campo "pregunta".' };
  }
  const campos = Object.keys(datos);
  const extra = campos.filter((c) => c !== 'pregunta');
  if (extra.length > 0) {
    // No se aceptan más datos que la pregunta: ni nombre, ni ubicación, ni audio.
    return { error: 'campos_no_permitidos', mensaje: 'Solo se acepta el campo "pregunta".' };
  }
  const { pregunta } = datos as { pregunta?: unknown };
  if (typeof pregunta !== 'string' || pregunta.trim().length === 0) {
    return { error: 'pregunta_vacia', mensaje: 'Escribe tu pregunta.' };
  }
  if (pregunta.length > MAX_CARACTERES_PREGUNTA) {
    return {
      error: 'pregunta_muy_larga',
      mensaje: `La pregunta puede tener hasta ${MAX_CARACTERES_PREGUNTA} caracteres.`,
    };
  }
  return { pregunta: pregunta.trim() };
}

/** true si el tipo del cuerpo es exactamente application/json (con o sin charset). */
export function esJson(req: Pick<RequestMinimo, 'headers'>): boolean {
  const tipo = req.headers?.['content-type'];
  return typeof tipo === 'string' && tipo.split(';')[0]!.trim().toLowerCase() === 'application/json';
}

/**
 * IP del cliente para el tope por IP. Detrás del proxy de Railway o Vercel se usa la última
 * entrada de X-Forwarded-For, que es la que agrega el proxy y el cliente no puede falsear.
 * Sin proxy (local), la dirección del socket.
 */
export function ipDe(req: Pick<RequestMinimo, 'headers' | 'socket'>): string {
  const reenviada = req.headers?.['x-forwarded-for'];
  const lista = (Array.isArray(reenviada) ? reenviada.join(',') : (reenviada ?? '')).split(',');
  const ultima = lista[lista.length - 1]?.trim();
  return ultima || req.socket?.remoteAddress || 'desconocida';
}

export interface OpcionesHandler {
  /** Tope por cliente. null: esta petición no cuenta (por ejemplo, en modo verificado). */
  limitarCliente?: (req: RequestMinimo) => ResultadoCupo | null;
}

export function crearHandler(obtenerAsistente: () => AsistenteNormativo, opciones: OpcionesHandler = {}): Handler {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'metodo_no_permitido', mensaje: 'Usa POST.' });
      return;
    }
    if (!esJson(req)) {
      res.status(415).json({ error: 'tipo_no_soportado', mensaje: 'Envía la pregunta como JSON (Content-Type: application/json).' });
      return;
    }
    const validacion = validarCuerpo(req.body);
    if ('error' in validacion) {
      res.status(400).json(validacion);
      return;
    }
    const cupo = opciones.limitarCliente?.(req);
    if (cupo && !cupo.permitido) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(cupo.msRestantes / 1000))));
      res.status(429).json({ error: 'demasiadas_preguntas', mensaje: 'Hiciste muchas preguntas seguidas. Espera un momento e intenta de nuevo.' });
      return;
    }
    try {
      const respuesta = await obtenerAsistente().responder(validacion.pregunta);
      res.status(200).json(respuesta);
    } catch {
      // Sin detalles del error: podrían incluir el texto de la pregunta.
      res.status(500).json({ error: 'error_interno', mensaje: 'No pudimos responder. Intenta de nuevo.' });
    }
  };
}

// El índice, el cliente de Anthropic y los topes se crean una sola vez por instancia, en la primera petición.
let compartido: { asistente: AsistenteNormativo; control: ControlConsumo } | null = null;
function estadoCompartido(): { asistente: AsistenteNormativo; control: ControlConsumo } {
  if (!compartido) {
    const control = new ControlConsumo(ControlConsumo.limitesDesdeEntorno(process.env));
    const asistente = crearAsistenteServidor({
      env: process.env,
      fetch: globalThis.fetch as unknown as FuncionFetch,
      control,
    });
    compartido = { asistente, control };
  }
  return compartido;
}

const handler = crearHandler(() => estadoCompartido().asistente, {
  // El tope por IP solo aplica cuando responde Claude, que es lo que gasta créditos.
  limitarCliente: (req) => {
    const { asistente, control } = estadoCompartido();
    return asistente.modo === 'claude' ? control.registrarCliente(ipDe(req)) : null;
  },
});

export default async function asistenteHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handler(req, res);
}
