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

export interface PreguntaVerificadaJSON {
  id: string;
  pregunta: string;
  variantes: string[];
  respuesta_sencilla: string;
  citas: string[];
  temas: string[];
}

export interface PreguntasVerificadasJSON {
  preguntas: PreguntaVerificadaJSON[];
}

/**
 * Pesos del puntaje. Los valores por defecto (PESOS_PREDETERMINADOS) se
 * eligieron con la calibración sobre preguntas verificadas; se exponen solo
 * para que la calibración pueda comparar alternativas.
 */
export interface PesosPuntaje {
  /** Crédito de un término que no está en la formulación pero sí en los temas de la pregunta verificada. */
  temas: number;
  /** Crédito de un término que solo está en la respuesta sencilla. */
  respuesta: number;
  /** Crédito de un término que solo está en el título o el resumen de las normas citadas. */
  base: number;
  /** Peso de la cobertura de la pregunta del usuario frente a la de la formulación (0 a 1). */
  alfa: number;
}

export const PESOS_PREDETERMINADOS: Readonly<PesosPuntaje> = Object.freeze({
  temas: 0.5,
  respuesta: 0.3,
  base: 0.2,
  alfa: 0.7,
});

export interface OpcionesProveedorVerificado {
  /** Puntaje mínimo (0 a 1) para responder. Por defecto UMBRAL_PREDETERMINADO. */
  umbral?: number;
  normalizador?: NormalizadorEspanol;
  /** Cuántas formulaciones devueltas por MiniSearch se puntúan. */
  candidatos?: number;
  pesos?: Partial<PesosPuntaje>;
}

export interface CandidatoVerificado {
  preguntaId: string;
  /** Puntaje normalizado entre 0 y 1. */
  puntaje: number;
  /** Puntaje crudo de MiniSearch (BM25), solo para desempatar. */
  puntajeBusqueda: number;
}

interface PreguntaIndexada {
  readonly id: string;
  readonly respuesta: string;
  readonly citas: readonly Cita[];
  readonly terminosTemas: readonly string[];
  readonly terminosRespuesta: readonly string[];
  /** Términos del título y el resumen de las normas citadas. */
  readonly terminosBase: readonly string[];
}

/** Una forma de decir la pregunta: la pregunta principal o una de sus variantes. */
interface Formulacion {
  readonly preguntaId: string;
  readonly terminos: readonly string[];
}

/**
 * Umbral del modo verificado. Se eligió con la calibración sobre
 * data/preguntas-verificadas.json (no sobre el banco de evaluación), que
 * corre scripts/eval-asistente.ts y queda documentada en
 * docs/evaluacion/asistente.md, sección "Cómo se eligió el umbral".
 */
export const UMBRAL_PREDETERMINADO = 0.85;

/**
 * Modo verificado del asistente. Busca con MiniSearch entre las preguntas
 * verificadas y solo devuelve su respuesta_sencilla con sus citas completas.
 * Si el puntaje no supera el umbral, se abstiene. Es determinista.
 *
 * Índice: un documento por formulación (la pregunta y cada variante), con los
 * temas, la respuesta y el texto de las normas citadas como campos de bajo
 * peso. La base normativa solo ayuda a encontrar; nunca se devuelve su texto.
 *
 * Puntaje de una formulación, entre 0 y 1, con pesos IDF:
 * - cobertura de la pregunta del usuario: qué parte de sus palabras aparece
 *   en la formulación (crédito parcial si solo aparece en los temas, la
 *   respuesta o la base);
 * - cobertura de la formulación: qué parte de las palabras de la formulación
 *   dijo el usuario;
 * - puntaje = cobertura_usuario^alfa * cobertura_formulacion^(1 - alfa).
 * Una palabra que no aparece en ninguna pregunta verificada pesa lo máximo,
 * así "pico y placa" o "SOAT" bajan el puntaje y llevan a abstenerse.
 */
