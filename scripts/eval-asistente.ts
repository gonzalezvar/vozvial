/**
 * Evalúa el asistente con data/banco-evaluacion.json y escribe docs/evaluacion/asistente.md.
 *
 * Uso:
 *   npm run eval:asistente                          (en proceso, modo verificado)
 *   npm run eval:asistente -- --url http://localhost:3001/api/asistente   (además, contra un servidor)
 *
 * También documenta cómo se eligió el umbral: la calibración usa solo
 * data/preguntas-verificadas.json, nunca el banco de evaluación.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { AsistenteNormativo } from '../src/core/AsistenteNormativo';
import { obtenerBaseNormativa, PREGUNTAS_VERIFICADAS } from '../src/core/cargarDatos';
import { DetectorTema } from '../src/core/DetectorTema';
import { NormalizadorEspanol } from '../src/core/NormalizadorEspanol';
import type { RespuestaAsistente } from '../src/core/ProveedorRespuesta';
import {
  MARGEN_PREDETERMINADO,
  PESOS_PREDETERMINADOS,
  ProveedorVerificado,
  UMBRAL_PREDETERMINADO,
  type FiltroCandidatos,
  type PesosPuntaje,
} from '../src/core/ProveedorVerificado';

const RAIZ = path.resolve(__dirname, '..');
const SALIDA = path.join(RAIZ, 'docs', 'evaluacion', 'asistente.md');

type TipoBanco = 'con_sustento' | 'sin_sustento' | 'fuera_de_tema';

interface PreguntaBanco {
  id: string;
  pregunta: string;
  tipo: TipoBanco;
  articulos_esperados: string[];
  respuesta_esperada: string;
  construida_por: string;
  calificada_por: string;
}

interface Resultado {
  item: PreguntaBanco;
  respuesta: RespuestaAsistente;
  ms: number;
  acierto: boolean;
  categoria: string;
}

type Responder = (pregunta: string) => Promise<RespuestaAsistente>;

// ---------- Calibración (solo preguntas verificadas y control negativo) ----------

interface NegativoControl {
  id: string;
  tipo: 'sin_sustento' | 'fuera_de_tema';
  pregunta: string;
}

type OrigenConsulta = 'positivo' | 'negativo_sin_articulo' | 'control_sin_sustento' | 'control_fuera_de_tema';

/** Una consulta de calibración con lo que debería pasar. */
interface ConsultaCalibracion {
  origen: OrigenConsulta;
  texto: string;
  /** Solo positivos: citas de la pregunta original (acierta si la ganadora comparte alguna). */
  citasOriginales: readonly string[];
  filtro: FiltroCandidatos;
}

/** Resultado de una consulta con umbral 0 y margen 0: el barrido decide después. */
interface MedidaCalibracion {
  origen: OrigenConsulta;
  enTema: boolean;
  puntaje: number;
  margen: number;
  correcta: boolean;
}

interface PuntoCalibracion {
  umbral: number;
  margen: number;
  positivosCorrectos: number;
  positivosOtraCita: number;
  positivosAbstencion: number;
  negativosRespondidos: number;
  controlRespondidos: number;
  costo: number;
}

interface Calibracion {
  pesos: PesosPuntaje;
  puntos: PuntoCalibracion[];
  mejor: PuntoCalibracion;
  aciertoPrimero: number;
  positivos: number;
  negativos: number;
  control: number;
}

const comparteCita = (a: readonly string[], b: readonly string[]): boolean => a.some((c) => b.includes(c));

const UMBRALES = Array.from({ length: 16 }, (_, i) => (20 + 5 * i) / 100);
const MARGENES = [0, 0.02, 0.05, 0.1, 0.15];

function leerNegativos(): NegativoControl[] {
  return (JSON.parse(readFileSync(path.join(RAIZ, 'data', 'calibracion-negativos.json'), 'utf8')) as {
    preguntas: NegativoControl[];
  }).preguntas;
}

/**
 * Consultas de la calibración. No usan el banco de evaluación.
 * - Positivos (deja una formulación fuera): cada formulación (pregunta
 *   principal y cada variante) se busca en el índice sin esa formulación.
 *   Acierta si la ganadora cita al menos un artículo de la pregunta original,
 *   el mismo criterio del banco.
 * - Negativos sin artículo: cada formulación se busca en el índice sin
 *   ninguna pregunta que cite alguno de sus artículos. Simula una pregunta de
 *   tránsito sin sustento: lo correcto es abstenerse.
 * - Control negativo (data/calibracion-negativos.json): preguntas escritas
 *   por el equipo, de tránsito sin sustento en la base y fuera de tema.
 *   Lo correcto es no responder.
 */
function consultasCalibracion(): ConsultaCalibracion[] {
  const consultas: ConsultaCalibracion[] = [];
  for (const p of PREGUNTAS_VERIFICADAS.preguntas) {
    const sinArticulo = new Set(
      PREGUNTAS_VERIFICADAS.preguntas.filter((x) => comparteCita(x.citas, p.citas)).map((x) => x.id),
    );
    [p.pregunta, ...p.variantes].forEach((texto, i) => {
      consultas.push({
        origen: 'positivo',
        texto,
        citasOriginales: p.citas,
        filtro: { excluirFormulaciones: new Set([ProveedorVerificado.idFormulacion(p.id, i)]) },
      });
      consultas.push({ origen: 'negativo_sin_articulo', texto, citasOriginales: [], filtro: { excluirPreguntas: sinArticulo } });
    });
  }
  for (const n of leerNegativos()) {
    consultas.push({
      origen: n.tipo === 'sin_sustento' ? 'control_sin_sustento' : 'control_fuera_de_tema',
      texto: n.pregunta,
      citasOriginales: [],
      filtro: {},
    });
  }
  return consultas;
}

/**
 * Costo = 2 por cada respuesta equivocada (positivo con cita no pertinente o
 * cualquier negativo respondido) + 1 por cada abstención de un positivo.
 * Responder mal pesa el doble porque engaña; abstenerse remite a otra fuente.
 * Si dos puntos empatan, se elige el umbral más alto y luego el margen más alto.
 */
