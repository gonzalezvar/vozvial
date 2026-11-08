import type { VercelRequest, VercelResponse } from '@vercel/node';

import { MAX_CARACTERES_PREGUNTA, type AsistenteNormativo } from '../src/core/AsistenteNormativo';
import { crearAsistente } from '../src/core/cargarDatos';
import type { FuncionFetch } from '../src/core/ProveedorLLM';

/**
 * Endpoint del asistente: POST { pregunta } -> RespuestaAsistente.
 * Privacidad: solo acepta el campo "pregunta" (cualquier otro dato se rechaza
 * con 400) y nunca escribe el contenido de la pregunta en los logs.
 */

type RequestMinimo = Pick<VercelRequest, 'method' | 'body'>;
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

export function crearHandler(obtenerAsistente: () => AsistenteNormativo): Handler {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'metodo_no_permitido', mensaje: 'Usa POST.' });
      return;
    }
    const validacion = validarCuerpo(req.body);
    if ('error' in validacion) {
      res.status(400).json(validacion);
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

// El índice se construye una sola vez por instancia, en la primera petición.
let asistente: AsistenteNormativo | null = null;
function asistenteCompartido(): AsistenteNormativo {
  if (!asistente) {
    asistente = crearAsistente({
      env: process.env,
      fetch: globalThis.fetch as unknown as FuncionFetch,
    });
  }
  return asistente;
}

const handler = crearHandler(asistenteCompartido);

export default async function asistenteHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await handler(req, res);
}