export class ProveedorVerificado implements ProveedorRespuesta {
  readonly modo = 'verificado' as const;
  readonly umbral: number;
  private readonly normalizador: NormalizadorEspanol;
  private readonly maxCandidatos: number;
  private readonly pesos: PesosPuntaje;
  private readonly preguntas: ReadonlyMap<string, PreguntaIndexada>;
  private readonly formulaciones: ReadonlyMap<string, Formulacion>;
  private readonly descartadas: readonly string[];
  private readonly indice: MiniSearch;
  private readonly idf: ReadonlyMap<string, number>;
  private readonly idfDesconocido: number;

  constructor(json: PreguntasVerificadasJSON, base: BaseNormativa, opciones: OpcionesProveedorVerificado = {}) {
    this.umbral = opciones.umbral ?? UMBRAL_PREDETERMINADO;
    this.normalizador = opciones.normalizador ?? new NormalizadorEspanol();
    // Sin tope por defecto: el índice es pequeño y así la pregunta correcta nunca queda fuera.
    this.maxCandidatos = opciones.candidatos ?? Number.POSITIVE_INFINITY;
    this.pesos = { ...PESOS_PREDETERMINADOS, ...opciones.pesos };

    const preguntas = new Map<string, PreguntaIndexada>();
    const formulaciones = new Map<string, Formulacion>();
    const descartadas: string[] = [];
    const documentos: Record<string, string>[] = [];
    const n = this.normalizador;

    for (const p of json.preguntas) {
      // Una pregunta sin ninguna cita verificada no se puede usar: nunca se responde sin cita.
      const citas = base.citas(p.citas ?? []);
      if (citas.length === 0 || !p.respuesta_sencilla?.trim() || preguntas.has(p.id)) {
        descartadas.push(p.id);
        continue;
      }
      const textoBase = citas.map((c) => `${c.titulo} ${base.porId(c.id)?.resumenSencillo ?? ''}`).join(' ');
      const temas = (p.temas ?? []).join(' ');
      preguntas.set(p.id, {
        id: p.id,
        respuesta: p.respuesta_sencilla,
        citas,
        terminosTemas: n.terminosUnicos(temas.replace(/_/g, ' ')),
        terminosRespuesta: n.terminosUnicos(p.respuesta_sencilla),
        terminosBase: n.terminosUnicos(textoBase),
      });
      [p.pregunta, ...(p.variantes ?? [])].forEach((texto, i) => {
        const id = `${p.id}#${i}`;
        const terminos = n.terminosUnicos(texto);
        if (terminos.length === 0) return;
        formulaciones.set(id, { preguntaId: p.id, terminos });
        documentos.push({ id, texto, temas, respuesta: p.respuesta_sencilla, base: textoBase });
      });
    }

    this.preguntas = preguntas;
    this.formulaciones = formulaciones;
    this.descartadas = Object.freeze(descartadas);

    this.indice = new MiniSearch({
      idField: 'id',
      fields: ['texto', 'temas', 'respuesta', 'base'],
      tokenize: (texto: string) => n.tokens(texto.replace(/_/g, ' ')),
      // Los términos ya salen normalizados del tokenizador.
      processTerm: (termino: string) => termino,
      searchOptions: {
        boost: { texto: 3, temas: 1.5, respuesta: 1, base: 0.3 },
        prefix: (termino: string) => termino.length >= 5,
        fuzzy: (termino: string) => (termino.length >= 6 ? 0.2 : false),
        combineWith: 'OR',
      },
    });
    this.indice.addAll(documentos);

    // IDF por pregunta verificada: un término presente en muchas preguntas distingue poco.
    const df = new Map<string, number>();
    for (const p of preguntas.values()) {
      const terminos = new Set<string>(p.terminosRespuesta);
      for (const f of formulaciones.values()) if (f.preguntaId === p.id) f.terminos.forEach((t) => terminos.add(t));
      for (const t of terminos) df.set(t, (df.get(t) ?? 0) + 1);
    }
    const total = preguntas.size;
    const idf = new Map<string, number>();
    for (const [t, d] of df) idf.set(t, Math.log(1 + total / (d + 1)));
    this.idf = idf;
    this.idfDesconocido = Math.log(1 + total);
  }