function calibrar(pesos: PesosPuntaje, consultas: readonly ConsultaCalibracion[]): Calibracion {
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa(), { umbral: 0, margen: 0, pesos });
  const detector = new DetectorTema();
  const medidas: MedidaCalibracion[] = consultas.map((c) => {
    const enTema = detector.esDelTema(c.texto);
    const decision = proveedor.decidir(proveedor.candidatos(c.texto, c.filtro), 0, 0);
    const ganadora = decision.mejor ? proveedor.citasDe(decision.mejor.preguntaId) : [];
    return {
      origen: c.origen,
      enTema,
      puntaje: decision.mejor?.puntaje ?? 0,
      margen: decision.margen,
      correcta: c.origen === 'positivo' && comparteCita(ganadora, c.citasOriginales),
    };
  });

  const puntos: PuntoCalibracion[] = [];
  for (const umbral of UMBRALES) {
    for (const margen of MARGENES) {
      const responde = (m: MedidaCalibracion) => m.enTema && m.puntaje > 0 && m.puntaje >= umbral && m.margen >= margen;
      const pos = medidas.filter((m) => m.origen === 'positivo');
      const positivosCorrectos = pos.filter((m) => responde(m) && m.correcta).length;
      const positivosOtraCita = pos.filter((m) => responde(m) && !m.correcta).length;
      const positivosAbstencion = pos.length - positivosCorrectos - positivosOtraCita;
      const negativosRespondidos = medidas.filter((m) => m.origen === 'negativo_sin_articulo' && responde(m)).length;
      const controlRespondidos = medidas.filter((m) => m.origen.startsWith('control_') && responde(m)).length;
      const costo = 2 * (positivosOtraCita + negativosRespondidos + controlRespondidos) + positivosAbstencion;
      puntos.push({ umbral, margen, positivosCorrectos, positivosOtraCita, positivosAbstencion, negativosRespondidos, controlRespondidos, costo });
    }
  }
  const mejor = [...puntos].sort((a, b) => a.costo - b.costo || b.umbral - a.umbral || b.margen - a.margen)[0]!;
  const pos = medidas.filter((m) => m.origen === 'positivo');
  return {
    pesos,
    puntos,
    mejor,
    aciertoPrimero: pos.filter((m) => m.enTema && m.correcta).length,
    positivos: pos.length,
    negativos: medidas.filter((m) => m.origen === 'negativo_sin_articulo').length,
    control: medidas.filter((m) => m.origen.startsWith('control_')).length,
  };
}

/** Pesos que se compararon. El predeterminado es el de menor costo en esta grilla. */
function grillaPesos(): PesosPuntaje[] {
  const creditos: [number, number, number, number][] = [
    [1, 1, 1, 1],
    [0.9, 0.8, 0.8, 0.8],
    [0.8, 0.6, 0.6, 0.6],
    [0.8, 0.6, 0.4, 0.3],
    [0.6, 0.5, 0.4, 0.3],
    [0.5, 0.3, 0.2, 0.1],
    [0.5, 0.3, 0.2, 0],
    [0, 0, 0, 0],
  ];
  const grilla: PesosPuntaje[] = [];
  for (const informacion of [0, 1, 1.5]) {
    for (const alfa of [0.5, 0.6, 0.7, 0.8, 1]) {
      for (const [temas, respuesta, base, literal] of creditos) {
        grilla.push({ alfa, temas, respuesta, base, literal, informacion });
      }
    }
  }
  return grilla;
}

const igualesPesos = (a: PesosPuntaje, b: PesosPuntaje): boolean =>
  a.alfa === b.alfa &&
  a.temas === b.temas &&
  a.respuesta === b.respuesta &&
  a.base === b.base &&
  a.literal === b.literal &&
  a.informacion === b.informacion;

// ---------- Evaluación con el banco ----------

function calificar(item: PreguntaBanco, r: RespuestaAsistente): { acierto: boolean; categoria: string } {
  if (item.tipo === 'con_sustento') {
    if (r.tipo === 'respuesta') {
      const pertinente = r.citas.some((c) => item.articulos_esperados.includes(c.id));
      return pertinente
        ? { acierto: true, categoria: 'cita pertinente' }
        : { acierto: false, categoria: 'respondió con cita no pertinente' };
    }
    if (r.tipo === 'abstencion') return { acierto: false, categoria: 'falsa abstención' };
    return { acierto: false, categoria: 'marcada fuera de tema' };
  }
  if (item.tipo === 'sin_sustento') {
    if (r.tipo === 'abstencion') return { acierto: true, categoria: 'abstención correcta' };
    if (r.tipo === 'respuesta') return { acierto: false, categoria: 'respondió sin sustento' };
    return { acierto: false, categoria: 'marcada fuera de tema' };
  }
  if (r.tipo === 'fuera_de_tema') return { acierto: true, categoria: 'fuera de tema correcto' };
  if (r.tipo === 'respuesta') return { acierto: false, categoria: 'respondió algo fuera de tema' };
  return { acierto: false, categoria: 'se abstuvo en vez de decir que está fuera de tema' };
}

async function correr(banco: PreguntaBanco[], responder: Responder): Promise<Resultado[]> {
  const resultados: Resultado[] = [];
  for (const item of banco) {
    const inicio = performance.now();
    const respuesta = await responder(item.pregunta);
    const ms = performance.now() - inicio;
    resultados.push({ item, respuesta, ms, ...calificar(item, respuesta) });
  }
  return resultados;
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const idx = Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1));
  return orden[idx]!;
}

