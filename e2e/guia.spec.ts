// Guia dentro de la app: recorrido de bienvenida (/guia), oferta unica en el inicio, ayuda contextual
// de cada pantalla y guias por situacion (/ayuda). Las capturas quedan en evidencias/guia-*.png.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { capturar, CUENTA, crearCuentaYEntrar } from './utilidades';

// Cada prueba usa su propio celular: el servidor de datos guarda la cuenta y rechaza un celular repetido.
const cuenta = (final: string) => ({ nombre: CUENTA.nombre, pin: CUENTA.pin, celular: `300555${final}` });

const TITULOS_PASOS = [
  'VozVial te acompaña con tu comparendo',
  'Tus datos van cifrados',
  'Si te para un agente, toca “Me pararon”',
  'Pregunta hablando o escribiendo',
  'Registra tu comparendo y mira tu plazo',
];

async function sinViolacionesSerias(page: Page, donde: string) {
  await page.waitForTimeout(300);
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serias = resultado.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serias.map((v) => `${donde}: ${v.id} (${v.impact}) en ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function altoMinimo(page: Page, testID: string) {
  const caja = await page.getByTestId(testID).boundingBox();
  expect(caja?.height ?? 0).toBeGreaterThanOrEqual(56);
}

test('Guía: recorrido completo desde la bienvenida, con Atrás, Escuchar en cada paso y final "Crear mi cuenta"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible();
  await page.getByTestId('ir-guia').click();
  await expect(page).toHaveURL(/\/guia$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo funciona VozVial' })).toBeVisible();

  const siguiente = page.getByRole('button', { name: 'Siguiente paso' });
  const atras = page.getByRole('button', { name: /^Atrás/ });
  const saltar = page.getByRole('button', { name: 'Saltar el recorrido' });

  // Primer paso: no hay "Atrás", si hay "Saltar".
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 1 de 5');
  await expect(atras).toHaveCount(0);
  await expect(saltar).toBeVisible();
  await altoMinimo(page, 'recorrido-siguiente');
  await altoMinimo(page, 'recorrido-saltar');
  await capturar(page, 'guia-recorrido-paso-1');

  for (let i = 0; i < TITULOS_PASOS.length; i++) {
    await expect(page.getByTestId('indicador-paso')).toHaveText(`Paso ${i + 1} de 5`);
    await expect(page.getByRole('heading', { level: 2, name: TITULOS_PASOS[i] })).toBeVisible();
    await expect(page.getByRole('button', { name: `Escuchar este paso: leer en voz alta el paso ${i + 1}` })).toBeVisible();
    if (i === 2) await capturar(page, 'guia-recorrido-paso-3');
    if (i < TITULOS_PASOS.length - 1) await siguiente.click();
  }

  // "Atrás" vuelve un paso y "Siguiente" regresa.
  await atras.click();
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 4 de 5');
  await expect(page.getByRole('heading', { level: 2, name: TITULOS_PASOS[3] })).toBeVisible();
  await siguiente.click();

  // Ultimo paso: sin "Saltar" ni "Siguiente"; la accion principal es crear la cuenta.
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 5 de 5');
  await expect(saltar).toHaveCount(0);
  await expect(siguiente).toHaveCount(0);
  const crear = page.getByRole('link', { name: 'Crear mi cuenta' });
  await expect(crear).toBeVisible();
  await capturar(page, 'guia-recorrido-final');
  await crear.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Crear mi cuenta' })).toBeVisible();

  const visto = await page.evaluate(() => window.localStorage.getItem('vozvial.guia.recorridoVisto'));
  expect(visto).not.toBeNull();
});

test('Guía: "Saltar" deja el recorrido y vuelve a la bienvenida', async ({ page }) => {
  await page.goto('/guia');
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 1 de 5');
  await page.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 2 de 5');
  await page.getByRole('button', { name: 'Saltar el recorrido' }).click();
  await expect(page).toHaveURL(/\/bienvenida$/);
  await expect(page.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible();
  const visto = await page.evaluate(() => window.localStorage.getItem('vozvial.guia.recorridoVisto'));
  expect(visto).not.toBeNull();
});

test('Guía: tras crear la cuenta el inicio ofrece el recorrido una sola vez y la ayuda de la pantalla se abre y se escucha', async ({ page }) => {
  await crearCuentaYEntrar(page, cuenta('0101'));

  const oferta = page.getByTestId('oferta-recorrido');
  await expect(oferta).toBeVisible();
  await expect(oferta.getByRole('link', { name: /Ver cómo funciona/ })).toBeVisible();
  await capturar(page, 'guia-oferta-inicio');
  await oferta.getByRole('button', { name: /^Ahora no/ }).click();
  await expect(oferta).toHaveCount(0);

  // Ayuda contextual del inicio: boton de 56 px con nombre accesible propio.
  const ayuda = page.getByRole('button', { name: 'Ayuda de esta pantalla' });
  await expect(ayuda).toBeVisible();
  await altoMinimo(page, 'boton-ayuda-pantalla');
  await ayuda.click();
  const ventana = page.getByRole('dialog');
  await expect(ventana).toBeVisible();
  await expect(ventana.getByRole('heading', { level: 2, name: 'Qué hay en el inicio' })).toBeVisible();
  await expect(ventana.getByTestId('texto-ayuda')).toContainText('Me pararon');
  await expect(ventana.getByRole('button', { name: 'Escuchar: leer en voz alta la ayuda de esta pantalla' })).toBeVisible();
  await capturar(page, 'guia-ayuda-inicio');
  await sinViolacionesSerias(page, 'ayuda del inicio');
  await ventana.getByRole('button', { name: /^Entendido/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Al volver al inicio dentro de la app, la oferta ya no aparece.
  await page.getByTestId('ir-casos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Hola,/ })).toBeVisible();
  await expect(page.getByTestId('oferta-recorrido')).toHaveCount(0);
  const ofrecido = await page.evaluate(() => window.localStorage.getItem('vozvial.guia.ofertaMostrada'));
  expect(ofrecido).not.toBeNull();
});

test('Guía: desde la oferta del inicio se hace el recorrido y al final vuelve al inicio', async ({ page }) => {
  await crearCuentaYEntrar(page, cuenta('0102'));
  await page.getByTestId('ver-recorrido').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cómo funciona VozVial' })).toBeVisible();
  for (let i = 1; i < TITULOS_PASOS.length; i++) await page.getByRole('button', { name: 'Siguiente paso' }).click();
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 5 de 5');
  // Con sesion no tiene sentido "Crear mi cuenta": el final lleva al inicio.
  await expect(page.getByRole('link', { name: 'Crear mi cuenta' })).toHaveCount(0);
  await page.getByRole('link', { name: /Ir al inicio/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Hola,/ })).toBeVisible();
  await expect(page.getByTestId('oferta-recorrido')).toHaveCount(0);
});

test('Guía: una guía de /ayuda muestra pasos numerados y su botón lleva a la pantalla correspondiente', async ({ page }) => {
  await crearCuentaYEntrar(page, cuenta('0103'));
  await page.getByTestId('ocultar-recorrido').click();

  // Desde la ayuda de la pantalla se llega a las guias por situacion.
  await page.getByRole('button', { name: 'Ayuda de esta pantalla' }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Ver guías paso a paso' }).click();
  await expect(page).toHaveURL(/\/ayuda$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ayuda' })).toBeVisible();

  const lista = page.getByTestId('lista-guias');
  for (const titulo of ['Me paró un agente', 'Me llegó una fotomulta', 'Quiero pedir la audiencia', 'Olvidé mi PIN', 'Agrandar la letra']) {
    await expect(lista.getByRole('link', { name: new RegExp(`^${titulo}`) })).toBeVisible();
  }
  await capturar(page, 'guia-ayuda-lista');
  await sinViolacionesSerias(page, '/ayuda');

  await page.getByTestId('guia-agrandar-letra').getByRole('link').click();
  await expect(page).toHaveURL(/\/ayuda\?guia=agrandar-letra$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Agrandar la letra' })).toBeVisible();
  const pasos = page.getByTestId('pasos-guia').getByRole('listitem');
  await expect(pasos).toHaveCount(4);
  await expect(pasos.first()).toContainText('1');
  await expect(pasos.first()).toContainText('Ajustes');
  await capturar(page, 'guia-ayuda-letra');
  await sinViolacionesSerias(page, '/ayuda?guia=agrandar-letra');

  // "Ver otras guías" vuelve a la lista.
  await page.getByRole('link', { name: 'Ver otras guías de ayuda' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ayuda' })).toBeVisible();

  await page.getByTestId('guia-agrandar-letra').getByRole('link').click();
  await page.getByRole('link', { name: /^Abrir Ajustes/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
});

test('Guía: /guia pasa axe sin violaciones serias en el primer y el último paso', async ({ page }) => {
  await page.goto('/guia');
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 1 de 5');
  await sinViolacionesSerias(page, '/guia paso 1');
  await page.goto('/guia?paso=5');
  await expect(page.getByTestId('indicador-paso')).toHaveText('Paso 5 de 5');
  await sinViolacionesSerias(page, '/guia paso 5');
});
