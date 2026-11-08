// HU-14 CA-14.4: borrar todos mis datos desde Ajustes, confirmando con el PIN.
import { devices, expect, test } from '@playwright/test';

import { capturar, crearCuentaCompleta, entrarConCelular, leerIndexedDB, volverAlInicio } from './utilidades';

test('CA-14.4 al borrar todo con el PIN la app vuelve a la bienvenida y no quedan datos ni en el navegador ni en el servidor', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  const cuenta = await crearCuentaCompleta(page);
  await page.getByTestId('boton-me-pararon').click();
  await page.getByTestId('boton-terminar').click();
  await expect.poll(async () => ((await leerIndexedDB(page)).casos ?? []).length, { timeout: 15_000 }).toBe(1);

  await expect(page.getByTestId('detalle-caso')).toBeVisible({ timeout: 15_000 });
  await volverAlInicio(page);
  await page.getByTestId('ir-ajustes').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeVisible();
  await page.getByRole('button', { name: 'Borrar todos mis datos', exact: true }).click();
  await expect(page.getByTestId('confirmar-borrado')).toContainText('No se puede deshacer');

  // Con un PIN equivocado no se borra nada.
  await page.getByLabel('Tu PIN para confirmar', { exact: true }).fill('000001');
  await page.getByRole('button', { name: 'Sí, borrar todos mis datos' }).click();
  await expect(page.getByText('El PIN no es correcto. No se borró nada.', { exact: true })).toBeVisible();
  expect(((await leerIndexedDB(page)).casos ?? []).length).toBe(1);

  await page.getByLabel('Tu PIN para confirmar', { exact: true }).fill(cuenta.pin);
  await capturar(page, 'CA-14.4-confirmar');
  await page.getByRole('button', { name: 'Sí, borrar todos mis datos' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/bienvenida$/);
  // IndexedDB vacio: ningun store tiene filas y no queda nada de la app en localStorage.
  const volcado = await leerIndexedDB(page);
  for (const [store, filas] of Object.entries(volcado)) expect(filas, `store ${store}`).toHaveLength(0);
  const claves = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('vozvial')));
  expect(claves).toEqual([]);
  await capturar(page, 'CA-14.4');

  // Al recargar sigue en la bienvenida: no hay cuenta en este navegador.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible();

  // Tampoco queda la cuenta en el servidor: desde otro navegador ya no se puede entrar.
  const otro = await browser.newContext({ ...devices['Pixel 7'], baseURL, locale: 'es-CO', timezoneId: 'America/Bogota' });
  try {
    const page2 = await otro.newPage();
    await entrarConCelular(page2, cuenta.celular, cuenta.pin);
    await expect(page2.getByText(/^El celular o el PIN no son correctos\./)).toBeVisible({ timeout: 15_000 });
    await expect(page2.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  } finally {
    await otro.close();
  }
});