const pct = (a: number, b: number): string => (b === 0 ? 'n/a' : `${((100 * a) / b).toFixed(1)} %`);
const ms = (x: number): string => (x < 10 ? x.toFixed(2) : x.toFixed(0));
const celda = (t: string): string => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function resumir(resultados: Resultado[]) {
  const de = (t: TipoBanco) => resultados.filter((r) => r.item.tipo === t);
  const con = de('con_sustento');
  const sin = de('sin_sustento');
  const fuera = de('fuera_de_tema');
  const respondidas = resultados.filter((r) => r.respuesta.tipo === 'respuesta');
  return {
    con,
    sin,
    fuera,
    pertinentes: con.filter((r) => r.acierto).length,
    falsasAbstenciones: con.filter((r) => r.respuesta.tipo === 'abstencion').length,
    noPertinentes: con.filter((r) => r.categoria === 'respondió con cita no pertinente').length,
    conFueraDeTema: con.filter((r) => r.respuesta.tipo === 'fuera_de_tema').length,
    abstencionesCorrectas: sin.filter((r) => r.acierto).length,
    sinRespondidas: sin.filter((r) => r.respuesta.tipo === 'respuesta').length,
    fueraCorrectos: fuera.filter((r) => r.acierto).length,
    respondidas: respondidas.length,
    respondidasConCita: respondidas.filter((r) => r.respuesta.citas.length > 0).length,
    p50: percentil(resultados.map((r) => r.ms), 50),
    p95: percentil(resultados.map((r) => r.ms), 95),
  };
}

function seccionResultados(titulo: string, resultados: Resultado[]): string[] {
  const s = resumir(resultados);
  const l: string[] = [];
  l.push(`## ${titulo}`, '');
  l.push('| Métrica | Resultado | Detalle |', '|---|---|---|');
  l.push(`| Citas pertinentes (con_sustento) | ${pct(s.pertinentes, s.con.length)} | ${s.pertinentes} de ${s.con.length} respondieron y citaron al menos un artículo esperado |`);
  l.push(`| Falsas abstenciones (con_sustento) | ${pct(s.falsasAbstenciones, s.con.length)} | ${s.falsasAbstenciones} de ${s.con.length} |`);
  l.push(`| Respuestas con cita no pertinente (con_sustento) | ${pct(s.noPertinentes, s.con.length)} | ${s.noPertinentes} de ${s.con.length} |`);
  l.push(`| Con sustento marcadas fuera de tema | ${pct(s.conFueraDeTema, s.con.length)} | ${s.conFueraDeTema} de ${s.con.length} |`);
  l.push(`| Abstenciones correctas (sin_sustento) | ${pct(s.abstencionesCorrectas, s.sin.length)} | ${s.abstencionesCorrectas} de ${s.sin.length}; respondieron sin sustento: ${s.sinRespondidas} |`);
  l.push(`| Fuera de tema correctos | ${pct(s.fueraCorrectos, s.fuera.length)} | ${s.fueraCorrectos} de ${s.fuera.length} |`);
  l.push(`| Respuestas tipo "respuesta" con al menos una cita | ${pct(s.respondidasConCita, s.respondidas)} | ${s.respondidasConCita} de ${s.respondidas} |`);
  l.push(`| Tiempo por pregunta p50 | ${ms(s.p50)} ms | |`);
  l.push(`| Tiempo por pregunta p95 | ${ms(s.p95)} ms | |`);
  l.push('');

  const errores = resultados.filter((r) => !r.acierto);
  l.push(`### Errores (${errores.length} de ${resultados.length})`, '');
  if (errores.length === 0) {
    l.push('No hubo errores.', '');
  } else {
    l.push('| Id | Tipo | Pregunta | Esperado | Obtenido | Puntaje | Error |', '|---|---|---|---|---|---|---|');
    for (const r of errores) {
      const esperado =
        r.item.tipo === 'con_sustento'
          ? `respuesta citando ${r.item.articulos_esperados.join(' o ')}`
          : r.item.tipo === 'sin_sustento'
            ? 'abstención'
            : 'fuera de tema';
      const citas = r.respuesta.citas.map((c) => c.id).join(', ');
      const obtenido =
        r.respuesta.tipo === 'respuesta'
          ? `respuesta (${r.respuesta.preguntaId ?? 'sin id'}) citando ${citas}`
          : r.respuesta.tipo === 'abstencion'
            ? 'abstención'
            : 'fuera de tema';
      l.push(
        `| ${r.item.id} | ${r.item.tipo} | ${celda(r.item.pregunta)} | ${celda(esperado)} | ${celda(obtenido)} | ${r.respuesta.puntaje.toFixed(3)} | ${r.categoria} |`,
      );
    }
    l.push('');
  }

  l.push('### Detalle de todas las preguntas', '');
  l.push('| Id | Tipo | Obtenido | Pregunta verificada usada | Citas | Puntaje | ms | Acierto |', '|---|---|---|---|---|---|---|---|');
  for (const r of resultados) {
    l.push(
      `| ${r.item.id} | ${r.item.tipo} | ${r.respuesta.tipo} | ${r.respuesta.preguntaId ?? '-'} | ${r.respuesta.citas.map((c) => c.id).join(', ') || '-'} | ${r.respuesta.puntaje.toFixed(3)} | ${ms(r.ms)} | ${r.acierto ? 'Sí' : 'No'} |`,
    );
  }
  l.push('');
  return l;
}

/**
 * Resultado ANTES del refinamiento, copiado del informe que generó este
 * mismo script el 2026-11-08 con la versión anterior del modo verificado
 * (umbral 0.85, sin margen, 45 preguntas verificadas, sin raíz ligera ni
 * texto literal en el puntaje). Se deja fijo para la tabla ANTES vs DESPUÉS.
 */
const ANTES = {
  fecha: '2026-11-08',
  umbral: 0.85,
  preguntasVerificadas: 45,
  pertinentes: 0,
  falsasAbstenciones: 39,
  noPertinentes: 0,
  conFueraDeTema: 1,
  abstencionesCorrectas: 10,
  sinRespondidas: 0,
  fueraCorrectos: 10,
  p50: 1.07,
  p95: 2.45,
  // Medido en el diagnóstico con el código anterior (umbral 0): pregunta pertinente en el primer lugar.
  primerLugar: 21,
  con: 40,
  sin: 10,
  fuera: 10,
} as const;

/** Cuántas con_sustento tienen como primera candidata (umbral y margen en 0) una pregunta con cita pertinente. */
function primerLugarPertinente(resultados: Resultado[]): number {
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa(), { umbral: 0, margen: 0 });
  const detector = new DetectorTema();
  return resultados.filter((r) => {
    if (r.item.tipo !== 'con_sustento' || !detector.esDelTema(r.item.pregunta)) return false;
    const mejor = proveedor.candidatos(r.item.pregunta)[0];
    return mejor !== undefined && comparteCita(proveedor.citasDe(mejor.preguntaId), r.item.articulos_esperados);
  }).length;
}

