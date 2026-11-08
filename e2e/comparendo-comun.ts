// Ayudas compartidas por las pruebas de HU-09 a HU-12 (comparendo y plazos).
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import path from 'node:path';

export const FIXTURE_LEGIBLE = path.join(__dirname, 'fixtures', 'comparendo-prueba.png');
/** Misma imagen con la placa manchada y borrosa: el OCR la lee con baja confianza (CA-09.2). */
export const FIXTURE_BORROSO = path.join(__dirname, 'fixtures', 'comparendo-borroso.png');

/**
 * Fija la fecha del navegador (Date y new Date()) sin detener los temporizadores.
 * Se usa mediodía de Bogotá para que el día no cambie por el huso horario.
 */
export async function fijarFecha(page: Page, iso: string): Promise<void> {
  await page.clock.setFixedTime(new Date(`${iso}T12:00:00-05:00`));
}

export interface DatosManuales {
  numero: string;
  fecha: string;
  placa?: string;
  codigo: string;
  tipo: 'via' | 'fotodeteccion';
  notificacion?: string;
}

/** Abre "Registrar un comparendo" desde el inicio y elige "Escribir los datos". */
export async function abrirRegistroManual(page: Page): Promise<void> {
  await page.getByTestId('ir-comparendo').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Registrar un comparendo' })).toBeVisible();
  await page.getByRole('button', { name: 'Escribir los datos del comparendo a mano' }).click();
}

/** Llena el formulario manual sin guardar. */
export async function llenarManual(page: Page, d: DatosManuales): Promise<void> {
  await page.getByLabel('Número del comparendo', { exact: true }).fill(d.numero);
  await page.getByLabel('Fecha de la infracción', { exact: true }).fill(d.fecha);
  await page.getByLabel('Placa', { exact: true }).fill(d.placa ?? '');
  await page.getByLabel('Código de la infracción', { exact: true }).fill(d.codigo);
  await page.getByRole('radio', { name: d.tipo === 'via' ? 'En la vía' : 'Por fotodetección' }).click();
  if (d.tipo === 'fotodeteccion') {
    await page.getByLabel('¿Qué día recibiste la notificación?', { exact: true }).fill(d.notificacion ?? '');
  }
}

/** Registra un comparendo a mano desde el inicio y espera el detalle. Devuelve el id del caso. */
export async function registrarManual(page: Page, d: DatosManuales): Promise<string> {
  await abrirRegistroManual(page);
  await llenarManual(page, d);
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tu comparendo' })).toBeVisible({ timeout: 15_000 });
  const id = /\/comparendo\/([^/?#]+)/.exec(page.url())?.[1];
  expect(id).toBeTruthy();
  return id!;
}

/** Vuelve al inicio con el botón "Volver" hasta ver el saludo. */
export async function irAlInicio(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    if (/\/inicio$/.test(new URL(page.url()).pathname)) break;
    await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
    await page.waitForTimeout(200);
  }
  await expect(page).toHaveURL(/\/inicio$/);
}

/** Revisa la pantalla actual con axe (WCAG 2 A y AA) y falla si hay violaciones serias o críticas. */
export async function sinViolacionesSerias(page: Page): Promise<void> {
  // Deja terminar animaciones de entrada para que axe mida los colores finales.
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const graves = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(graves).toEqual([]);
}

/** Cierra y vuelve a abrir la app: recarga la SPA (se pierde la sesión en memoria) y entra con el PIN. */
export async function reabrirApp(page: Page, escribirPinYEntrar: (page: Page) => Promise<void>): Promise<void> {
  await page.goto('/entrar');
  await escribirPinYEntrar(page);
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 });
}
