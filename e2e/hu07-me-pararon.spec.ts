// HU-07 Modo "Me pararon". El microfono es el dispositivo falso de Chromium (tono de prueba), declarado como simulacion.
import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { IDS_DERECHOS_ME_PARARON } from '../src/core/DerechosClave';
import { fechaDeHoy, leerAudio, tocarMePararon, terminarMePararon } from './evidencias-comun';
import { capturar, crearCuentaYEntrar } from './utilidades';

const BOGOTA = { latitude: 4.6097, longitude: -74.0817, accuracy: 15 };
/** Hora como la muestra la app en es-CO: "10:15 a. m." */
const HORA = /\d{1,2}:\d{2}\s?[ap]\.\s?m\./;

interface EntradaDatos {
  id: string;
  norma: string;
  articulo: string;
  verificado: boolean;
}

/** Entradas tal como estan en data/normativa, leidas aparte de la app para comparar. */
function entradasNormativa(): Map<string, EntradaDatos> {
  const carpeta = path.join(__dirname, '..', 'data', 'normativa');
  const mapa = new Map<string, EntradaDatos>();
  for (const archivo of readdirSync(carpeta).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(path.join(carpeta, archivo), 'utf8')) as { entradas?: EntradaDatos[] };
    for (const e of json.entradas ?? []) mapa.set(e.id, e);
  }
  return mapa;
}

test.use({ permissions: ['geolocation', 'microphone'], geolocation: BOGOTA });

test('CA-07.1 un toque en "Me pararon" empieza a grabar y muestra el tiempo', async ({ page }) => {
  await crearCuentaYEntrar(page);
  // Un solo toque desde el inicio: la pantalla crea el caso y arranca la grabacion sola.
  await page.getByTestId('boton-me-pararon').click();
  const indicador = page.getByTestId('indicador-grabando');
  await expect(indicador).toBeVisible({ timeout: 10_000 });
  await expect(indicador).toContainText('Grabando');
  const tiempo = page.getByTestId('tiempo-grabacion');
  await expect(tiempo).toHaveText(/^\d{2}:\d{2}$/);
  await expect(tiempo).toHaveText('00:02', { timeout: 5_000 });
  test.info().annotations.push({
    type: 'observado',
    description: `1 toque desde el inicio. Indicador "Grabando" con tiempo ${await tiempo.innerText()} (MediaRecorder activo).`,
  });
  await capturar(page, 'CA-07.1');
  await terminarMePararon(page);
});

test('CA-07.2 guarda fecha, hora y ubicación; si niego la ubicación queda "Sin ubicación"', async ({ page, context }) => {
  await crearCuentaYEntrar(page);
  const hoy = fechaDeHoy();

  // Con permiso: se guardan las coordenadas.
  await tocarMePararon(page);
  await expect(page.getByTestId('fecha-hora-caso')).toContainText(hoy);
  await expect(page.getByTestId('fecha-hora-caso')).toHaveText(HORA);
  await expect(page.getByTestId('ubicacion-me-pararon')).toContainText('4.60970, -74.08170', { timeout: 15_000 });
  await capturar(page, 'CA-07.2-con-ubicacion');
  await terminarMePararon(page);
  await expect(page.getByTestId('ubicacion-caso')).toContainText('4.60970, -74.08170');
  // Fecha y hora salen del caso guardado (descifrado de IndexedDB), no de la pantalla anterior.
  await expect(page.getByTestId('fecha-hora-detalle')).toContainText(hoy);
  await expect(page.getByTestId('fecha-hora-detalle')).toHaveText(HORA);

  // Sin permiso: se quita el permiso de ubicacion sin recargar (la sesion vive en memoria).
  await context.clearPermissions();
  await context.grantPermissions(['microphone']);
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await tocarMePararon(page);
  await expect(page.getByTestId('ubicacion-me-pararon')).toContainText('Sin ubicación', { timeout: 15_000 });
  await expect(page.getByTestId('motivo-sin-ubicacion')).toHaveText('No diste permiso de ubicación. El caso se guarda igual.');
  await expect(page.getByTestId('fecha-hora-caso')).toContainText(hoy);
  await capturar(page, 'CA-07.2');
  await terminarMePararon(page);
  await expect(page.getByTestId('ubicacion-caso')).toHaveText('Ubicación: Sin ubicación');
  await expect(page.getByTestId('fecha-hora-detalle')).toContainText(hoy);
  await expect(page.getByTestId('fecha-hora-detalle')).toHaveText(HORA);

  // Los dos casos quedaron guardados.
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await page.getByTestId('ir-casos').click();
  await expect(page.locator('[data-testid^="caso-"]')).toHaveCount(2);
  test.info().annotations.push({
    type: 'observado',
    description: `Con permiso: 4.60970, -74.08170 y fecha ${hoy}. Sin permiso: el caso se crea igual con "Sin ubicación".`,
  });
});

