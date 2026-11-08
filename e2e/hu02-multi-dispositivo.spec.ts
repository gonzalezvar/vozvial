// HU-02 en otro dispositivo: la cuenta y los casos viven cifrados en el servidor, asi que con el
// celular y el PIN se entra desde un navegador limpio y los casos aparecen.
import { devices, expect, test, type Page } from '@playwright/test';

import { capturar, crearCuentaCompleta, entrarConCelular, leerIndexedDB, volverAlInicio } from './utilidades';

/** Crea un caso con "Me pararon" -> "Terminar" y espera a que el servidor lo reciba. */
async function crearCasoYSubirlo(page: Page): Promise<void> {
  await page.getByTestId('boton-me-pararon').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Me pararon' })).toBeVisible();
  const subida = page.waitForResponse((r) => /\/api\/casos\/[^/?]+/.test(r.url()) && r.request().method() === 'PUT' && r.ok(), {
    timeout: 20_000,
  });
  await page.getByTestId('boton-terminar').click();
  await subida;
  await expect.poll(async () => ((await leerIndexedDB(page)).casos ?? []).length, { timeout: 15_000 }).toBe(1);
  // La copia queda "Al día" en Ajustes.
  await expect(page.getByTestId('detalle-caso')).toBeVisible({ timeout: 15_000 });
  await volverAlInicio(page);
  await page.getByTestId('ir-ajustes').click();
  await expect(page.getByTestId('estado-copia-etiqueta')).toHaveText('Al día', { timeout: 15_000 });
}

test('CA-02.1 en otro navegador limpio entro con mi celular y mi PIN y veo mis casos', async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const cuenta = await crearCuentaCompleta(page);
  await crearCasoYSubirlo(page);

  // Otro dispositivo: contexto nuevo, sin IndexedDB ni localStorage.
  const otro = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });
  try {
    const page2 = await otro.newPage();
    await page2.goto('/');
    // Sin cuenta en este navegador se ve la bienvenida.
    await expect(page2.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible();
    expect(((await leerIndexedDB(page2)).cuenta ?? []).length).toBe(0);

    // Con un PIN equivocado el servidor no deja entrar y dice cuantos intentos quedan.
    await entrarConCelular(page2, cuenta.celular, '000001');
    await expect(page2.getByText('El celular o el PIN no son correctos. Te quedan 4 intentos.', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await capturar(page2, 'CA-02.1-entrar-con-celular');

    await entrarConCelular(page2, cuenta.celular, cuenta.pin);
    await expect(page2.getByRole('heading', { level: 1, name: `Hola, ${cuenta.nombre}` })).toBeVisible({ timeout: 30_000 });
    await page2.getByTestId('ir-casos').click();
    await expect(page2.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
    const lista = page2.getByTestId('lista-casos').getByRole('listitem');
    await expect(lista).toHaveCount(1, { timeout: 15_000 });
    await capturar(page2, 'CA-02.1-otro-dispositivo');
    await lista.first().getByRole('link', { name: /^Abrir/ }).click();
    await expect(page2.getByTestId('detalle-caso')).toBeVisible();

    // En el navegador nuevo la cuenta quedo guardada cifrada: al volver solo pide el PIN.
    const volcado = JSON.stringify(await leerIndexedDB(page2));
    for (const dato of [cuenta.pin, cuenta.nombre, cuenta.celular]) expect(volcado).not.toContain(dato);
    await page2.goto('/');
    await expect(page2.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    await expect(page2.getByLabel('Tu PIN', { exact: true })).toBeVisible();
    await expect(page2.getByLabel('Tu celular', { exact: true })).toHaveCount(0);
  } finally {
    await otro.close();
  }
});
