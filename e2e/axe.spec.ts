// CA-04.3: analiza las pantallas principales con axe (WCAG 2 A y AA) y deja el reporte en docs/evaluacion.
// Dentro de la app se navega tocando los accesos, porque page.goto recarga la SPA y cierra la sesión en memoria.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { capturar, crearCuentaYEntrar } from './utilidades';

const CARPETA = path.join(__dirname, '..', 'docs', 'evaluacion');
const IMPACTOS = ['critical', 'serious', 'moderate', 'minor'] as const;
type Impacto = (typeof IMPACTOS)[number];

interface Violacion {
  regla: string;
  impacto: Impacto | 'sin impacto';
  descripcion: string;
  ayuda: string;
  nodos: number;
  ejemplos: string[];
}

interface ReportePantalla {
  pantalla: string;
  ruta: string;
  violaciones: Violacion[];
}

async function esperarPantalla(page: Page, ruta: RegExp, titulo: string | RegExp) {
  await expect(page).toHaveURL(ruta);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
  // Deja terminar animaciones de entrada para que axe mida los colores finales.
  await page.waitForTimeout(400);
}

async function analizar(page: Page, pantalla: string): Promise<ReportePantalla> {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return {
    pantalla,
    ruta: new URL(page.url()).pathname,
    violaciones: resultado.violations.map((v) => ({
      regla: v.id,
      impacto: (v.impact as Impacto | null | undefined) ?? 'sin impacto',
      descripcion: v.description,
      ayuda: v.helpUrl,
      nodos: v.nodes.length,
      ejemplos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    })),
  };
}

/** Abre una pantalla desde el inicio, la analiza y vuelve con el botón atrás del navegador. */
async function desdeInicio(page: Page, reportes: ReportePantalla[], acceso: Locator, pantalla: string, ruta: RegExp, titulo: string | RegExp) {
  await acceso.click();
  await esperarPantalla(page, ruta, titulo);
  reportes.push(await analizar(page, pantalla));
  await page.goBack();
  await esperarPantalla(page, /\/inicio$/, /^Hola,/);
}

function contar(violaciones: Violacion[], impacto: Impacto) {
  return violaciones.filter((v) => v.impacto === impacto).length;
}

function escribirReportes(reportes: ReportePantalla[], fecha: Date) {
  mkdirSync(CARPETA, { recursive: true });
  writeFileSync(
    path.join(CARPETA, 'axe-reporte.json'),
    `${JSON.stringify({ fecha: fecha.toISOString(), etiquetas: ['wcag2a', 'wcag2aa'], pantallas: reportes }, null, 2)}\n`,
  );

  const md = [
    '# Reporte de accesibilidad (axe)',
    '',
    'Archivo generado por `e2e/axe.spec.ts` (prueba CA-04.3). No editar a mano.',
    '',
    `- Fecha de ejecución: ${fecha.toISOString()}`,
    '- Herramienta: `@axe-core/playwright` con las etiquetas `wcag2a` y `wcag2aa`, en Chromium con viewport Pixel 7.',
    '- Criterio: no debe haber violaciones de impacto `critical` (crítico) ni `serious` (serio).',
    '- axe revisa reglas automáticas. No reemplaza una revisión manual con lector de pantalla.',
    '',
    '## Resumen por pantalla',
    '',
    '| Pantalla | Ruta | Críticas | Serias | Moderadas | Menores |',
    '|---|---|---|---|---|---|',
    ...reportes.map(
      (r) =>
        `| ${r.pantalla} | \`${r.ruta}\` | ${contar(r.violaciones, 'critical')} | ${contar(r.violaciones, 'serious')} | ${contar(r.violaciones, 'moderate')} | ${contar(r.violaciones, 'minor')} |`,
    ),
    '',
    '## Detalle',
    '',
  ];
  for (const r of reportes) {
    md.push(`### ${r.pantalla} (\`${r.ruta}\`)`, '');
    if (!r.violaciones.length) {
      md.push('Sin violaciones.', '');
      continue;
    }
    md.push('| Regla | Impacto | Descripción | Elementos | Ejemplos |', '|---|---|---|---|---|');
    for (const v of r.violaciones) {
      const ejemplos = v.ejemplos.map((e) => `\`${e.replace(/\|/g, '\\|')}\``).join(', ');
      md.push(`| [${v.regla}](${v.ayuda}) | ${v.impacto} | ${v.descripcion.replace(/\|/g, '\\|')} | ${v.nodos} | ${ejemplos} |`);
    }
    md.push('');
  }
  writeFileSync(path.join(CARPETA, 'axe-reporte.md'), md.join('\n'));
}

