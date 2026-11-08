/**
 * Base normativa en memoria, construida desde data/normativa/*.json.
 * Solo conserva entradas con verificado: true; las demás se descartan al
 * construir, así ninguna parte de la app puede citarlas por error.
 */

/** Entrada tal como está en data/normativa/<norma>.json (docs/base-normativa.md). */
export interface EntradaNormativaJSON {
  id: string;
  norma: string;
  articulo: string;
  titulo: string;
  texto_literal: string;
  modificado_por: string[];
  resumen_sencillo: string;
  url_fuente: string;
  fecha_consulta: string;
  temas: string[];
  verificado: boolean;
  verificado_por: string;
  notas: string;
}

export interface ArchivoNormativaJSON {
  norma: string;
  entradas: EntradaNormativaJSON[];
}

export interface EntradaNormativa {
  readonly id: string;
  readonly norma: string;
  readonly articulo: string;
  readonly titulo: string;
  readonly textoLiteral: string;
  readonly modificadoPor: readonly string[];
  readonly resumenSencillo: string;
  readonly urlFuente: string;
  readonly fechaConsulta: string;
  readonly temas: readonly string[];
  /** Duda jurídica que el equipo dejó en las notas ("Requiere revisión jurídica: ..."), si la hay. */
  readonly advertencia?: string;
}

/** Cita que acompaña una respuesta del asistente. */
export interface Cita {
  id: string;
  norma: string;
  articulo: string;
  titulo: string;
  textoLiteral: string;
  urlFuente: string;
  fechaConsulta: string;
}

// De las notas de verificacion solo interesa al usuario la frase "Requiere revisión jurídica: ...";
// el resto (sumas, archivos crudos, verificacion adversarial) es para el equipo.
const PATRON_ADVERTENCIA = /Requiere revisión jurídica:\s*(.+?\.)(?=\s+[A-ZÁÉÍÓÚÑ]|\s*$)/s;

export function extraerAdvertencia(notas: string | undefined): string | undefined {
  const m = notas ? PATRON_ADVERTENCIA.exec(notas) : null;
  return m?.[1]?.trim() || undefined;
}

export class BaseNormativa {
  private readonly porIdMapa: ReadonlyMap<string, EntradaNormativa>;
  private readonly descartadas: readonly string[];

  constructor(entradas: readonly EntradaNormativaJSON[]) {
    const mapa = new Map<string, EntradaNormativa>();
    const descartadas: string[] = [];
    for (const e of entradas) {
      // Además de verificado, exige texto literal y fuente: sin ellos no hay cita posible.
      if (e.verificado !== true || !e.texto_literal?.trim() || !e.url_fuente?.trim()) {
        descartadas.push(e.id);
        continue;
      }
      if (mapa.has(e.id)) throw new Error(`Id duplicado en la base normativa: ${e.id}`);
      mapa.set(
        e.id,
        Object.freeze({
          id: e.id,
          norma: e.norma,
          articulo: e.articulo,
          titulo: e.titulo,
          textoLiteral: e.texto_literal,
          modificadoPor: Object.freeze([...(e.modificado_por ?? [])]),
          resumenSencillo: e.resumen_sencillo ?? '',
          urlFuente: e.url_fuente,
          fechaConsulta: e.fecha_consulta,
          temas: Object.freeze([...(e.temas ?? [])]),
          advertencia: extraerAdvertencia(e.notas),
        }),
      );
    }
    this.porIdMapa = mapa;
    this.descartadas = Object.freeze(descartadas);
  }

  /** Construye la base desde varios archivos data/normativa/<norma>.json. */
  static desdeArchivos(archivos: readonly ArchivoNormativaJSON[]): BaseNormativa {
    return new BaseNormativa(archivos.flatMap((a) => a.entradas ?? []));
  }

  porId(id: string): EntradaNormativa | null {
    return this.porIdMapa.get(id) ?? null;
  }

  existe(id: string): boolean {
    return this.porIdMapa.has(id);
  }

  todas(): EntradaNormativa[] {
    return [...this.porIdMapa.values()];
  }

  porTema(tema: string): EntradaNormativa[] {
    const buscado = tema.trim().toLowerCase();
    return this.todas().filter((e) => e.temas.some((t) => t.toLowerCase() === buscado));
  }

  /** Ids que se descartaron por no estar verificados (para informes, nunca para citar). */
  idsDescartados(): readonly string[] {
    return this.descartadas;
  }

  /** Cita completa de una entrada verificada, o null si no existe en la base. */
  cita(id: string): Cita | null {
    const e = this.porId(id);
    if (!e) return null;
    return {
      id: e.id,
      norma: e.norma,
      articulo: e.articulo,
      titulo: e.titulo,
      textoLiteral: e.textoLiteral,
      urlFuente: e.urlFuente,
      fechaConsulta: e.fechaConsulta,
    };
  }

  /** Citas de los ids que existen; los que no están verificados se omiten. */
  citas(ids: readonly string[]): Cita[] {
    const vistas = new Set<string>();
    const salida: Cita[] = [];
    for (const id of ids) {
      if (vistas.has(id)) continue;
      vistas.add(id);
      const c = this.cita(id);
      if (c) salida.push(c);
    }
    return salida;
  }
}
