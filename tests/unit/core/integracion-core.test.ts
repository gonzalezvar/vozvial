/**
 * Pruebas de integración del dominio: el barril, la pureza de src/core, los plazos con el
 * parametros.json REAL (no el fixture) y la coherencia de data/ con la regla "no inventar normas".
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import infracciones from '../../../data/infracciones.json';
import parametrosReales from '../../../data/normativa/parametros.json';
import preguntasVerificadas from '../../../data/preguntas-verificadas.json';
import bancoEvaluacion from '../../../data/banco-evaluacion.json';
import * as core from '../../../src/core';
import { ARCHIVOS_NORMATIVA, obtenerBaseNormativa } from '../../../src/core/cargarDatos';

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const CARPETA_CORE = path.join(RAIZ, 'src', 'core');
const CARPETA_NORMATIVA = path.join(RAIZ, 'data', 'normativa');

function archivosCore(): string[] {
  return readdirSync(CARPETA_CORE).filter((f) => f.endsWith('.ts'));
}

/** Código sin comentarios, para que los textos de documentación no den falsos positivos. */
function codigoSinComentarios(archivo: string): string {
  return readFileSync(path.join(CARPETA_CORE, archivo), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('barril src/core/index.ts', () => {
  it('reexporta las clases del dominio', () => {
    const clases = [
      'FechaCivil', 'FestivosColombia', 'ParametrosPlazos', 'CalculadoraPlazos',
      'ValidadorRegistro', 'ServicioCredenciales', 'ControlIntentos', 'GestorClaves', 'CodigoRecuperacion',
      'ErrorClave', 'DerivadorPBKDF2', 'CodificacionBase64',
      'Comparendo', 'Evidencia', 'Caso', 'ParserComparendo', 'CatalogoInfracciones', 'GeneradorSolicitud',
      'NormalizadorEspanol', 'BaseNormativa', 'DetectorTema', 'ProveedorVerificado', 'ProveedorLLM', 'AsistenteNormativo',
    ] as const;
    for (const nombre of clases) {
      expect(typeof (core as Record<string, unknown>)[nombre]).toBe('function');
    }
  });

  it('incluye cada archivo de src/core salvo cargarDatos (que arrastra los JSON)', () => {
    const barril = readFileSync(path.join(CARPETA_CORE, 'index.ts'), 'utf8');
    const faltan = archivosCore()
      .map((f) => f.replace(/\.ts$/, ''))
      .filter((m) => m !== 'index' && m !== 'cargarDatos')
      .filter((m) => !barril.includes(`'./${m}'`));
    expect(faltan).toEqual([]);
  });
});

describe('pureza de src/core', () => {
  it('solo importa módulos propios, JSON de data/ y minisearch', () => {
    const indebidos: string[] = [];
    for (const archivo of archivosCore()) {
      const codigo = codigoSinComentarios(archivo);
      for (const m of codigo.matchAll(/(?:from|import|require\()\s*['"]([^'"]+)['"]/g)) {
        const destino = m[1]!;
        const permitido =
          destino.startsWith('./') || (destino.startsWith('../../data/') && destino.endsWith('.json')) || destino === 'minisearch';
        if (!permitido) indebidos.push(`${archivo}: ${destino}`);
      }
    }
    expect(indebidos).toEqual([]);
  });

  it('no usa APIs de navegador ni de Node (WebCrypto llega como parámetro)', () => {
    const prohibidas = /\b(window|document|navigator|localStorage|sessionStorage|indexedDB|globalThis|process|Buffer|btoa|atob|XMLHttpRequest|speechSynthesis|MediaRecorder)\b/;
    const usos: string[] = [];
    for (const archivo of archivosCore()) {
      codigoSinComentarios(archivo)
        .split('\n')
        .forEach((linea, i) => {
          // Se ignoran textos entre comillas: solo cuenta el uso como identificador.
          const sinTextos = linea.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "''");
          if (prohibidas.test(sinTextos)) usos.push(`${archivo}:${i + 1}: ${linea.trim()}`);
        });
      // El crypto global está prohibido; solo se acepta como parámetro o propiedad inyectada.
      const codigo = codigoSinComentarios(archivo);
      const firmas = /\bcrypto\s*:\s*Crypto\b/.test(codigo);
      if (/(^|[^.\w])crypto\.(subtle|getRandomValues)/m.test(codigo) && !firmas) usos.push(`${archivo}: crypto global`);
    }
    expect(usos).toEqual([]);
  });
});

describe('CalculadoraPlazos con data/normativa/parametros.json real', () => {
  const parametros = core.ParametrosPlazos.desdeJSON(parametrosReales as unknown as core.ParametrosJSON);
  const calculadora = new core.CalculadoraPlazos(new core.FestivosColombia(), parametros);

  // Tabla de docs/base-normativa.md, sección "Festivos".
  it.each([
    ['2026-11-06', 'via', 5, '2026-11-13'],
    ['2026-11-13', 'via', 5, '2026-11-23'],
    ['2026-11-13', 'fotodeteccion', 11, '2026-12-01'],
    ['2026-12-04', 'via', 5, '2026-12-14'],
    ['2026-12-18', 'fotodeteccion', 11, '2027-01-06'],
  ] as const)('%s (%s) son %i días hábiles hasta %s', (base, tipo, dias, limite) => {
    const r = calculadora.calcular({ tipo, fechaBase: core.FechaCivil.desdeISO(base) });
    expect(r.diasHabiles).toBe(dias);
    expect(r.fechaLimite.aISO()).toBe(limite);
  });

  it('todo el sustento del plazo existe y está verificado en la base', () => {
    const base = obtenerBaseNormativa();
    for (const tipo of ['via', 'fotodeteccion'] as const) {
      const r = calculadora.calcular({ tipo, fechaBase: core.FechaCivil.desdeISO('2026-11-13') });
      expect(r.sustento.length).toBeGreaterThan(0);
      for (const id of r.sustento) expect(base.existe(id)).toBe(true);
    }
  });
});

describe('coherencia de data/ con la base normativa', () => {
  const entradas = ARCHIVOS_NORMATIVA.flatMap((a) => a.entradas);
  const base = obtenerBaseNormativa();

  it('cargarDatos carga todos los archivos de data/normativa (salvo parametros.json)', () => {
    const enDisco = readdirSync(CARPETA_NORMATIVA).filter((f) => f.endsWith('.json') && f !== 'parametros.json');
    const totalEnDisco = enDisco.reduce(
      (n, f) => n + (JSON.parse(readFileSync(path.join(CARPETA_NORMATIVA, f), 'utf8')) as { entradas: unknown[] }).entradas.length,
      0,
    );
    expect(ARCHIVOS_NORMATIVA).toHaveLength(enDisco.length);
    expect(entradas).toHaveLength(totalEnDisco);
  });

  it('ninguna entrada verificada carece de url_fuente, texto_literal o fecha_consulta', () => {
    const malas = entradas
      .filter((e) => e.verificado === true)
      .filter((e) => !e.url_fuente?.trim().startsWith('http') || !e.texto_literal?.trim() || !e.fecha_consulta?.trim())
      .map((e) => e.id);
    expect(malas).toEqual([]);
  });

  it('las preguntas verificadas solo citan entradas verificadas', () => {
    const malas = preguntasVerificadas.preguntas.flatMap((p) =>
      p.citas.length === 0 ? [`${p.id}: sin citas`] : p.citas.filter((c) => !base.existe(c)).map((c) => `${p.id}: ${c}`),
    );
    expect(malas).toEqual([]);
  });

  it('los parámetros verificados se sustentan solo en entradas verificadas', () => {
    const malas = parametrosReales.parametros
      .filter((p) => p.verificado)
      .flatMap((p) => p.sustento.filter((id) => !base.existe(id)).map((id) => `${p.id}: ${id}`));
    expect(malas).toEqual([]);
  });

  it('las infracciones verificadas apuntan a un artículo verificado', () => {
    const malas = infracciones.infracciones
      .filter((i) => i.verificado)
      .filter((i) => !base.existe(i.articulo_id) || !i.descripcion_literal.trim())
      .map((i) => i.codigo);
    expect(malas).toEqual([]);
  });

  it('el banco de evaluación no repite preguntas verificadas y sus artículos esperados existen', () => {
    const verificadas = new Set(
      preguntasVerificadas.preguntas.flatMap((p) => [p.pregunta, ...p.variantes]).map((t) => t.trim().toLowerCase()),
    );
    const repetidas = bancoEvaluacion.preguntas.filter((b) => verificadas.has(b.pregunta.trim().toLowerCase())).map((b) => b.id);
    const sinBase = bancoEvaluacion.preguntas
      .filter((b) => b.tipo === 'con_sustento')
      .flatMap((b) => (b.articulos_esperados.length === 0 ? [`${b.id}: vacío`] : b.articulos_esperados.filter((a) => !base.existe(a))));
    expect(repetidas).toEqual([]);
    expect(sinBase).toEqual([]);
  });
});