test('CA-04.3 sin violaciones serias ni criticas en pantallas principales', async ({ page }) => {
  test.setTimeout(180_000);
  const reportes: ReportePantalla[] = [];

  // Pantallas públicas antes de tener cuenta.
  await page.goto('/');
  await esperarPantalla(page, /\/bienvenida$/, 'VozVial');
  reportes.push(await analizar(page, 'Bienvenida'));
  await page.getByTestId('ir-registro').click();
  await esperarPantalla(page, /\/registro$/, 'Crear mi cuenta');
  reportes.push(await analizar(page, 'Registro'));

  await crearCuentaYEntrar(page);
  await esperarPantalla(page, /\/inicio$/, /^Hola,/);
  reportes.push(await analizar(page, 'Inicio'));
  await capturar(page, 'CA-04.3');

  await desdeInicio(page, reportes, page.getByTestId('ir-asistente'), 'Asistente', /\/asistente$/, 'Preguntar');
  await desdeInicio(page, reportes, page.getByTestId('ir-casos'), 'Mis casos', /\/casos$/, 'Mis casos');
  await desdeInicio(page, reportes, page.getByTestId('ir-comparendo'), 'Registrar comparendo', /\/comparendo\/nuevo$/, 'Registrar un comparendo');
  await desdeInicio(page, reportes, page.getByTestId('ir-ajustes'), 'Ajustes', /\/ajustes$/, 'Ajustes');
  await desdeInicio(page, reportes, page.getByRole('link', { name: /Acerca del prototipo/ }), 'Acerca del prototipo', /\/acerca$/, 'Acerca del prototipo');
  await desdeInicio(page, reportes, page.getByTestId('ir-ayuda'), 'Ayuda', /\/ayuda$/, 'Ayuda');

  // Me pararon va al final porque al abrirla puede empezar a grabar y crear un caso.
  await page.getByTestId('boton-me-pararon').click();
  await esperarPantalla(page, /\/me-pararon$/, 'Me pararon');
  reportes.push(await analizar(page, 'Me pararon'));

  // La guía es pública: abrirla con goto no necesita sesión.
  await page.goto('/guia');
  await esperarPantalla(page, /\/guia$/, 'Cómo funciona VozVial');
  reportes.push(await analizar(page, 'Guía (recorrido)'));

  // Recargar cierra la sesión en memoria: así se llega a la pantalla de entrar con la cuenta ya creada.
  await page.goto('/entrar');
  await esperarPantalla(page, /\/entrar$/, 'Entrar');
  reportes.push(await analizar(page, 'Entrar'));

  escribirReportes(reportes, new Date());

  const graves = reportes.flatMap((r) =>
    r.violaciones
      .filter((v) => v.impacto === 'critical' || v.impacto === 'serious')
      .map((v) => `${r.pantalla}: ${v.regla} (${v.impacto}, ${v.nodos} elementos)`),
  );
  const totales = IMPACTOS.map((i) => `${reportes.reduce((n, r) => n + contar(r.violaciones, i), 0)} ${i}`).join(', ');
  test.info().annotations.push({
    type: 'observado',
    description: `axe (wcag2a, wcag2aa) en ${reportes.length} pantallas: ${totales}. Reporte en docs/evaluacion/axe-reporte.md.`,
  });
  expect(graves, `Violaciones serias o críticas: ${graves.join('; ')}`).toEqual([]);
});