test('CA-07.3 muestra solo derechos verificados de la base, cada uno con su artículo', async ({ page }) => {
  const datos = entradasNormativa();
  const verificados = IDS_DERECHOS_ME_PARARON.filter((id) => datos.get(id)?.verificado === true);
  const noVerificados = IDS_DERECHOS_ME_PARARON.filter((id) => datos.get(id)?.verificado !== true);
  expect(verificados.length).toBeGreaterThan(0);

  await crearCuentaYEntrar(page);
  await tocarMePararon(page);
  const seccion = page.getByTestId('derechos-clave');
  await expect(seccion.getByRole('heading', { name: 'Tus derechos clave' })).toBeVisible();

  for (const id of verificados) {
    const e = datos.get(id)!;
    const derecho = page.getByTestId(`derecho-${id}`);
    await expect(derecho).toBeVisible();
    await expect(derecho).toContainText(`${e.norma}, artículo ${e.articulo}`);
  }
  for (const id of noVerificados) await expect(page.getByTestId(`derecho-${id}`)).toHaveCount(0);

  // Todo lo que se muestra existe en la base y esta verificado.
  const mostrados = await page
    .locator('[data-testid^="derecho-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.replace(/^derecho-/, '')));
  expect(mostrados.length).toBe(verificados.length);
  for (const id of mostrados) expect(datos.get(id)?.verificado).toBe(true);

  // La cita despliega el texto literal y el enlace a la fuente oficial.
  const primero = page.getByTestId(`derecho-${verificados[0]}`);
  await primero.getByRole('button', { name: /Ver texto literal/ }).click();
  await expect(primero.getByRole('link', { name: /Ver texto oficial/ })).toBeVisible();

  test.info().annotations.push({
    type: 'observado',
    description: `Se muestran ${mostrados.length} derechos verificados: ${mostrados.join(', ')}.`,
  });
  await capturar(page, 'CA-07.3');
  await terminarMePararon(page);
});

test('CA-07.4 "Terminar" guarda el audio en el caso y se puede reproducir desde Mis casos', async ({ page }) => {
  await crearCuentaYEntrar(page);
  await tocarMePararon(page);
  await expect(page.getByTestId('tiempo-grabacion')).toHaveText('00:02', { timeout: 5_000 });
  const id = await terminarMePararon(page);

  // Se vuelve al inicio y se abre el caso desde el historial.
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await page.getByTestId('ir-casos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
  const fila = page.getByTestId(`caso-${id}`);
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('Abierto');
  await fila.getByRole('link').first().click();
  await expect(page.getByTestId('detalle-caso')).toBeVisible();

  const evidencia = page.getByTestId('evidencia-audio');
  await expect(evidencia).toHaveCount(1);
  await expect(evidencia).toContainText(fechaDeHoy());
  const audio = await leerAudio(page);
  expect(audio.src).toMatch(/^blob:/);
  expect(audio.tamano).toBeGreaterThan(0);
  expect(audio.tipo).toMatch(/^audio\//);
  expect(audio.listo).toBeGreaterThanOrEqual(1);
  test.info().annotations.push({
    type: 'observado',
    description: `Caso en Mis casos con audio ${audio.tipo} de ${audio.tamano} bytes, descifrado y cargado en el reproductor.`,
  });
  await capturar(page, 'CA-07.4');
});
