// Ayudas compartidas por las pruebas del asistente (HU-05, HU-06 y RNF-01).
import { expect, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.join(__dirname, '..');

interface PreguntaVerificada {
  id: string;
  pregunta: string;
  respuesta_sencilla: string;
  citas: string[];
}
interface EntradaNormativa {
  id: string;
  norma: string;
  articulo: string;
  texto_literal: string;
  url_fuente: string;
  fecha_consulta: string;
}
interface PreguntaBanco {
  id: string;
  pregunta: string;
  tipo: string;
}

function leerJSON<T>(relativa: string): T {
  return JSON.parse(readFileSync(path.join(RAIZ, relativa), 'utf8')) as T;
}

/** Pregunta verificada por id, tal como está en data/preguntas-verificadas.json. */
export function preguntaVerificada(id: string): PreguntaVerificada {
  const p = leerJSON<{ preguntas: PreguntaVerificada[] }>('data/preguntas-verificadas.json').preguntas.find((x) => x.id === id);
  if (!p) throw new Error(`No existe ${id} en data/preguntas-verificadas.json`);
  return p;
}

/** Pregunta del banco de evaluación por id (data/banco-evaluacion.json). */
export function preguntaBanco(id: string): PreguntaBanco {
  const p = leerJSON<{ preguntas: PreguntaBanco[] }>('data/banco-evaluacion.json').preguntas.find((x) => x.id === id);
  if (!p) throw new Error(`No existe ${id} en data/banco-evaluacion.json`);
  return p;
}

/** Entrada de la base normativa por id, buscada en data/normativa/*.json. */
export function entradaNormativa(id: string): EntradaNormativa {
  // Recorre todos los archivos de la base: con Claude la cita puede ser de cualquier norma verificada.
  for (const archivo of readdirSync(path.join(RAIZ, 'data/normativa')).filter((f) => f.endsWith('.json'))) {
    const datos = leerJSON<{ entradas?: EntradaNormativa[] }>(`data/normativa/${archivo}`);
    const e = datos.entradas?.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`No existe ${id} en data/normativa`);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLegible(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${a}`;
}

/**
 * SIMULACION declarada: reemplaza speechSynthesis.speak para registrar qué se pidió leer y en
 * qué idioma. Verifica el llamado; el audio real se muestra en el video.
 */
export async function espiarLecturaEnVoz(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lecturas: { texto: string; idioma: string }[] };
    w.__lecturas = [];
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      w.__lecturas.push({ texto: u.text, idioma: u.lang });
      setTimeout(() => {
        try {
          u.dispatchEvent(new Event('end'));
        } catch {
          // Sin evento de fin no pasa nada: solo se registra el llamado.
        }
      }, 50);
    };
  });
}

export async function lecturas(page: Page): Promise<{ texto: string; idioma: string }[]> {
  return page.evaluate(() => (window as unknown as { __lecturas?: { texto: string; idioma: string }[] }).__lecturas ?? []);
}

/** Desde /inicio abre el asistente sin recargar (la sesión vive solo en memoria). */
export async function abrirAsistente(page: Page): Promise<void> {
  await page.getByTestId('ir-asistente').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Preguntar' })).toBeVisible();
}

/** Escribe la pregunta en el campo y la envía. */
export async function preguntarEscribiendo(page: Page, pregunta: string): Promise<void> {
  await page.getByTestId('campo-pregunta').fill(pregunta);
  await page.getByRole('button', { name: 'Enviar la pregunta escrita' }).click();
  // Espera la respuesta de esta pregunta, no la anterior que pueda seguir en pantalla.
  await expect(page.getByTestId('respuesta')).toContainText(`Preguntaste: ${pregunta.trim()}`, { timeout: 15_000 });
}

export interface RespuestaApi {
  tipo: string;
  texto: string;
  modo: string;
  citas: { id: string }[];
}

/**
 * Promesa con el JSON de la proxima respuesta de /api/asistente. Sirve para que las pruebas valgan
 * en los dos modos: en modo verificado el texto es la respuesta sencilla fija; con Claude el texto
 * cambia y se compara con lo que devolvio el servidor.
 */
export function esperarRespuestaApi(page: Page): Promise<RespuestaApi> {
  return page
    .waitForResponse((r) => r.url().endsWith('/api/asistente') && r.request().method() === 'POST', { timeout: 20_000 })
    .then((r) => r.json() as Promise<RespuestaApi>);
}

