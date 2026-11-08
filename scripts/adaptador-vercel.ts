import type { IncomingMessage, ServerResponse } from 'node:http';
import type { VercelRequest, VercelResponse } from '@vercel/node';

type Handler = (req: VercelRequest, res: VercelResponse) => void | Promise<void>;

// Limite del cuerpo: la pregunta mide hasta 500 caracteres, 16 KB sobra.
const MAX_BYTES_CUERPO = 16 * 1024;

class ErrorCuerpo extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
  ) {
    super(codigo);
  }
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (parte: Buffer) => {
      total += parte.length;
      if (total > MAX_BYTES_CUERPO) {
        reject(new ErrorCuerpo(413, 'cuerpo_muy_grande'));
        req.destroy();
        return;
      }
      partes.push(parte);
    });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

// Imita el parseo de Vercel: JSON si el content-type lo indica, si no el texto tal cual.
function parsearCuerpo(req: IncomingMessage, texto: string): unknown {
  if (texto.length === 0) return undefined;
  const tipo = String(req.headers['content-type'] ?? '');
  if (tipo.includes('application/json')) {
    try {
      return JSON.parse(texto);
    } catch {
      throw new ErrorCuerpo(400, 'json_invalido');
    }
  }
  return texto;
}

function parsearQuery(url: string | undefined): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  const params = new URL(url ?? '/', 'http://localhost').searchParams;
  for (const clave of new Set(params.keys())) {
    const valores = params.getAll(clave);
    query[clave] = valores.length === 1 ? (valores[0] ?? '') : valores;
  }
  return query;
}

function aumentarRespuesta(res: ServerResponse): VercelResponse {
  const vres = res as VercelResponse;
  vres.status = (codigo: number) => {
    res.statusCode = codigo;
    return vres;
  };
  vres.json = (cuerpo: unknown) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(cuerpo));
    return vres;
  };
  vres.send = (cuerpo: unknown) => {
    if (typeof cuerpo === 'object' && cuerpo !== null && !Buffer.isBuffer(cuerpo)) {
      return vres.json(cuerpo);
    }
    res.end(cuerpo as string | Buffer | undefined);
    return vres;
  };
  vres.redirect = (estadoOUrl: string | number, url?: string) => {
    const destino = typeof estadoOUrl === 'string' ? estadoOUrl : (url ?? '/');
    res.statusCode = typeof estadoOUrl === 'number' ? estadoOUrl : 307;
    res.setHeader('Location', destino);
    res.end();
    return vres;
  };
  return vres;
}

/**
 * Ejecuta un handler estilo Vercel sobre un req/res de Node.
 * No registra el cuerpo de la peticion: el contenido de las preguntas no se guarda en logs.
 */
export async function ejecutarHandlerVercel(
  handler: Handler,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const vres = aumentarRespuesta(res);
  let cuerpo: unknown;
  try {
    cuerpo = parsearCuerpo(req, await leerCuerpo(req));
  } catch (error) {
    const estado = error instanceof ErrorCuerpo ? error.estado : 400;
    const codigo = error instanceof ErrorCuerpo ? error.codigo : 'cuerpo_invalido';
    vres.status(estado).json({ error: codigo });
    return;
  }
  const vreq = req as VercelRequest;
  vreq.body = cuerpo;
  vreq.query = parsearQuery(req.url);
  vreq.cookies = {};
  try {
    await handler(vreq, vres);
  } catch {
    if (!res.headersSent) vres.status(500).json({ error: 'error_interno' });
    else res.end();
  }
}

export function rutaDe(req: IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://localhost').pathname;
}