  /** Ids de preguntas verificadas que no se indexaron (sin cita verificada o sin respuesta). */
  preguntasDescartadas(): readonly string[] {
    return this.descartadas;
  }

  totalPreguntas(): number {
    return this.preguntas.size;
  }

  /** Candidatos por pregunta verificada, del mejor al peor. Lo usan responder() y la calibración. */
  candidatos(pregunta: string): CandidatoVerificado[] {
    const terminos = this.normalizador.terminosUnicos(pregunta);
    if (terminos.length === 0 || this.preguntas.size === 0) return [];
    const resultados = this.indice.search(terminos.join(' ')).slice(0, this.maxCandidatos);
    const porPregunta = new Map<string, CandidatoVerificado>();
    for (const r of resultados) {
      const f = this.formulaciones.get(String(r.id));
      const p = f ? this.preguntas.get(f.preguntaId) : undefined;
      if (!f || !p) continue;
      const puntaje = this.puntuar(terminos, f, p);
      const previo = porPregunta.get(p.id);
      if (!previo || puntaje > previo.puntaje || (puntaje === previo.puntaje && r.score > previo.puntajeBusqueda)) {
        porPregunta.set(p.id, { preguntaId: p.id, puntaje, puntajeBusqueda: r.score });
      }
    }
    // Orden determinista: puntaje, luego puntaje de búsqueda, luego id.
    return [...porPregunta.values()].sort(
      (a, b) =>
        b.puntaje - a.puntaje || b.puntajeBusqueda - a.puntajeBusqueda || a.preguntaId.localeCompare(b.preguntaId),
    );
  }

  async responder(pregunta: string): Promise<RespuestaAsistente> {
    const mejor = this.candidatos(pregunta)[0];
    if (!mejor) return crearAbstencion(this.modo, 0);
    const p = this.preguntas.get(mejor.preguntaId);
    if (!p || mejor.puntaje < this.umbral || p.citas.length === 0) {
      return crearAbstencion(this.modo, mejor.puntaje);
    }
    return {
      tipo: 'respuesta',
      texto: p.respuesta,
      citas: p.citas.map((c) => ({ ...c })),
      puntaje: redondear(mejor.puntaje),
      modo: this.modo,
      aviso: AVISO_LEGAL,
      preguntaId: p.id,
    };
  }

  private pesoIdf(termino: string): number {
    return this.idf.get(termino) ?? this.idfDesconocido;
  }

  private puntuar(terminos: readonly string[], f: Formulacion, p: PreguntaIndexada): number {
    const { temas, respuesta, base, alfa } = this.pesos;
    let totalUsuario = 0;
    let cubiertoUsuario = 0;
    for (const t of terminos) {
      const peso = this.pesoIdf(t);
      totalUsuario += peso;
      if (contiene(f.terminos, t)) cubiertoUsuario += peso;
      else if (contiene(p.terminosTemas, t)) cubiertoUsuario += peso * temas;
      else if (contiene(p.terminosRespuesta, t)) cubiertoUsuario += peso * respuesta;
      else if (contiene(p.terminosBase, t)) cubiertoUsuario += peso * base;
    }
    let totalFormulacion = 0;
    let cubiertoFormulacion = 0;
    for (const t of f.terminos) {
      const peso = this.pesoIdf(t);
      totalFormulacion += peso;
      if (contiene(terminos, t)) cubiertoFormulacion += peso;
    }
    if (totalUsuario === 0 || totalFormulacion === 0) return 0;
    const cu = cubiertoUsuario / totalUsuario;
    const cf = cubiertoFormulacion / totalFormulacion;
    return Math.pow(cu, alfa) * Math.pow(cf, 1 - alfa);
  }
}

function contiene(lista: readonly string[], termino: string): boolean {
  for (const t of lista) if (terminosCoinciden(t, termino)) return true;
  return false;
}