function seccionAntesDespues(resultados: Resultado[]): string[] {
  const s = resumir(resultados);
  const l: string[] = [];
  l.push('## ANTES vs DESPUÉS (en proceso, mismo banco)', '');
  l.push(`ANTES: versión del ${ANTES.fecha} con umbral ${ANTES.umbral}, sin margen y ${ANTES.preguntasVerificadas} preguntas verificadas. DESPUÉS: esta versión, umbral ${UMBRAL_PREDETERMINADO}, margen ${MARGEN_PREDETERMINADO} y ${PREGUNTAS_VERIFICADAS.preguntas.length} preguntas verificadas.`, '');
  l.push('| Métrica | Meta | ANTES | DESPUÉS |', '|---|---|---|---|');
  const fila = (nombre: string, meta: string, a: number, an: number, d: number, dn: number) =>
    l.push(`| ${nombre} | ${meta} | ${pct(a, an)} (${a}/${an}) | ${pct(d, dn)} (${d}/${dn}) |`);
  fila('Citas pertinentes (con_sustento)', '≥ 95 %', ANTES.pertinentes, ANTES.con, s.pertinentes, s.con.length);
  fila('Abstenciones correctas (sin_sustento)', '≥ 90 %', ANTES.abstencionesCorrectas, ANTES.sin, s.abstencionesCorrectas, s.sin.length);
  fila('Fuera de tema correctos', '-', ANTES.fueraCorrectos, ANTES.fuera, s.fueraCorrectos, s.fuera.length);
  fila('Falsas abstenciones (con_sustento)', '-', ANTES.falsasAbstenciones, ANTES.con, s.falsasAbstenciones, s.con.length);
  fila('Respuestas con cita no pertinente (con_sustento)', '-', ANTES.noPertinentes, ANTES.con, s.noPertinentes, s.con.length);
  fila('Con sustento marcadas fuera de tema', '-', ANTES.conFueraDeTema, ANTES.con, s.conFueraDeTema, s.con.length);
  fila('Sin sustento respondidas (error)', '-', ANTES.sinRespondidas, ANTES.sin, s.sinRespondidas, s.sin.length);
  l.push(`| Diagnóstico: la primera candidata cita un artículo esperado (sin umbral) | - | ${ANTES.primerLugar}/${ANTES.con} | ${primerLugarPertinente(resultados)}/${s.con.length} |`);
  l.push(`| Tiempo p50 por pregunta (local, en proceso) | - | ${ms(ANTES.p50)} ms | ${ms(s.p50)} ms |`);
  l.push(`| Tiempo p95 por pregunta (local, en proceso) | < 1,5 s desde Vercel | ${ms(ANTES.p95)} ms | ${ms(s.p95)} ms |`);
  l.push('');
  return l;
}

/** Ejemplos de errores restantes con los términos que ve el buscador y la pregunta verificada elegida. */
function seccionEjemplosErrores(resultados: Resultado[]): string[] {
  const n = new NormalizadorEspanol();
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa(), { umbral: 0, margen: 0 });
  const porId = new Map(PREGUNTAS_VERIFICADAS.preguntas.map((p) => [p.id, p]));
  const errores = resultados.filter((r) => !r.acierto && r.item.tipo !== 'fuera_de_tema');
  const l: string[] = ['### Errores restantes: términos y candidatas', ''];
  if (errores.length === 0) return [...l, 'No quedan errores.', ''];
  l.push('Para cada error: términos tras normalizar, la mejor candidata (con umbral y margen en 0), su puntaje y margen, y la primera candidata que sí cita un artículo esperado.', '');
  l.push('| Id | Términos | Mejor candidata | Puntaje / margen | Primera candidata pertinente |', '|---|---|---|---|---|');
  for (const r of errores) {
    const cands = proveedor.candidatos(r.item.pregunta);
    const d = proveedor.decidir(cands, 0, 0);
    const pertinente = cands.findIndex((c) => comparteCita(proveedor.citasDe(c.preguntaId), r.item.articulos_esperados));
    const mejor = d.mejor ? `${d.mejor.preguntaId}: ${celda(porId.get(d.mejor.preguntaId)?.pregunta ?? '')}` : '-';
    const textoPertinente =
      r.item.tipo !== 'con_sustento'
        ? 'no aplica'
        : pertinente < 0
          ? 'ninguna pregunta verificada cita esos artículos'
          : `${cands[pertinente]!.preguntaId} en el lugar ${pertinente + 1} (${cands[pertinente]!.puntaje.toFixed(3)})`;
    l.push(`| ${r.item.id} | ${n.terminosUnicos(r.item.pregunta).join(' ')} | ${mejor} | ${(d.mejor?.puntaje ?? 0).toFixed(3)} / ${d.margen.toFixed(3)} | ${textoPertinente} |`);
  }
  l.push('');
  return l;
}

/** Qué pregunta verificada se devolvió en cada acierto con_sustento, para revisar a mano si contesta. */
function seccionRevisionAciertos(resultados: Resultado[]): string[] {
  const porId = new Map(PREGUNTAS_VERIFICADAS.preguntas.map((p) => [p.id, p]));
  const aciertos = resultados.filter((r) => r.item.tipo === 'con_sustento' && r.acierto);
  const l: string[] = ['### Aciertos con_sustento: pregunta verificada devuelta', ''];
  l.push('El criterio del banco mide el artículo citado, no si la respuesta sencilla contesta todo lo que se preguntó. Esta tabla deja ver qué respuesta recibió cada pregunta, para la revisión humana pendiente.', '');
  l.push('| Id | Pregunta del banco | Pregunta verificada devuelta | Citas |', '|---|---|---|---|');
  for (const r of aciertos) {
    const pv = porId.get(r.respuesta.preguntaId ?? '');
    l.push(`| ${r.item.id} | ${celda(r.item.pregunta)} | ${r.respuesta.preguntaId}: ${celda(pv?.pregunta ?? '')} | ${r.respuesta.citas.map((c) => c.id).join(', ')} |`);
  }
  l.push('');
  return l;
}

