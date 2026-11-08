import MiniSearch from 'minisearch';

import type { BaseNormativa, Cita } from './BaseNormativa';
import { NormalizadorEspanol, raizLigera, terminosAfines } from './NormalizadorEspanol';
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
 * eligieron con la calibración sobre preguntas verificadas y el control
 * negativo (scripts/eval-asistente.ts); se exponen solo para que la
 * calibración pueda comparar alternativas.
 */
export interface PesosPuntaje {
  /** Crédito de un término que no está en la formulación pero sí en los temas de la pregunta verificada. */
  temas: number;
  /** Crédito de un término que solo está en la respuesta sencilla. */
  respuesta: number;
  /** Crédito de un término que solo está en el título, el resumen o los temas de las normas citadas. */
  base: number;
  /** Crédito de un término que solo está en el mejor párrafo del texto literal de las normas citadas. */
  literal: number;
  /** Peso de la cobertura de la pregunta del usuario frente a la de la formulación (0 a 1). */
  alfa: number;
  /**
   * Información mínima de la pregunta, en unidades de la palabra más rara
   * (IDF máximo). Si la suma de IDF de las palabras del usuario es menor, el
   * puntaje se multiplica por suma / minimo: una pregunta de una sola palabra
   * común ("¿audiencia?") es ambigua. No se aplica si la pregunta coincide
   * exactamente con una formulación verificada. 0 lo desactiva.
   */
  informacion: number;
}

/** Elegidos por la calibración (docs/evaluacion/asistente.md, "Cómo se eligieron umbral, margen y pesos"). */
export const PESOS_PREDETERMINADOS: Readonly<PesosPuntaje> = Object.freeze({
  temas: 0.8,
  respuesta: 0.6,
  base: 0.6,
  literal: 0.6,
  alfa: 0.7,
  informacion: 1,
});

/**
 * Umbral absoluto del modo verificado. Se eligió con la calibración sobre
 * data/preguntas-verificadas.json y data/calibracion-negativos.json (no
 * sobre el banco de evaluación).
 */
export const UMBRAL_PREDETERMINADO = 0.85;

/**
 * Margen mínimo entre la mejor pregunta verificada y la mejor rival que no
 * comparte ninguna de sus citas. Si dos respuestas con normas distintas
 * quedan casi empatadas, la pregunta es ambigua y se abstiene. Se eligió con
 * la misma calibración que el umbral.
 */
export const MARGEN_PREDETERMINADO = 0;

export interface OpcionesProveedorVerificado {
  /** Puntaje mínimo (0 a 1) para responder. Por defecto UMBRAL_PREDETERMINADO. */
  umbral?: number;
  /** Margen mínimo frente a la rival con otras citas. Por defecto MARGEN_PREDETERMINADO. */
  margen?: number;
  normalizador?: NormalizadorEspanol;
  /** Cuántas formulaciones devueltas por MiniSearch se puntúan. */
  candidatos?: number;
  pesos?: Partial<PesosPuntaje>;
}

/** Para la calibración: quita formulaciones o preguntas del índice sin reconstruirlo. */
export interface FiltroCandidatos {
  /** Ids de formulación (ver ProveedorVerificado.idFormulacion). */
  excluirFormulaciones?: ReadonlySet<string>;
  /** Ids de pregunta verificada. */
  excluirPreguntas?: ReadonlySet<string>;
}

export interface CandidatoVerificado {
  preguntaId: string;
  /** Puntaje normalizado entre 0 y 1. */
  puntaje: number;
  /** Puntaje crudo de MiniSearch (BM25), solo para desempatar. */
  puntajeBusqueda: number;
}

export interface DecisionVerificada {
  /** Mejor candidato, o null si ninguno comparte palabras con la pregunta. */
  mejor: CandidatoVerificado | null;
  /** Diferencia de puntaje con la mejor rival que no comparte citas con el mejor (1 si no hay rival). */
  margen: number;
  responde: boolean;
}

interface PreguntaIndexada {
  readonly id: string;
  readonly respuesta: string;
  readonly citas: readonly Cita[];
  readonly idsCitas: readonly string[];
  readonly terminosTemas: readonly string[];
  readonly terminosRespuesta: readonly string[];
  /** Términos del título, el resumen y los temas de las normas citadas. */
  readonly terminosBase: readonly string[];
}

/** Una forma de decir la pregunta: la pregunta principal o una de sus variantes. */
interface Formulacion {
  readonly preguntaId: string;
  readonly terminos: readonly string[];
}

