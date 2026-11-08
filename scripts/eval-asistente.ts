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
import type { RespuestaAsistente } from '../src/core/ProveedorRespuesta';
import {
  PESOS_PREDETERMINADOS,
  ProveedorVerificado,
  UMBRAL_PREDETERMINADO,
  type PesosPuntaje,
  type PreguntasVerificadasJSON,
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

// ---------- Calibración del umbral (solo preguntas verificadas) ----------

interface PuntoCalibracion {
  umbral: number;
  positivosCorrectos: number;
  positivosOtraPregunta: number;
  positivosAbstencion: number;
  negativosRespondidos: number;
  costo: number;
}

interface Calibracion {
  pesos: PesosPuntaje;
  puntos: PuntoCalibracion[];
  mejor: PuntoCalibracion;
  aciertoPrimero: number;
  positivos: number;
  negativos: number;
}

const comparteCita = (a: readonly string[], b: readonly string[]): boolean => a.some((c) => b.includes(c));

/**
 * Dos pruebas con las preguntas verificadas, juzgadas con el mismo criterio
 * del banco (la cita es del artículo pertinente):
 * - Positivos: cada variante se busca en un índice al que se le quitó esa
 *   variante. Acierta si la pregunta ganadora cita al menos un artículo de
 *   la pregunta original.
 * - Negativos: cada variante se busca en un índice al que se le quitaron
 *   todas las preguntas que citan alguno de sus artículos. Simula una pregunta
 *   de tránsito sin sustento en la base: lo correcto es abstenerse, porque
 *   cualquier respuesta citaría un artículo no pertinente.
 * Costo = 2 por cada respuesta equivocada (negativo respondido o positivo con
 * cita no pertinente) + 1 por cada abstención de un positivo. Responder mal
 * pesa el doble porque engaña; abstenerse remite a otra fuente. Si dos
 * umbrales empatan, se elige el más alto.
 */
function calibrar(pesos: PesosPuntaje): Calibracion {
  const base = obtenerBaseNormativa();
  const original = PREGUNTAS_VERIFICADAS;
  const positivos: { correcta: boolean; puntaje: number }[] = [];
  const negativos: number[] = [];

  for (const p of original.preguntas) {
    const sinArticulo: PreguntasVerificadasJSON = {
      preguntas: original.preguntas.filter((x) => !comparteCita(x.citas, p.citas)),
    };
    const proveedorSinArticulo = new ProveedorVerificado(sinArticulo, base, { umbral: 0, pesos });
    p.variantes.forEach((variante, i) => {
      const sinVariante: PreguntasVerificadasJSON = {
        preguntas: original.preguntas.map((x) =>
          x.id === p.id ? { ...x, variantes: x.variantes.filter((_, j) => j !== i) } : x,
        ),
      };
      const mejorPos = new ProveedorVerificado(sinVariante, base, { umbral: 0, pesos }).candidatos(variante)[0];
      const ganadora = original.preguntas.find((x) => x.id === mejorPos?.preguntaId);
      positivos.push({
        correcta: ganadora !== undefined && comparteCita(ganadora.citas, p.citas),
        puntaje: mejorPos?.puntaje ?? 0,
      });
      negativos.push(proveedorSinArticulo.candidatos(variante)[0]?.puntaje ?? 0);
    });
  }

  const puntos: PuntoCalibracion[] = [];
  for (let u = 30; u <= 95; u += 5) {
    const umbral = u / 100;
    const positivosCorrectos = positivos.filter((x) => x.correcta && x.puntaje >= umbral).length;
    const positivosOtraPregunta = positivos.filter((x) => !x.correcta && x.puntaje >= umbral).length;
    const positivosAbstencion = positivos.filter((x) => x.puntaje < umbral).length;
    const negativosRespondidos = negativos.filter((x) => x >= umbral).length;
    const costo = 2 * (positivosOtraPregunta + negativosRespondidos) + positivosAbstencion;
    puntos.push({ umbral, positivosCorrectos, positivosOtraPregunta, positivosAbstencion, negativosRespondidos, costo });
  }
  const mejor = [...puntos].sort((a, b) => a.costo - b.costo || b.umbral - a.umbral)[0]!;
  return {
    pesos,
    puntos,
    mejor,
    aciertoPrimero: positivos.filter((x) => x.correcta).length,
    positivos: positivos.length,
    negativos: negativos.length,
  };
}

/** Pesos que se compararon. El predeterminado se eligió por menor costo en esta grilla. */
function grillaPesos(): PesosPuntaje[] {
  const creditos: [number, number, number][] = [
    [0.8, 0.6, 0.4],
    [0.5, 0.3, 0.2],
    [0, 0, 0],
  ];
  const grilla: PesosPuntaje[] = [];
  for (const alfa of [0.5, 0.6, 0.7, 0.8, 1]) {
    for (const [temas, respuesta, base] of creditos) grilla.push({ alfa, temas, respuesta, base });
  }
  return grilla;
}

const igualesPesos = (a: PesosPuntaje, b: PesosPuntaje): boolean =>
  a.alfa === b.alfa && a.temas === b.temas && a.respuesta === b.respuesta && a.base === b.base;

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

function seccionLectura(resultados: Resultado[]): string[] {
  const con = resultados.filter((r) => r.item.tipo === 'con_sustento');
  const maximo = Math.max(0, ...con.map((r) => r.respuesta.puntaje));
  return [
    '## Lectura de los resultados',
    '',
    '- El modo verificado solo responde cuando la pregunta se parece mucho a una pregunta verificada o a una de sus variantes; en los demás casos se abstiene. Por diseño nunca devuelve un texto que no sea una respuesta sencilla verificada.',
    `- Las preguntas con_sustento del banco se escribieron distintas a propósito a las preguntas verificadas y a sus variantes, y varias tratan fragmentos de la base que ninguna pregunta verificada responde. El puntaje más alto que obtuvo una de ellas fue ${maximo.toFixed(3)}, frente al umbral de ${UMBRAL_PREDETERMINADO}.`,
    '- Por eso las falsas abstenciones son el error dominante. Es el error menos dañino (remite a otra fuente), pero es un incumplimiento real de la meta de respuesta y así se reporta.',
    '',
  ];
}

/**
 * Cómo cambiaría el resultado del banco con otros umbrales. Es solo
 * informativo: el umbral no se elige con esta tabla (ver la calibración).
 */
function seccionSensibilidad(banco: PreguntaBanco[]): string[] {
  const detector = new DetectorTema();
  const sinUmbral = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa(), { umbral: 0 });
  const citasDe = new Map(PREGUNTAS_VERIFICADAS.preguntas.map((p) => [p.id, p.citas]));
  const mejores = banco.map((item) => ({
    item,
    enTema: detector.esDelTema(item.pregunta),
    mejor: sinUmbral.candidatos(item.pregunta)[0],
  }));
  const l: string[] = [];
  l.push('## Sensibilidad al umbral (solo informativa)', '');
  l.push('Esta tabla **no** se usó para elegir el umbral. Muestra qué habría pasado en el banco con otros umbrales, para que se vea el costo de la prudencia.', '');
  l.push('| Umbral | Con sustento: cita pertinente | Con sustento: cita no pertinente | Sin sustento: respondidas (error) |', '|---|---|---|---|');
  for (let u = 30; u <= 95; u += 5) {
    const umbral = u / 100;
    let pertinentes = 0;
    let noPertinentes = 0;
    let sinRespondidas = 0;
    for (const { item, enTema, mejor } of mejores) {
      if (!enTema || !mejor || mejor.puntaje < umbral) continue;
      if (item.tipo === 'con_sustento') {
        const citas = citasDe.get(mejor.preguntaId) ?? [];
        if (citas.some((c) => item.articulos_esperados.includes(c))) pertinentes++;
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

  const banco = (JSON.parse(readFileSync(path.join(RAIZ, 'data', 'banco-evaluacion.json'), 'utf8')) as {
    preguntas: PreguntaBanco[];
  }).preguntas;

  const rapido = process.argv.includes('--rapido');
  const calibracion = calibrar({ ...PESOS_PREDETERMINADOS });
  // La grilla tarda cerca de dos minutos; --rapido la omite.
  const grilla = rapido ? [] : grillaPesos().map((p) => (igualesPesos(p, calibracion.pesos) ? calibracion : calibrar(p)));
  const proveedor = new ProveedorVerificado(PREGUNTAS_VERIFICADAS, obtenerBaseNormativa());
  const asistente = new AsistenteNormativo(proveedor, new DetectorTema(), obtenerBaseNormativa());
  const enProceso = await correr(banco, (p) => asistente.responder(p));
  const remoto = url ? await correr(banco, responderPorUrl(url)) : null;

  const conteo = (t: TipoBanco) => banco.filter((b) => b.tipo === t).length;
  const l: string[] = [];
  l.push('# Evaluación del asistente', '');
  l.push('Archivo generado por `npm run eval:asistente` (scripts/eval-asistente.ts). No editar a mano.', '');
  l.push(`- Fecha de ejecución: ${new Date().toISOString().slice(0, 10)}`);
  l.push(`- Modo evaluado: verificado (MiniSearch sobre data/preguntas-verificadas.json). El modo LLM no se evaluó.`);
  l.push(`- Umbral usado: ${proveedor.umbral}`);
  l.push(`- Preguntas verificadas indexadas: ${proveedor.totalPreguntas()} (descartadas por no tener cita verificada: ${proveedor.preguntasDescartadas().length})`);
  l.push(`- Banco: ${banco.length} preguntas (${conteo('con_sustento')} con_sustento, ${conteo('sin_sustento')} sin_sustento, ${conteo('fuera_de_tema')} fuera_de_tema).`);
  l.push('- Las preguntas del banco las construyó el equipo con asistencia de IA y su calificación humana está pendiente (campo `calificada_por` del banco).');
  l.push('');
  l.push('Criterios de acierto:');
  l.push('- con_sustento: tipo `respuesta` y al menos una cita dentro de `articulos_esperados`. Citar un artículo que existe pero no es el pertinente cuenta como error.');
  l.push('- sin_sustento: tipo `abstencion`.');
  l.push('- fuera_de_tema: tipo `fuera_de_tema`.');
  l.push('- Los tiempos son por pregunta, medidos con `performance.now()`; en proceso no incluyen red.');
  l.push('');

  l.push(...seccionResultados('Resultados en proceso', enProceso));
  l.push(...seccionLectura(enProceso));
  l.push(...seccionSensibilidad(banco));
  if (remoto && url) l.push(...seccionResultados(`Resultados contra ${url}`, remoto));

  const pesosTexto = (p: PesosPuntaje): string =>
    `alfa ${p.alfa}, temas ${p.temas}, respuesta ${p.respuesta}, base ${p.base}`;
  l.push('## Cómo se eligió el umbral', '');
  l.push('El umbral y los pesos se eligieron **solo con data/preguntas-verificadas.json**, sin mirar el banco de evaluación, para no ajustar el resultado a las preguntas con que se mide.', '');
  l.push('Puntaje de una pregunta verificada: el mejor entre su pregunta y sus variantes. Para cada formulación se mide, con pesos IDF, qué parte de las palabras del usuario aparece en ella (con crédito parcial si solo aparece en los temas, la respuesta sencilla o el título y resumen de las normas citadas) y qué parte de las palabras de la formulación dijo el usuario. Puntaje = cobertura_usuario^alfa × cobertura_formulación^(1 − alfa). Va de 0 a 1.', '');
  l.push(`- Positivos (${calibracion.positivos}): cada variante se busca en un índice sin esa variante. Acierta si la pregunta ganadora cita al menos un artículo de la pregunta original (el mismo criterio del banco).`);
  l.push(`- Negativos (${calibracion.negativos}): cada variante se busca en un índice sin ninguna pregunta que cite sus artículos. Simula una pregunta de tránsito sin sustento: lo correcto es abstenerse.`);
  l.push('- Costo = 2 por cada respuesta equivocada (negativo respondido o positivo con cita no pertinente) + 1 por cada abstención de un positivo. Responder mal pesa el doble porque engaña; abstenerse remite a otra fuente. Si dos umbrales empatan, se elige el más alto.');
  l.push(`- Como referencia, abstenerse siempre cuesta ${calibracion.positivos}.`);
  l.push('');
  if (grilla.length > 0) {
    l.push('### Pesos comparados', '');
    l.push('| Pesos | Positivos con cita pertinente en primer lugar | Umbral de menor costo | Costo |', '|---|---|---|---|');
    for (const g of grilla) {
      const marca = igualesPesos(g.pesos, calibracion.pesos) ? ' (elegidos)' : '';
      l.push(`| ${pesosTexto(g.pesos)}${marca} | ${g.aciertoPrimero} de ${g.positivos} | ${g.mejor.umbral.toFixed(2)} | ${g.mejor.costo} |`);
    }
    l.push('');
    const menor = [...grilla].sort((a, b) => a.mejor.costo - b.mejor.costo)[0]!;
    if (menor.mejor.costo < calibracion.mejor.costo) {
      l.push(`Nota: los pesos de menor costo en la grilla son ${pesosTexto(menor.pesos)} (costo ${menor.mejor.costo}). Se conservaron los elegidos porque la diferencia es de ${calibracion.mejor.costo - menor.mejor.costo} y con ellos la base normativa sí aporta al puntaje.`, '');
    }
  }
  l.push(`### Curva del umbral con los pesos elegidos (${pesosTexto(calibracion.pesos)})`, '');
  l.push('| Umbral | Positivos con cita pertinente | Positivos con cita no pertinente | Positivos abstenidos | Negativos respondidos | Costo |', '|---|---|---|---|---|---|');
  for (const p of calibracion.puntos) {
    const marca = p.umbral === calibracion.mejor.umbral ? ' (mínimo)' : '';
    l.push(`| ${p.umbral.toFixed(2)}${marca} | ${p.positivosCorrectos} | ${p.positivosOtraPregunta} | ${p.positivosAbstencion} | ${p.negativosRespondidos} | ${p.costo} |`);
  }
  l.push('');
  l.push(`Umbral de menor costo: **${calibracion.mejor.umbral.toFixed(2)}**. Umbral configurado en src/core/ProveedorVerificado.ts (UMBRAL_PREDETERMINADO): **${UMBRAL_PREDETERMINADO.toFixed(2)}**.`);
  if (Math.abs(calibracion.mejor.umbral - UMBRAL_PREDETERMINADO) > 1e-9) {
    l.push('', '**Atención:** el umbral configurado no coincide con el de menor costo de la calibración. Revisar antes de entregar.');
  }
  l.push('');
  l.push('Limitaciones:');
  l.push('- El costo mínimo queda poco por debajo del de abstenerse siempre: con búsqueda por palabras, muchas variantes de una misma pregunta comparten pocas palabras entre sí. El umbral alto hace que el asistente prefiera abstenerse a responder con un artículo que no es el pertinente.');
  l.push('- En la calibración cada variante se busca sin ella misma. En la app están todas, así que una pregunta dicha igual que una variante conocida obtiene puntaje 1.');
  l.push('');

  mkdirSync(path.dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, `${l.join('\n')}\n`, 'utf8');

  const s = resumir(enProceso);
  console.log(`Umbral configurado ${UMBRAL_PREDETERMINADO}; umbral de menor costo en la calibración ${calibracion.mejor.umbral}`);
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