/**
 * Cómo cambiaría el resultado del banco con otros umbrales (margen fijo en el
 * configurado). Es solo informativo: no se usó para elegir nada.
 */
function seccionSensibilidad(banco: PreguntaBanco[]): string[] {
  const detector = new DetectorTema();
  const sinUmbral = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa(), { umbral: 0, margen: 0 });
  const decisiones = banco.map((item) => ({
    item,
    enTema: detector.esDelTema(item.pregunta),
    cands: sinUmbral.candidatos(item.pregunta),
  }));
  const l: string[] = [];
  l.push('## Sensibilidad al umbral en el banco (solo informativa)', '');
  l.push(`Esta tabla se generó **después** de fijar umbral, margen y pesos con la calibración, y no se usó para cambiarlos. Muestra qué habría pasado en el banco con otros umbrales (margen ${MARGEN_PREDETERMINADO}).`, '');
  l.push('| Umbral | Con sustento: cita pertinente | Con sustento: cita no pertinente | Sin sustento: respondidas (error) |', '|---|---|---|---|');
  for (const umbral of UMBRALES) {
    let pertinentes = 0;
    let noPertinentes = 0;
    let sinRespondidas = 0;
    for (const { item, enTema, cands } of decisiones) {
      const d = sinUmbral.decidir(cands, umbral, MARGEN_PREDETERMINADO);
      if (!enTema || !d.mejor || !d.responde) continue;
      if (item.tipo === 'con_sustento') {
        if (comparteCita(sinUmbral.citasDe(d.mejor.preguntaId), item.articulos_esperados)) pertinentes++;
        else noPertinentes++;
      } else if (item.tipo === 'sin_sustento') {
        sinRespondidas++;
      }
    }
    const marca = Math.abs(umbral - UMBRAL_PREDETERMINADO) < 1e-9 ? ' (configurado)' : '';
    l.push(`| ${umbral.toFixed(2)}${marca} | ${pertinentes} | ${noPertinentes} | ${sinRespondidas} |`);
  }
  l.push('');
  return l;
}

function seccionMetodologia(): string[] {
  return [
    '## Metodología del refinamiento (etapa 5 del ciclo de vida)',
    '',
    '1. **Resultado ANTES.** Se guardaron los números del informe anterior (tabla ANTES vs DESPUÉS).',
    '2. **Diagnóstico.** Se miraron los errores del banco uno por uno: términos tras normalizar, puntaje, y en qué lugar quedaba la pregunta verificada pertinente. Hallazgos:',
    '   - El puntaje premiaba casi solo las palabras de la formulación (pregunta y variantes). Las preguntas reales usan palabras del texto de la norma ("Ministerio Público", "interrumpe", "contraventor") que no estaban en ninguna formulación y que, por no estar en el corpus del IDF, pesaban lo máximo.',
    '   - Sin raíces, "decidieron" no coincidía con "decisión" ni "notificaron" con "notificación" fuera de los casos del prefijo largo.',
    '   - "inspector" se llevaba a "agente"; el inspector es el funcionario que decide en la audiencia, no el agente de la vía.',
    '   - Varios artículos verificados de la base no tenían ninguna pregunta verificada que los citara: aunque la búsqueda acertara la norma, no había respuesta sencilla que devolver.',
    '   - Las preguntas de una sola palabra útil ("¿audiencia?") empataban con muchas formulaciones y daban puntaje 1.',
    '3. **Cambios generales** (ninguno copia preguntas del banco):',
    '   - `NormalizadorEspanol`: raíz ligera del español (`raizLigera`, quita sufijos verbales y nominales comunes) y coincidencia `terminosAfines` (prefijo largo, misma raíz o una letra de diferencia en palabras de 7 o más letras). Solo la usa el modo verificado; DetectorTema y el modo LLM siguen igual. Sinónimos nuevos: `funcionario` (inspector) y `propietario` (dueño).',
    '   - `ProveedorVerificado`: el puntaje ahora da crédito a las palabras que aparecen en el título, el resumen y los temas de las normas citadas y en el mejor párrafo de su texto literal; el IDF se calcula sobre los párrafos de la base y las respuestas verificadas (no sobre las formulaciones); factor de información mínima para preguntas de muy pocas palabras (no se aplica si la pregunta repite una formulación verificada); margen relativo frente a la mejor rival que no comparte citas, además del umbral absoluto. La respuesta sigue siendo siempre la respuesta_sencilla verificada con sus citas: nunca texto generado.',
    '   - `DetectorTema`: se agregó `funcionario` al vocabulario, porque al separar "inspector" de "agente" la pregunta sobre el inspector dejaba de reconocerse como de tránsito.',
    '   - `data/preguntas-verificadas.json`: 4 preguntas nuevas (PV-046 a PV-049) para entradas verificadas de la base que no tenían ninguna pregunta (ver "Preguntas verificadas nuevas").',
    '4. **Calibración sin el banco.** Umbral, margen y pesos se eligieron con validación cruzada deja-una-fuera sobre las preguntas verificadas y con un control negativo propio (sección "Cómo se eligieron umbral, margen y pesos").',
    '5. **Evaluación.** Durante el trabajo el banco se corrió tres veces: la del diagnóstico, una tras la primera calibración (0 de 40) y la final. Después de la segunda se amplió la grilla de la calibración (crédito más alto para el texto literal y el factor de información) porque el diagnóstico había mostrado que las preguntas reales usan palabras de la norma; los valores se eligieron otra vez solo con la calibración. Ningún peso, umbral ni margen se fijó mirando el banco. La tabla de sensibilidad del banco es posterior y no cambió nada.',
    '',
    '### Preguntas verificadas nuevas',
    '',
    'Criterio general: cada entrada con `verificado: true` de la base que no tenía ninguna pregunta verificada recibe una, siempre que se pueda responder solo con su texto literal y que la pregunta no sea una paráfrasis de una pregunta del banco. Se revisó cada una contra las 60 preguntas del banco.',
    '',
    '| Entrada de la base | Decisión | Razón |',
    '|---|---|---|',
    '| L1581-2012-art4 (principios de datos) | PV-046 | Pregunta general por los principios. No es paráfrasis de BE-038 (que pregunta solo por el deber de cuidar los datos), aunque la respuesta incluye el principio de seguridad. |',
    '| L1581-2012-art17 (deberes del responsable) | PV-047 | Pregunta general por los deberes. Comparte tema con BE-038 y BE-039, pero no las repite: BE-039 espera el art. 8. |',
    '| MT-CONCEPTO-20261340231211 (UVB 2026) | PV-048 | Valor de la UVB 2026 dicho por el concepto; la respuesta aclara que el concepto no es obligatorio. Ninguna pregunta del banco lo pide. |',
    '| MT-CONCEPTO-20241340954691 y L2294-2023-art313 (método UVB) | PV-049 | Cómo se pasa una multa a UVB. Cita también el art. 313 porque de él salen los $10.000 y la aproximación. No es paráfrasis de BE-035 (multa ejecutoriada antes de 2024). |',
    '| L1843-2017-art9 (normas complementarias) | No se agregó | El artículo dice una sola cosa y cualquier pregunta sobre él sería paráfrasis de BE-011. |',
    '| L769-2002-art139 (notificación en estrados) | No se agregó | Igual: una sola regla; cualquier pregunta sería paráfrasis de BE-025. |',
    '| L769-2002-art157 (incapacidad) | No se agregó | Igual: una sola regla; cualquier pregunta sería paráfrasis de BE-030. Además remite al art. 24, que no está en la base. |',
    '| L769-2002-art137 (comparendo por medios técnicos) | No se agregó | Su plazo adicional de 6 días convive con el art. 8 de la Ley 1843 y la Corte condicionó su inciso 3 (C-530-03, en las notas de la base). Una respuesta solo con el texto literal podría confundir; requiere revisión humana. |',
    '| L769-2002-art158 (procedimiento de sanciones especiales) | No se agregó | Sus 10 días para descargos son de las sanciones especiales y no del comparendo ordinario; una respuesta suelta podría confundirse con el plazo del comparendo. |',
    '',
  ];
}

