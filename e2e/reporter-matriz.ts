/**
 * Reporter de Playwright que arma la matriz de evaluación por criterio de aceptación.
 *
 * - Lee los criterios y su "Resultado esperado" de docs/historias-usuario.md.
 * - Acumula el último resultado por id en docs/evaluacion/resultados-e2e.json, porque las suites se corren por separado.
 * - Escribe docs/evaluacion/matriz-criterios.md a partir de ese acumulado.
 *
 * Una prueba cuenta para un criterio si su título empieza por el id: test('CA-09.2 resalta ...').
 * Anotaciones opcionales en la prueba: test.info().annotations.push({ type: 'observado' | 'observacion', description }).
 * Con { type: 'parcial', description } una prueba que pasa queda como "Cumple parcialmente": se usa cuando la prueba
 * comprueba lo que la app hace, pero eso no es todo lo que pide el criterio (la descripcion explica que falta).
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '..');
const RUTA_HISTORIAS = path.join(RAIZ, 'docs', 'historias-usuario.md');
const CARPETA_EVALUACION = path.join(RAIZ, 'docs', 'evaluacion');
export const RUTA_RESULTADOS = path.join(CARPETA_EVALUACION, 'resultados-e2e.json');
export const RUTA_MATRIZ = path.join(CARPETA_EVALUACION, 'matriz-criterios.md');
const CARPETA_EVIDENCIAS = path.join(RAIZ, 'evidencias');
const RUTA_CANDADO = path.join(RAIZ, '.cache', 'resultados-e2e.lock');

const PATRON_ID = /^(CA-\d{2}\.\d+|RNF-\d{2})\b/;

export type Estado = 'cumple' | 'parcial' | 'no_cumple';

export interface ResultadoCriterio {
  id: string;
  estado: Estado;
  /** Título completo de la prueba (o pruebas) que cubren el criterio. */
  prueba: string;
  archivo: string;
  observado: string;
  observacion: string;
  /** Fecha ISO de la ejecución que produjo este resultado. */
  fecha: string;
}

export type ResultadosAcumulados = Record<string, ResultadoCriterio>;

export interface Criterio {
  id: string;
  nombre: string;
  esperado: string;
}

export interface Grupo {
  /** Por ejemplo "HU-01 · Crear mi cuenta". */
  titulo: string;
  criterios: Criterio[];
}

// ---------- Lectura de las historias ----------

