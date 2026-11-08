import MiniSearch from 'minisearch';

import type { BaseNormativa, Cita } from './BaseNormativa';
import { NormalizadorEspanol, terminosCoinciden } from './NormalizadorEspanol';
import {
  AVISO_LEGAL,
  crearAbstencion,
  redondear,
  type ProveedorRespuesta,
  type RespuestaAsistente,
} from './ProveedorRespuesta';

/** Firma mínima de fetch que necesita el proveedor; se inyecta para poder probarlo sin red. */
export type FuncionFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface ConfigLLM {
  /** Endpoint compatible con OpenAI, por ejemplo https://xxxx.proxy.runpod.net (con o sin /v1). */
  baseUrl: string;
  modelo: string;
  apiKey?: string;
  timeoutMs?: number;
  /** Fragmentos que se mandan como contexto. */
  maxFragmentos?: number;
}

export interface FragmentoNormativo {
  /** Id del fragmento: "<idEntrada>#<n>". */
  id: string;
  entradaId: string;
  norma: string;
  articulo: string;
  titulo: string;
  texto: string;
}

const TIMEOUT_PREDETERMINADO_MS = 15000;
const MAX_FRAGMENTOS_PREDETERMINADO = 5;
// Tamaño de fragmento: los artículos largos (como el 131) se parten por párrafos.
const MAX_CARACTERES_FRAGMENTO = 1500;
const MAX_CARACTERES_RESPUESTA = 1500;

const INSTRUCCIONES_SISTEMA = [
  'Eres el asistente de VozVial. Ayudas a conductores en Colombia a entender normas de tránsito.',
  'Responde SOLO con lo que dicen los fragmentos normativos que te doy. No uses otro conocimiento.',
  'Escribe en español sencillo, en segunda persona y en frases cortas. No des asesoría legal ni prometas resultados.',
  'Devuelve únicamente un objeto JSON con esta forma: {"respuesta": "texto", "citas": ["id"]}.',
  'En "citas" pon los ids exactos de los fragmentos que sustentan la respuesta (al menos uno).',
  'Si los fragmentos no responden la pregunta, devuelve {"respuesta": "", "citas": []}.',
].join('\n');

/**
 * Modo LLM (opcional). Recupera fragmentos de la base con MiniSearch, los manda
 * como contexto a un endpoint compatible con OpenAI y exige JSON con citas.
 * Cada cita debe estar entre los fragmentos recuperados; si una no lo está,
 * si el JSON no sirve, si hay error o si se agota el tiempo, se abstiene.
 * Nunca está activo por defecto: solo se crea si hay LLM_BASE_URL y LLM_MODELO.
 */
export class ProveedorLLM implements ProveedorRespuesta {
  readonly modo = 'llm' as const;
  private readonly normalizador = new NormalizadorEspanol();
  private readonly fragmentos: ReadonlyMap<string, FragmentoNormativo>;
  private readonly indice: MiniSearch;
  private readonly url: string;
  private readonly timeoutMs: number;
  private readonly maxFragmentos: number;

  constructor(
    private readonly base: BaseNormativa,
    private readonly config: ConfigLLM,
    private readonly fetchFn: FuncionFetch,
  ) {
    this.url = ProveedorLLM.urlCompletions(config.baseUrl);
    this.timeoutMs = config.timeoutMs ?? TIMEOUT_PREDETERMINADO_MS;
    this.maxFragmentos = config.maxFragmentos ?? MAX_FRAGMENTOS_PREDETERMINADO;

    const fragmentos = new Map<string, FragmentoNormativo>();
    for (const e of base.todas()) {
      partirTexto(e.textoLiteral).forEach((texto, i) => {
        const id = `${e.id}#${i + 1}`;
        fragmentos.set(id, { id, entradaId: e.id, norma: e.norma, articulo: e.articulo, titulo: e.titulo, texto });
      });
    }
    this.fragmentos = fragmentos;

    const n = this.normalizador;
    this.indice = new MiniSearch({
      idField: 'id',
      fields: ['titulo', 'texto', 'temas'],
      tokenize: (texto: string) => n.tokens(texto),
      processTerm: (termino: string) => termino,
      searchOptions: {
        boost: { titulo: 2, texto: 1, temas: 1.5 },
        prefix: (termino: string) => termino.length >= 5,
        fuzzy: (termino: string) => (termino.length >= 6 ? 0.2 : false),
        combineWith: 'OR',
      },
    });
    this.indice.addAll(
      [...fragmentos.values()].map((f) => ({
        id: f.id,
        titulo: f.titulo,
        texto: f.texto,
        temas: (base.porId(f.entradaId)?.temas ?? []).join(' '),
      })),
    );
  }

  /** Lee la configuración del entorno. Devuelve null si falta LLM_BASE_URL o LLM_MODELO. */
  static configDesdeEntorno(env: Record<string, string | undefined>): ConfigLLM | null {
    const baseUrl = env.LLM_BASE_URL?.trim();
    const modelo = env.LLM_MODELO?.trim();
    if (!baseUrl || !modelo) return null;
    const timeout = Number(env.LLM_TIMEOUT_MS);
    return {
      baseUrl,
      modelo,
      apiKey: env.LLM_API_KEY?.trim() || undefined,
      timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : undefined,
    };
  }

  static urlCompletions(baseUrl: string): string {
    const limpia = baseUrl.replace(/\/+$/, '');
    if (limpia.endsWith('/chat/completions')) return limpia;
    if (limpia.endsWith('/v1')) return `${limpia}/chat/completions`;
    return `${limpia}/v1/chat/completions`;
  }