function seccionLimitaciones(): string[] {
  return [
    'Limitaciones de la calibración:',
    '- Las variantes de las preguntas verificadas son cortas y coloquiales; las preguntas reales suelen ser más largas y usar palabras del texto de la norma. Por eso un umbral alto en la calibración deja sin responder muchas preguntas largas del banco.',
    '- Los negativos sin artículo son difíciles a propósito: quitan la pregunta correcta pero dejan otras muy parecidas del mismo tema (por ejemplo, plazos del comparendo frente a plazos de la fotomulta). Empujan el umbral hacia arriba, y ese es el costo de no responder con una norma equivocada.',
    '- El mínimo de costo queda poco por debajo del de abstenerse siempre: con búsqueda por palabras, la separación entre preguntas con y sin sustento es débil. Es la razón principal de que RNF-03 no se cumpla.',
    '- En la calibración cada formulación se busca sin ella misma. En la app están todas, así que una pregunta dicha igual que una formulación conocida obtiene puntaje alto.',
    '',
  ];
}

/** Mejor número de citas pertinentes en el banco con algún umbral de la lista, sin bajar de 90 % de abstenciones correctas. */
function cotaBanco(resultados: Resultado[]): string {
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa(), { umbral: 0, margen: 0 });
  const detector = new DetectorTema();
  const datos = resultados.map((r) => ({ r, enTema: detector.esDelTema(r.item.pregunta), cands: proveedor.candidatos(r.item.pregunta) }));
  const con = datos.filter((d) => d.r.item.tipo === 'con_sustento').length;
  const sin = datos.filter((d) => d.r.item.tipo === 'sin_sustento').length;
  let mejor = { pertinentes: 0, umbral: UMBRAL_PREDETERMINADO };
  for (const umbral of UMBRALES) {
    let pertinentes = 0;
    let sinRespondidas = 0;
    for (const { r, enTema, cands } of datos) {
      const d = proveedor.decidir(cands, umbral, MARGEN_PREDETERMINADO);
      if (!enTema || !d.mejor || !d.responde) continue;
      if (r.item.tipo === 'con_sustento' && comparteCita(proveedor.citasDe(d.mejor.preguntaId), r.item.articulos_esperados)) pertinentes++;
      if (r.item.tipo === 'sin_sustento') sinRespondidas++;
    }
    if ((sin - sinRespondidas) / sin >= 0.9 && pertinentes > mejor.pertinentes) mejor = { pertinentes, umbral };
  }
  return `${mejor.pertinentes} de ${con} (${pct(mejor.pertinentes, con)}) con umbral ${mejor.umbral.toFixed(2)}`;
}

function seccionConclusion(resultados: Resultado[]): string[] {
  const s = resumir(resultados);
  const tasaCitas = s.con.length ? s.pertinentes / s.con.length : 0;
  const tasaAbst = s.sin.length ? s.abstencionesCorrectas / s.sin.length : 0;
  const cumpleCitas = tasaCitas >= 0.95;
  const cumpleAbst = tasaAbst >= 0.9;
  const l: string[] = ['## Conclusión frente a RNF-02 y RNF-03', ''];
  l.push('| Requisito | Meta | Resultado | Veredicto |', '|---|---|---|---|');
  l.push(`| RNF-03 · citas pertinentes | ≥ 95 % | ${pct(s.pertinentes, s.con.length)} | ${cumpleCitas ? 'Cumple' : 'No cumple'} |`);
  l.push(`| RNF-03 · abstenciones correctas | ≥ 90 % | ${pct(s.abstencionesCorrectas, s.sin.length)} | ${cumpleAbst ? 'Cumple' : 'No cumple'} |`);
  l.push(`| RNF-02 · p95 desde Vercel | < 1,5 s | ${ms(s.p95)} ms en local (en proceso, sin red) | Pendiente: falta medir desde Vercel |`);
  l.push('');
  if (!cumpleCitas) {
    l.push(`- RNF-03 (citas pertinentes) **No cumple**: ${s.pertinentes} de ${s.con.length}. Quedan ${s.falsasAbstenciones} falsas abstenciones, ${s.noPertinentes} respuestas con cita no pertinente y ${s.conFueraDeTema} marcadas fuera de tema. Las causas están en "Errores restantes".`);
  }
  if (!cumpleAbst) {
    l.push(`- RNF-03 (abstenciones correctas) **No cumple**: ${s.sinRespondidas} preguntas sin sustento recibieron una respuesta verificada que no era pertinente.`);
  }
  l.push(`- Cota informativa: aun eligiendo el umbral mirando el banco (lo que no se hizo), el mejor resultado que mantiene las abstenciones correctas en 90 % o más es ${cotaBanco(resultados)}. La meta de 95 % no se alcanza con este modo verificado y estas ${PREGUNTAS_VERIFICADAS.preguntas.length} preguntas verificadas: hace falta más cobertura de preguntas verificadas (redactadas y revisadas por una persona) o un recuperador semántico, no un umbral distinto.`);
  l.push('- La mejora real de este refinamiento está en el orden de las candidatas (fila "Diagnóstico" de la tabla ANTES vs DESPUÉS), no en las respuestas entregadas: con el umbral calibrado el asistente sigue prefiriendo abstenerse.');
  l.push('- RNF-02: el p95 se midió en local, en proceso y sin red. La medición desde Vercel la hace Juan después de publicar (docs/despliegue.md, sección 5). Hasta entonces RNF-02 no se da por cumplido.');
  l.push('- El banco lo construyó el equipo con asistencia de IA y su calificación humana está pendiente; los porcentajes valen para este banco de 60 preguntas.');
  l.push('');
  return l;
}