function celdas(linea: string): string[] {
  const interior = linea.trim().replace(/^\|/, '').replace(/\|$/, '');
  return interior.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** Extrae HU-01..HU-14 con sus tablas y el RNF-01 desde el markdown de historias. */
export function leerHistorias(markdown: string): Grupo[] {
  const grupos: Grupo[] = [];
  let actual: Grupo | null = null;
  let columnas: string[] | null = null;

  for (const linea of markdown.split(/\r?\n/)) {
    const encabezado = linea.match(/^###\s+(HU-\d{2}\s*·.*)$/);
    if (encabezado?.[1]) {
      actual = { titulo: encabezado[1].trim(), criterios: [] };
      grupos.push(actual);
      columnas = null;
      continue;
    }
    if (/^#{1,3}\s/.test(linea)) {
      actual = null;
      columnas = null;
      continue;
    }
    if (!actual || !linea.trim().startsWith('|')) {
      columnas = linea.trim().startsWith('|') ? columnas : null;
      continue;
    }
    const fila = celdas(linea);
    if (!columnas) {
      columnas = fila.map((c) => c.toLowerCase());
      continue;
    }
    if (fila.every((c) => /^:?-+:?$/.test(c))) continue;
    const iId = columnas.indexOf('id');
    const iNombre = columnas.indexOf('criterio');
    const iEsperado = columnas.indexOf('resultado esperado');
    const id = fila[iId] ?? '';
    if (!PATRON_ID.test(id)) continue;
    actual.criterios.push({ id, nombre: fila[iNombre] ?? '', esperado: fila[iEsperado] ?? '' });
  }

  // RNF-01 está en una lista, no en tabla: el resultado esperado es el texto de la viñeta.
  const rnf = markdown.match(/^-\s+\*\*RNF-01\s*·\s*([^*]+?)\.?\*\*\s*(.+)$/m);
  if (rnf?.[1] && rnf[2]) {
    grupos.push({
      titulo: 'RNF-01 · Privacidad (requisito no funcional)',
      criterios: [{ id: 'RNF-01', nombre: rnf[1].trim(), esperado: rnf[2].trim() }],
    });
  }
  return grupos;
}

// ---------- Acumulado de resultados ----------

export function leerResultados(): ResultadosAcumulados {
  if (!existsSync(RUTA_RESULTADOS)) return {};
  try {
    const datos = JSON.parse(readFileSync(RUTA_RESULTADOS, 'utf8')) as unknown;
    return datos && typeof datos === 'object' ? (datos as ResultadosAcumulados) : {};
  } catch {
    return {};
  }
}

function esperar(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Candado con mkdir (atómico) para que dos suites que terminan a la vez no se pisen el json. */
function conCandado<T>(fn: () => T): T {
  mkdirSync(path.dirname(RUTA_CANDADO), { recursive: true });
  const limite = Date.now() + 20_000;
  for (;;) {
    try {
      mkdirSync(RUTA_CANDADO);
      break;
    } catch {
      try {
        if (Date.now() - statSync(RUTA_CANDADO).mtimeMs > 30_000) rmSync(RUTA_CANDADO, { recursive: true, force: true });
      } catch {
        // El candado se liberó entre el intento y la revisión.
      }
      if (Date.now() > limite) break;
      esperar(100);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(RUTA_CANDADO, { recursive: true, force: true });
  }
}

function escribirAtomico(ruta: string, contenido: string) {
  mkdirSync(path.dirname(ruta), { recursive: true });
  const temporal = `${ruta}.${process.pid}.tmp`;
  writeFileSync(temporal, contenido);
  renameSync(temporal, ruta);
}

export function acumularResultados(nuevos: ResultadoCriterio[]): ResultadosAcumulados {
  return conCandado(() => {
    const acumulado = leerResultados();
    for (const r of nuevos) acumulado[r.id] = r;
    const ordenado = Object.fromEntries(Object.entries(acumulado).sort(([a], [b]) => compararIds(a, b)));
    escribirAtomico(RUTA_RESULTADOS, `${JSON.stringify(ordenado, null, 2)}\n`);
    return ordenado;
  });
}

function compararIds(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true });
}

// ---------- Limpieza de errores ----------

function sinAnsi(texto: string): string {
  return texto.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}

function lineasUtiles(mensaje: string): string[] {
  return sinAnsi(mensaje)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^at\s/.test(l) && !/^Call log:?$/i.test(l) && !/^[-–]\s/.test(l));
}

/** Primer renglón del error, sin colores ni prefijo "Error:". */
export function primerRenglon(mensaje: string): string {
  return (lineasUtiles(mensaje)[0] ?? 'Error sin mensaje').replace(/^Error:\s*/, '');
}

/** Resumen de la causa: localizador, esperado y recibido si los hay; si no, el primer renglón. */
export function resumirCausa(mensaje: string, ubicacion?: string): string {
  const lineas = lineasUtiles(mensaje);
  const partes: string[] = [];
  for (const prefijo of ['Locator:', 'Expected', 'Received', 'Timeout:']) {
    const linea = lineas.find((l) => l.startsWith(prefijo));
    if (linea) partes.push(linea.replace(/\.$/, ''));
  }
  if (!partes.length) partes.push(primerRenglon(mensaje));
  if (ubicacion) partes.push(`en ${ubicacion}`);
  return recortar(`${partes.join('. ')}.`, 400);
}

function recortar(texto: string, maximo: number): string {
  return texto.length > maximo ? `${texto.slice(0, maximo - 1)}…` : texto;
}

// ---------- Construcción de la matriz ----------

function celda(texto: string): string {
  const limpio = texto.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
  return limpio || '—';
}

function rutaEvidencia(id: string): string | null {
  return existsSync(path.join(CARPETA_EVIDENCIAS, `${id}.png`)) ? `../../evidencias/${id}.png` : null;
}

function formatearFecha(fecha: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(fecha);
}

const ETIQUETA: Record<Estado | 'sin_prueba', string> = {
  cumple: 'Cumple',
  parcial: 'Cumple parcialmente',
  no_cumple: 'No cumple',
  sin_prueba: 'Sin prueba',
};

export function construirMatriz(grupos: Grupo[], resultados: ResultadosAcumulados, fechaGeneracion: Date): string {
  const criterios = grupos.flatMap((g) => g.criterios);
  const conteo = { cumple: 0, parcial: 0, no_cumple: 0, sin_prueba: 0 };
  for (const c of criterios) conteo[resultados[c.id]?.estado ?? 'sin_prueba'] += 1;

  const fechas = Object.values(resultados)
    .map((r) => r.fecha)
    .filter(Boolean)
    .sort();
  const ultima = fechas.at(-1);

  const salida: string[] = [
    '# Matriz de criterios de aceptación',
    '',
    'Archivo generado por el reporter `e2e/reporter-matriz.ts` al correr Playwright, o por `npx tsx scripts/matriz-desde-resultados.ts`. No editar a mano.',
    '',
    '- Fuente de los criterios y del resultado esperado: `docs/historias-usuario.md`.',
    '- Fuente de los resultados: `docs/evaluacion/resultados-e2e.json`, con el último resultado de cada criterio. Las suites se corren por separado y cada una actualiza solo sus criterios.',
    '- Una prueba cubre un criterio cuando su nombre empieza por el id (por ejemplo `CA-09.2 ...`). "Sin prueba" quiere decir que no hay resultado registrado para ese criterio.',
    '- RNF-02 y RNF-03 se miden con `npm run eval:asistente` y su resultado está en `docs/evaluacion/asistente.md`.',
    '',
    '## Resumen',
    '',
    `- Fecha de generación: ${formatearFecha(fechaGeneracion)}`,
    `- Última ejecución registrada: ${ultima ? formatearFecha(new Date(ultima)) : 'ninguna'}`,
    `- Total de criterios: ${criterios.length}`,
    `- Cumple: ${conteo.cumple}`,
    `- Cumple parcialmente: ${conteo.parcial}`,
    `- No cumple: ${conteo.no_cumple}`,
    `- Sin prueba: ${conteo.sin_prueba}`,
    '',
  ];

  for (const grupo of grupos) {
    salida.push(`## ${grupo.titulo}`, '');
    salida.push('| Criterio | Resultado esperado | Resultado observado | Cumple / No cumple | Observación | Evidencia |');
    salida.push('|---|---|---|---|---|---|');
    for (const c of grupo.criterios) {
      const r = resultados[c.id];
      const evidencia = rutaEvidencia(c.id);
      const observacion = r ? `${r.observacion ? `${r.observacion} ` : ''}(prueba: ${r.archivo}, ${r.fecha.slice(0, 10)})` : 'No hay prueba registrada para este criterio.';
      salida.push(
        `| ${celda(`${c.id} ${c.nombre}`)} | ${celda(c.esperado)} | ${celda(r?.observado ?? '')} | ${ETIQUETA[r?.estado ?? 'sin_prueba']} | ${celda(observacion)} | ${evidencia ? `[${c.id}.png](${evidencia})` : '—'} |`,
      );
    }
    salida.push('');
  }

  const conocidos = new Set(criterios.map((c) => c.id));
  const huerfanos = Object.values(resultados).filter((r) => !conocidos.has(r.id));
  if (huerfanos.length) {
    salida.push('## Resultados con id que no está en las historias', '');
    salida.push('Estas pruebas usan un id que no existe en `docs/historias-usuario.md`. Hay que corregir el id o la historia.', '');
    salida.push('| Id | Prueba | Resultado | Archivo |', '|---|---|---|---|');
    for (const r of huerfanos) salida.push(`| ${celda(r.id)} | ${celda(r.prueba)} | ${ETIQUETA[r.estado]} | ${celda(r.archivo)} |`);
    salida.push('');
  }
  return salida.join('\n');
}

/** Regenera la matriz desde el json acumulado, sin correr pruebas. */
export function generarMatriz(fechaGeneracion: Date): { ruta: string; criterios: number } {
  const grupos = leerHistorias(readFileSync(RUTA_HISTORIAS, 'utf8'));
  const contenido = construirMatriz(grupos, leerResultados(), fechaGeneracion);
  escribirAtomico(RUTA_MATRIZ, contenido.endsWith('\n') ? contenido : `${contenido}\n`);
  return { ruta: RUTA_MATRIZ, criterios: grupos.reduce((n, g) => n + g.criterios.length, 0) };
}

// ---------- Reporter ----------

function anotaciones(test: TestCase, result: TestResult | undefined, tipo: string): string[] {
  const todas = [...test.annotations, ...(result?.annotations ?? [])];
  const vistas = new Set<string>();
  return todas
    .filter((a) => a.type === tipo && a.description)
    .map((a) => a.description as string)
    .filter((d) => (vistas.has(d) ? false : (vistas.add(d), true)));
}

function capitalizar(texto: string): string {
  return texto ? texto[0]!.toUpperCase() + texto.slice(1) : texto;
}

function resultadoDePrueba(test: TestCase, raiz: string, fecha: string): ResultadoCriterio | null {
  const id = test.title.match(PATRON_ID)?.[1];
  if (!id) return null;
  const result = test.results.at(-1);
  // Las pruebas omitidas no cambian el acumulado: no se probó nada.
  if (!result || result.status === 'skipped') return null;

  const archivo = path.relative(raiz, test.location.file).split(path.sep).join('/');
  const observadas = anotaciones(test, result, 'observado');
  const observaciones = anotaciones(test, result, 'observacion');
  const paso = test.outcome() === 'expected' || test.outcome() === 'flaky';

  if (paso) {
    const faltantes = anotaciones(test, result, 'parcial');
    return {
      id,
      estado: faltantes.length ? 'parcial' : 'cumple',
      prueba: test.title,
      archivo,
      observado: observadas.length ? observadas.join(' ') : `Comprobado: ${capitalizar(test.title.replace(PATRON_ID, '').trim())}`,
      observacion: [...faltantes, ...observaciones].join(' '),
      fecha,
    };
  }

  const error = result.errors[0] ?? result.error;
  const mensaje =
    error?.message ?? (result.status === 'timedOut' ? 'La prueba superó el tiempo límite' : `La prueba terminó con estado ${result.status}`);
  const ubicacion = error?.location ? `${path.relative(raiz, error.location.file).split(path.sep).join('/')}:${error.location.line}` : undefined;
  return {
    id,
    estado: 'no_cumple',
    prueba: test.title,
    archivo,
    observado: recortar(primerRenglon(mensaje), 300),
    observacion: observaciones.length ? observaciones.join(' ') : resumirCausa(mensaje, ubicacion),
    fecha,
  };
}

/** Si varias pruebas comparten id, el criterio cumple solo si todas pasan. */
function combinar(resultados: ResultadoCriterio[]): ResultadoCriterio[] {
  const porId = new Map<string, ResultadoCriterio[]>();
  for (const r of resultados) porId.set(r.id, [...(porId.get(r.id) ?? []), r]);
  return [...porId.values()].map((grupo) => {
    if (grupo.length === 1) return grupo[0]!;
    const base = grupo.find((r) => r.estado === 'no_cumple') ?? grupo.find((r) => r.estado === 'parcial') ?? grupo[0]!;
    return {
      ...base,
      prueba: grupo.map((r) => r.prueba).join('; '),
      observacion: [base.observacion, `Hay ${grupo.length} pruebas con este id; cuenta como Cumple solo si todas pasan.`]
        .filter(Boolean)
        .join(' '),
    };
  });
}

export default class ReporterMatriz implements Reporter {
  private suite: Suite | null = null;

  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }

  onEnd(_resultado: FullResult) {
    if (!this.suite) return;
    const fecha = new Date();
    const nuevos = combinar(
      this.suite
        .allTests()
        .map((t) => resultadoDePrueba(t, RAIZ, fecha.toISOString()))
        .filter((r): r is ResultadoCriterio => r !== null),
    );
    try {
      if (nuevos.length) acumularResultados(nuevos);
      generarMatriz(fecha);
      console.log(`\n[reporter-matriz] ${nuevos.length} criterio(s) actualizados. Matriz: ${path.relative(process.cwd(), RUTA_MATRIZ)}`);
    } catch (e) {
      console.error('[reporter-matriz] No se pudo escribir la matriz:', e);
    }
  }

  printsToStdio() {
    return false;
  }
}