  /** Fragmentos más pertinentes para la pregunta, en orden. */
  recuperar(pregunta: string): FragmentoNormativo[] {
    const consulta = this.normalizador.terminosUnicos(pregunta).join(' ');
    if (!consulta) return [];
    return this.indice
      .search(consulta)
      .slice(0, this.maxFragmentos)
      .map((r) => this.fragmentos.get(String(r.id)))
      .filter((f): f is FragmentoNormativo => f !== undefined);
  }

  async responder(pregunta: string): Promise<RespuestaAsistente> {
    const recuperados = this.recuperar(pregunta);
    const puntaje = this.coberturaSimple(pregunta, recuperados);
    if (recuperados.length === 0) return crearAbstencion(this.modo, 0);

    const contenido = await this.consultarModelo(pregunta, recuperados);
    if (contenido === null) return crearAbstencion(this.modo, puntaje);

    const salida = parsearSalida(contenido);
    if (!salida) return crearAbstencion(this.modo, puntaje);

    // Toda cita debe ser uno de los fragmentos enviados (o su entrada). Una sola inventada invalida la respuesta.
    const porFragmento = new Map(recuperados.map((f) => [f.id, f.entradaId]));
    const entradasPermitidas = new Set(recuperados.map((f) => f.entradaId));
    const idsEntradas: string[] = [];
    for (const cita of salida.citas) {
      const entradaId = porFragmento.get(cita) ?? (entradasPermitidas.has(cita) ? cita : null);
      if (entradaId === null) return crearAbstencion(this.modo, puntaje);
      if (!idsEntradas.includes(entradaId)) idsEntradas.push(entradaId);
    }
    const citas: Cita[] = this.base.citas(idsEntradas);
    if (citas.length === 0 || citas.length !== idsEntradas.length) return crearAbstencion(this.modo, puntaje);

    return {
      tipo: 'respuesta',
      texto: salida.respuesta.slice(0, MAX_CARACTERES_RESPUESTA),
      citas,
      puntaje: redondear(puntaje),
      modo: this.modo,
      aviso: AVISO_LEGAL,
    };
  }

  private async consultarModelo(pregunta: string, fragmentos: FragmentoNormativo[]): Promise<string | null> {
    const contexto = fragmentos
      .map((f) => `[${f.id}] ${f.norma}, artículo ${f.articulo} (${f.titulo}):\n${f.texto}`)
      .join('\n\n');
    const cuerpo = {
      model: this.config.modelo,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INSTRUCCIONES_SISTEMA },
        { role: 'user', content: `Fragmentos normativos:\n\n${contexto}\n\nPregunta: ${pregunta}` },
      ],
    };
    const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) cabeceras.Authorization = `Bearer ${this.config.apiKey}`;

    const controlador = new AbortController();
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    // La carrera con el temporizador cubre fetch que ignoran la señal de cancelación.
    const tiempoAgotado = new Promise<null>((resolve) => {
      temporizador = setTimeout(() => {
        controlador.abort();
        resolve(null);
      }, this.timeoutMs);
    });
    const peticion = (async (): Promise<string | null> => {
      try {
        const respuesta = await this.fetchFn(this.url, {
          method: 'POST',
          headers: cabeceras,
          body: JSON.stringify(cuerpo),
          signal: controlador.signal,
        });
        if (!respuesta.ok) return null;
        const datos = (await respuesta.json()) as { choices?: { message?: { content?: unknown } }[] };
        const contenido = datos?.choices?.[0]?.message?.content;
        return typeof contenido === 'string' ? contenido : null;
      } catch {
        return null;
      }
    })();
    try {
      return await Promise.race([peticion, tiempoAgotado]);
    } finally {
      clearTimeout(temporizador);
    }
  }

  private coberturaSimple(pregunta: string, fragmentos: FragmentoNormativo[]): number {
    const terminos = this.normalizador.terminosUnicos(pregunta);
    if (terminos.length === 0 || fragmentos.length === 0) return 0;
    const vocabulario = new Set(fragmentos.flatMap((f) => this.normalizador.tokens(`${f.titulo} ${f.texto}`)));
    const lista = [...vocabulario];
    const cubiertos = terminos.filter((t) => lista.some((v) => terminosCoinciden(v, t))).length;
    return cubiertos / terminos.length;
  }
}

/** Interpreta el contenido del modelo. Acepta el JSON envuelto en un bloque ```json. */
export function parsearSalida(contenido: string): { respuesta: string; citas: string[] } | null {
  const sinBloque = contenido
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  let datos: unknown;
  try {
    datos = JSON.parse(sinBloque);
  } catch {
    return null;
  }
  if (typeof datos !== 'object' || datos === null) return null;
  const { respuesta, citas } = datos as { respuesta?: unknown; citas?: unknown };
  if (typeof respuesta !== 'string' || !respuesta.trim()) return null;
  if (!Array.isArray(citas) || citas.length === 0 || !citas.every((c) => typeof c === 'string')) return null;
  return { respuesta: respuesta.trim(), citas: citas as string[] };
}

/** Parte un texto largo por párrafos en trozos de hasta MAX_CARACTERES_FRAGMENTO. */
function partirTexto(texto: string): string[] {
  const parrafos = texto.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const trozos: string[] = [];
  let actual = '';
  for (const p of parrafos) {
    if (actual && actual.length + p.length + 1 > MAX_CARACTERES_FRAGMENTO) {
      trozos.push(actual);
      actual = '';
    }
    actual = actual ? `${actual}\n${p}` : p;
  }
  if (actual) trozos.push(actual);
  return trozos.length > 0 ? trozos : [texto];
}