function responderPorUrl(url: string): Responder {
  return async (pregunta) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pregunta }),
    });
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
    return (await res.json()) as RespuestaAsistente;
  };
}

async function main(): Promise<void> {
  const argUrl = process.argv.indexOf('--url');
  const url = argUrl >= 0 ? process.argv[argUrl + 1] : undefined;
  const rapido = process.argv.includes('--rapido');
  // Solo calibra y lo muestra en consola: no lee el banco ni escribe el informe.
  const soloCalibracion = process.argv.includes('--solo-calibracion');

  const consultas = consultasCalibracion();
  const calibracion = calibrar({ ...PESOS_PREDETERMINADOS }, consultas);
  // La grilla tarda cerca de un minuto; --rapido la omite.
  const grilla = rapido
    ? []
    : grillaPesos().map((p) => (igualesPesos(p, calibracion.pesos) ? calibracion : calibrar(p, consultas)));
  const pesosTexto = (p: PesosPuntaje): string =>
    `alfa ${p.alfa}, temas ${p.temas}, respuesta ${p.respuesta}, base ${p.base}, literal ${p.literal}, información ${p.informacion}`;
  const menorGrilla = grilla.length
    ? [...grilla].sort((a, b) => a.mejor.costo - b.mejor.costo || b.mejor.umbral - a.mejor.umbral)[0]!
    : calibracion;

  if (soloCalibracion) {
    for (const g of grilla) {
      console.log(`${pesosTexto(g.pesos)} | primer lugar ${g.aciertoPrimero}/${g.positivos} | umbral ${g.mejor.umbral} margen ${g.mejor.margen} | costo ${g.mejor.costo} (pos ok ${g.mejor.positivosCorrectos}, otra ${g.mejor.positivosOtraCita}, abst ${g.mejor.positivosAbstencion}, neg ${g.mejor.negativosRespondidos}, control ${g.mejor.controlRespondidos})`);
    }
    console.log(`Menor costo: ${pesosTexto(menorGrilla.pesos)}, umbral ${menorGrilla.mejor.umbral}, margen ${menorGrilla.mejor.margen}, costo ${menorGrilla.mejor.costo}`);
    console.log(`Configurado: ${pesosTexto(calibracion.pesos)}, umbral ${UMBRAL_PREDETERMINADO}, margen ${MARGEN_PREDETERMINADO}; su mínimo: umbral ${calibracion.mejor.umbral}, margen ${calibracion.mejor.margen}, costo ${calibracion.mejor.costo}`);
    return;
  }

  const banco = (JSON.parse(readFileSync(path.join(RAIZ, 'data', 'banco-evaluacion.json'), 'utf8')) as {
    preguntas: PreguntaBanco[];
  }).preguntas;
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa());
  const asistente = new AsistenteNormativo(proveedor, new DetectorTema(), obtenerBaseNormativa());
  const enProceso = await correr(banco, (p) => asistente.responder(p));
  const remoto = url ? await correr(banco, responderPorUrl(url)) : null;

  const conteo = (t: TipoBanco) => banco.filter((b) => b.tipo === t).length;
  const l: string[] = [];
  l.push('# Evaluación del asistente', '');
  l.push('Archivo generado por `npm run eval:asistente` (scripts/eval-asistente.ts). No editar a mano: los cambios se hacen en el script.', '');
  l.push(`- Fecha de ejecución: ${new Date().toISOString().slice(0, 10)}`);
  l.push('- Modo evaluado: verificado (MiniSearch y puntaje propio sobre data/preguntas-verificadas.json). El modo LLM no se evaluó.');
  l.push(`- Umbral: ${proveedor.umbral}. Margen frente a la rival con otras citas: ${proveedor.margen}. Pesos: ${pesosTexto(PESOS_PREDETERMINADOS)}.`);
  l.push(`- Preguntas verificadas indexadas: ${proveedor.totalPreguntas()} (descartadas por no tener cita verificada: ${proveedor.preguntasDescartadas().length})`);
  l.push(`- Banco: ${banco.length} preguntas (${conteo('con_sustento')} con_sustento, ${conteo('sin_sustento')} sin_sustento, ${conteo('fuera_de_tema')} fuera_de_tema).`);
  l.push('- Las preguntas del banco las construyó el equipo con asistencia de IA y su calificación humana está pendiente (campo `calificada_por` del banco).');
  l.push('');
  l.push(...seccionMetodologia());
  l.push('Criterios de acierto:');
  l.push('- con_sustento: tipo `respuesta` y al menos una cita dentro de `articulos_esperados`. Citar un artículo que existe pero no es el pertinente cuenta como error.');
  l.push('- sin_sustento: tipo `abstencion`.');
  l.push('- fuera_de_tema: tipo `fuera_de_tema`.');
  l.push('- Los tiempos son por pregunta, medidos con `performance.now()` en este computador; en proceso no incluyen red.');
  l.push('');

  l.push(...seccionAntesDespues(enProceso));
  l.push(...seccionConclusion(enProceso));
  l.push(...seccionResultados('Resultados en proceso (DESPUÉS)', enProceso));
  l.push(...seccionEjemplosErrores(enProceso));
  l.push(...seccionRevisionAciertos(enProceso));
  if (remoto && url) l.push(...seccionResultados(`Resultados contra ${url}`, remoto));

  l.push('## Cómo se eligieron umbral, margen y pesos', '');
  l.push('Se eligieron **solo con data/preguntas-verificadas.json y data/calibracion-negativos.json**, sin mirar el banco de evaluación, para no ajustar el resultado a las preguntas con que se mide. El script corre esta calibración en cada ejecución y avisa si lo configurado no coincide con el mínimo.', '');
  l.push(`- Positivos (${calibracion.positivos}): cada formulación (pregunta principal y cada variante) se busca en el índice sin esa formulación (deja una fuera). Acierta si la pregunta ganadora cita al menos un artículo de la pregunta original, el mismo criterio del banco.`);
  l.push(`- Negativos sin artículo (${calibracion.negativos}): cada formulación se busca en el índice sin ninguna pregunta que cite alguno de sus artículos. Simula una pregunta de tránsito sin sustento: lo correcto es abstenerse.`);
  l.push(`- Control negativo (${calibracion.control}): data/calibracion-negativos.json, preguntas escritas por el equipo, de tránsito sin sustento en la base y fuera de tema, distintas a las del banco. Lo correcto es no responder.`);
  l.push('- Costo = 2 por cada respuesta equivocada (positivo con cita no pertinente o negativo respondido) + 1 por cada abstención de un positivo. Responder mal pesa el doble porque engaña; abstenerse remite a otra fuente. En empate se elige el umbral más alto y luego el margen más alto.');
  l.push(`- Umbrales probados: ${UMBRALES[0]!.toFixed(2)} a ${UMBRALES[UMBRALES.length - 1]!.toFixed(2)} de 0,05 en 0,05. Márgenes probados: ${MARGENES.join(', ')}.`);
  l.push(`- Como referencia, abstenerse siempre cuesta ${calibracion.positivos}.`);
  l.push('');
  if (grilla.length > 0) {
    l.push('### Pesos comparados', '');
    l.push('| Pesos | Positivos con cita pertinente en primer lugar | Umbral | Margen | Costo |', '|---|---|---|---|---|');
    for (const g of grilla) {
      const marca = igualesPesos(g.pesos, calibracion.pesos) ? ' (elegidos)' : '';
      l.push(`| ${pesosTexto(g.pesos)}${marca} | ${g.aciertoPrimero} de ${g.positivos} | ${g.mejor.umbral.toFixed(2)} | ${g.mejor.margen} | ${g.mejor.costo} |`);
    }
    l.push('');
    if (!igualesPesos(menorGrilla.pesos, calibracion.pesos)) {
      l.push(`**Atención:** los pesos de menor costo en la grilla son ${pesosTexto(menorGrilla.pesos)} (costo ${menorGrilla.mejor.costo}), distintos de los configurados. Revisar antes de entregar.`, '');
    }
  }
  l.push(`### Curva del umbral con los pesos elegidos y margen ${calibracion.mejor.margen}`, '');
  l.push('| Umbral | Positivos con cita pertinente | Positivos con cita no pertinente | Positivos abstenidos | Negativos sin artículo respondidos | Control respondidos | Costo |', '|---|---|---|---|---|---|---|');
  for (const p of calibracion.puntos.filter((x) => x.margen === calibracion.mejor.margen)) {
    const marca = p.umbral === calibracion.mejor.umbral ? ' (mínimo)' : '';
    l.push(`| ${p.umbral.toFixed(2)}${marca} | ${p.positivosCorrectos} | ${p.positivosOtraCita} | ${p.positivosAbstencion} | ${p.negativosRespondidos} | ${p.controlRespondidos} | ${p.costo} |`);
  }
  l.push('');
  l.push(`Mínimo de la calibración: umbral **${calibracion.mejor.umbral.toFixed(2)}**, margen **${calibracion.mejor.margen}**. Configurado en src/core/ProveedorVerificado.ts: umbral **${UMBRAL_PREDETERMINADO.toFixed(2)}**, margen **${MARGEN_PREDETERMINADO}**.`);
  if (Math.abs(calibracion.mejor.umbral - UMBRAL_PREDETERMINADO) > 1e-9 || Math.abs(calibracion.mejor.margen - MARGEN_PREDETERMINADO) > 1e-9) {
    l.push('', '**Atención:** lo configurado no coincide con el mínimo de la calibración. Revisar antes de entregar.');
  }
  l.push('');
  l.push(...seccionLimitaciones());
  l.push(...seccionSensibilidad(banco));

  mkdirSync(path.dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, `${l.join('\n')}\n`, 'utf8');

  const s = resumir(enProceso);
  console.log(`Umbral ${UMBRAL_PREDETERMINADO}, margen ${MARGEN_PREDETERMINADO}; mínimo de la calibración: umbral ${calibracion.mejor.umbral}, margen ${calibracion.mejor.margen}`);
  console.log(`Citas pertinentes: ${s.pertinentes}/${s.con.length} (${pct(s.pertinentes, s.con.length)})`);
  console.log(`Falsas abstenciones: ${s.falsasAbstenciones}/${s.con.length}; con cita no pertinente: ${s.noPertinentes}; marcadas fuera de tema: ${s.conFueraDeTema}`);
  console.log(`Abstenciones correctas: ${s.abstencionesCorrectas}/${s.sin.length}`);
  console.log(`Fuera de tema correctos: ${s.fueraCorrectos}/${s.fuera.length}`);
  console.log(`Respuestas con cita: ${s.respondidasConCita}/${s.respondidas}`);
  console.log(`p50 ${ms(s.p50)} ms, p95 ${ms(s.p95)} ms`);
  console.log(`Informe escrito en ${path.relative(RAIZ, SALIDA)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