/**
 * Modo verificado del asistente. Busca con MiniSearch entre las preguntas
 * verificadas y solo devuelve su respuesta_sencilla con sus citas completas.
 * Si el puntaje no supera el umbral, o si una respuesta con otras normas
 * queda a menos del margen, se abstiene. Es determinista.
 *
 * Índice: un documento por formulación (la pregunta y cada variante), con los
 * temas, la respuesta y el texto de las normas citadas como campos de bajo
 * peso. La base normativa solo ayuda a encontrar; nunca se devuelve su texto.
 *
 * Puntaje de una formulación, entre 0 y 1, con pesos IDF:
 * - cobertura de la pregunta del usuario: qué parte de sus palabras aparece
 *   en la formulación; si no, crédito parcial si aparece en los temas, la
 *   respuesta, el título o resumen de las normas citadas, o en el mejor
 *   párrafo de su texto literal;
 * - cobertura de la formulación: qué parte de sus palabras dijo el usuario;
 * - puntaje = cobertura_usuario^alfa * cobertura_formulacion^(1 - alfa).
 * El IDF se calcula sobre los párrafos de la base normativa y las respuestas
 * verificadas, no sobre las formulaciones, para que quitar una variante en la
 * calibración no cambie los pesos. Una palabra que no aparece en ese corpus
 * pesa lo máximo, así "pico y placa" o "SOAT" bajan el puntaje.
 */
export class ProveedorVerificado implements ProveedorRespuesta {
  readonly modo = 'verificado' as const;
  readonly umbral: number;
  readonly margen: number;
  private readonly normalizador: NormalizadorEspanol;
  private readonly maxCandidatos: number;
  private readonly pesos: PesosPuntaje;
  private readonly preguntas: ReadonlyMap<string, PreguntaIndexada>;
  private readonly formulaciones: ReadonlyMap<string, Formulacion>;
  private readonly descartadas: readonly string[];
  private readonly indice: MiniSearch;
  private readonly df: ReadonlyMap<string, number>;
  private readonly totalDocumentos: number;
  /** Términos de cada párrafo del texto literal, por id de entrada de la base. */
  private readonly parrafosPorEntrada: ReadonlyMap<string, readonly (readonly string[])[]>;
  /** Todos los términos indexados; con él se precalcula qué términos son afines a cada palabra del usuario. */
  private readonly vocabulario: readonly string[];

  /** Id de la formulación i de una pregunta: 0 es la pregunta principal, 1.. las variantes. */
  static idFormulacion(preguntaId: string, i: number): string {
    return `${preguntaId}#${i}`;
  }

  constructor(json: PreguntasVerificadasJSON, base: BaseNormativa, opciones: OpcionesProveedorVerificado = {}) {
    this.umbral = opciones.umbral ?? UMBRAL_PREDETERMINADO;
    this.margen = opciones.margen ?? MARGEN_PREDETERMINADO;
    this.normalizador = opciones.normalizador ?? new NormalizadorEspanol();
    // Sin tope por defecto: el índice es pequeño y así la pregunta correcta nunca queda fuera.
    this.maxCandidatos = opciones.candidatos ?? Number.POSITIVE_INFINITY;
    this.pesos = { ...PESOS_PREDETERMINADOS, ...opciones.pesos };

    const preguntas = new Map<string, PreguntaIndexada>();
    const formulaciones = new Map<string, Formulacion>();
    const descartadas: string[] = [];
    const documentos: Record<string, string>[] = [];
    const n = this.normalizador;
    const parrafosPorEntrada = new Map<string, string[][]>();
    const parrafosDe = (id: string, texto: string): string[][] => {
      let lista = parrafosPorEntrada.get(id);
      if (!lista) {
        lista = texto
          .split(/\n+/)
          .map((parrafo) => n.terminosUnicos(parrafo))
          .filter((t) => t.length > 0);
        parrafosPorEntrada.set(id, lista);
      }
      return lista;
    };

    for (const p of json.preguntas) {
      // Una pregunta sin ninguna cita verificada no se puede usar: nunca se responde sin cita.
      const citas = base.citas(p.citas ?? []);
      if (citas.length === 0 || !p.respuesta_sencilla?.trim() || preguntas.has(p.id)) {
        descartadas.push(p.id);
        continue;
      }
      const textoBase = citas
        .map((c) => {
          const e = base.porId(c.id);
          return `${c.titulo} ${e?.resumenSencillo ?? ''} ${(e?.temas ?? []).join(' ')}`;
        })
        .join(' ');
      const temas = (p.temas ?? []).join(' ');
      preguntas.set(p.id, {
        id: p.id,
        respuesta: p.respuesta_sencilla,
        citas,
        idsCitas: citas.map((c) => c.id),
        terminosTemas: n.terminosUnicos(temas.replace(/[_-]/g, ' ')),
        terminosRespuesta: n.terminosUnicos(p.respuesta_sencilla),
        terminosBase: n.terminosUnicos(textoBase.replace(/[_-]/g, ' ')),
      });
      for (const c of citas) parrafosDe(c.id, c.textoLiteral);
      [p.pregunta, ...(p.variantes ?? [])].forEach((texto, i) => {
        const id = ProveedorVerificado.idFormulacion(p.id, i);
        const terminos = n.terminosUnicos(texto);
        if (terminos.length === 0) return;
        formulaciones.set(id, { preguntaId: p.id, terminos });
        documentos.push({ id, preguntaId: p.id, texto, temas, respuesta: p.respuesta_sencilla, base: textoBase });
      });
    }

    this.preguntas = preguntas;
    this.formulaciones = formulaciones;
    this.descartadas = Object.freeze(descartadas);

    this.indice = new MiniSearch({
      idField: 'id',
      fields: ['texto', 'temas', 'respuesta', 'base'],
      storeFields: ['preguntaId'],
      tokenize: (texto: string) => n.tokens(texto.replace(/[_-]/g, ' ')),
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

    // Corpus del IDF: cada párrafo verificado de la base y cada respuesta con sus temas.
    const corpus: string[][] = [];
    for (const e of base.todas()) corpus.push(...parrafosDe(e.id, e.textoLiteral));
    for (const p of preguntas.values()) corpus.push([...new Set([...p.terminosRespuesta, ...p.terminosTemas])]);
    const df = new Map<string, number>();
    for (const doc of corpus) {
      for (const clave of new Set(doc.map(raizLigera))) df.set(clave, (df.get(clave) ?? 0) + 1);
    }
    this.df = df;
    this.totalDocumentos = corpus.length;
    this.parrafosPorEntrada = parrafosPorEntrada;

    const vocabulario = new Set<string>();
    for (const doc of corpus) doc.forEach((t) => vocabulario.add(t));
    for (const f of formulaciones.values()) f.terminos.forEach((t) => vocabulario.add(t));
    for (const p of preguntas.values()) {
      [...p.terminosTemas, ...p.terminosRespuesta, ...p.terminosBase].forEach((t) => vocabulario.add(t));
    }
    this.vocabulario = [...vocabulario];
  }

  /** Ids de preguntas verificadas que no se indexaron (sin cita verificada o sin respuesta). */
  preguntasDescartadas(): readonly string[] {
    return this.descartadas;
  }

  totalPreguntas(): number {
    return this.preguntas.size;
  }

  /** Ids de las citas de una pregunta verificada indexada. */
  citasDe(preguntaId: string): readonly string[] {
    return this.preguntas.get(preguntaId)?.idsCitas ?? [];
  }

  /** Candidatos por pregunta verificada, del mejor al peor. Lo usan responder() y la calibración. */
  candidatos(pregunta: string, filtro: FiltroCandidatos = {}): CandidatoVerificado[] {
    const terminos = this.normalizador.terminosUnicos(pregunta);
    if (terminos.length === 0 || this.preguntas.size === 0) return [];
    const consulta = this.prepararConsulta(terminos);
    const { excluirFormulaciones, excluirPreguntas } = filtro;
    const resultados = this.indice
      .search(terminos.join(' '), {
        filter: (r) =>
          !excluirFormulaciones?.has(String(r.id)) && !excluirPreguntas?.has(String(r['preguntaId'])),
      })
      .slice(0, this.maxCandidatos);
    const literalPorPregunta = new Map<string, number[][]>();
    const porPregunta = new Map<string, CandidatoVerificado>();
    for (const r of resultados) {
      const f = this.formulaciones.get(String(r.id));
      const p = f ? this.preguntas.get(f.preguntaId) : undefined;
      if (!f || !p) continue;
      let literal = literalPorPregunta.get(p.id);
      if (!literal) {
        literal = p.idsCitas.flatMap((id) => this.coberturaParrafos(consulta, id));
        literalPorPregunta.set(p.id, literal);
      }
      const puntaje = this.puntuar(consulta, f, p, literal);
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

  /**
   * Decide con umbral absoluto y margen relativo. La rival es la mejor
   * candidata que no comparte ninguna cita con la mejor: si comparten citas,
   * cualquiera de las dos se apoya en la misma norma y no hay ambigüedad.
   */
  decidir(
    candidatos: readonly CandidatoVerificado[],
    umbral: number = this.umbral,
    margenMinimo: number = this.margen,
  ): DecisionVerificada {
    const mejor = candidatos[0] ?? null;
    if (!mejor) return { mejor: null, margen: 0, responde: false };
    const propias = this.citasDe(mejor.preguntaId);
    const rival = candidatos.find((c) => !this.citasDe(c.preguntaId).some((id) => propias.includes(id)));
    const margen = mejor.puntaje - (rival?.puntaje ?? 0);
    return { mejor, margen, responde: mejor.puntaje >= umbral && margen >= margenMinimo };
  }

  async responder(pregunta: string): Promise<RespuestaAsistente> {
    const decision = this.decidir(this.candidatos(pregunta));
    const mejor = decision.mejor;
    if (!mejor) return crearAbstencion(this.modo, 0);
    const p = this.preguntas.get(mejor.preguntaId);
    if (!p || !decision.responde || p.citas.length === 0) {
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
    const d = this.df.get(raizLigera(termino)) ?? 0;
    return Math.log(1 + this.totalDocumentos / (d + 1));
  }

  /**
   * Precalcula, para cada palabra del usuario, el conjunto de términos del
   * vocabulario que le son afines (terminosAfines). Así cada comparación
   * posterior es una búsqueda en un Set y no una comparación letra a letra.
   */
  private prepararConsulta(terminos: readonly string[]): Consulta {
    const afines = terminos.map((t) => {
      const conjunto = new Set<string>([t]);
      for (const v of this.vocabulario) if (terminosAfines(v, t)) conjunto.add(v);
      return conjunto;
    });
    const todos = new Set<string>();
    afines.forEach((a) => a.forEach((v) => todos.add(v)));
    return { terminos, pesos: terminos.map((t) => this.pesoIdf(t)), afines, todos };
  }

  /** Para cada párrafo del texto literal de una entrada, qué palabras del usuario contiene (índices). Solo párrafos con alguna. */
  private coberturaParrafos(consulta: Consulta, idEntrada: string): number[][] {
    const salida: number[][] = [];
    for (const parrafo of this.parrafosPorEntrada.get(idEntrada) ?? []) {
      const cubiertos: number[] = [];
      consulta.afines.forEach((a, i) => {
        if (parrafo.some((t) => a.has(t))) cubiertos.push(i);
      });
      if (cubiertos.length > 0) salida.push(cubiertos);
    }
    return salida;
  }

  private puntuar(consulta: Consulta, f: Formulacion, p: PreguntaIndexada, literal: readonly number[][]): number {
    const w = this.pesos;
    const { terminos, pesos, afines } = consulta;
    const contiene = (lista: readonly string[], i: number) => lista.some((t) => afines[i]!.has(t));
    let totalUsuario = 0;
    let cubiertoUsuario = 0;
    const pendientes = new Set<number>();
    terminos.forEach((_, i) => {
      const peso = pesos[i]!;
      totalUsuario += peso;
      if (contiene(f.terminos, i)) cubiertoUsuario += peso;
      else if (contiene(p.terminosTemas, i)) cubiertoUsuario += peso * w.temas;
      else if (contiene(p.terminosRespuesta, i)) cubiertoUsuario += peso * w.respuesta;
      else if (contiene(p.terminosBase, i)) cubiertoUsuario += peso * w.base;
      else pendientes.add(i);
    });
    // Lo que quede sin cubrir puede estar en un solo párrafo del texto literal (el que más cubra).
    if (pendientes.size > 0 && w.literal > 0) {
      let mejorParrafo = 0;
      for (const cubiertos of literal) {
        let suma = 0;
        for (const i of cubiertos) if (pendientes.has(i)) suma += pesos[i]!;
        if (suma > mejorParrafo) mejorParrafo = suma;
      }
      cubiertoUsuario += mejorParrafo * w.literal;
    }
    let totalFormulacion = 0;
    let cubiertoFormulacion = 0;
    for (const t of f.terminos) {
      const peso = this.pesoIdf(t);
      totalFormulacion += peso;
      // terminosAfines es simétrica: t es afín a alguna palabra del usuario si está en la unión.
      if (consulta.todos.has(t)) cubiertoFormulacion += peso;
    }
    if (totalUsuario === 0 || totalFormulacion === 0) return 0;
    const cu = cubiertoUsuario / totalUsuario;
    const cf = cubiertoFormulacion / totalFormulacion;
    const minimo = w.informacion * Math.log(1 + this.totalDocumentos);
    // Si la pregunta repite una formulación verificada palabra por palabra, no se castiga por corta.
    const exacta = cu === 1 && cf === 1;
    const factor = minimo > 0 && !exacta ? Math.min(1, totalUsuario / minimo) : 1;
    return factor * Math.pow(cu, w.alfa) * Math.pow(cf, 1 - w.alfa);
  }
}

/** Palabras del usuario ya preparadas para puntuar. */
interface Consulta {
  readonly terminos: readonly string[];
  readonly pesos: readonly number[];
  /** Por cada palabra del usuario, los términos del vocabulario afines a ella (incluida ella misma). */
  readonly afines: readonly ReadonlySet<string>[];
  /** Unión de afines. */
  readonly todos: ReadonlySet<string>;
}
