// Prueba de la infraestructura compartida (no corresponde a un criterio de aceptacion).
import { expect, test } from '@playwright/test';

import { CUENTA, crearCuentaYEntrar, escribirPinYEntrar, leerIndexedDB } from './utilidades';

test('infra: crea cuenta, entra, ve el nombre real y cierra por inactividad', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  const codigo = await crearCuentaYEntrar(page);
  expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
  await expect(page.getByTestId('marca-ejemplo')).toHaveCount(0);

  // En IndexedDB no queda ni el PIN, ni el nombre, ni el celular en claro.
  const volcado = JSON.stringify(await leerIndexedDB(page));
  expect(volcado).toContain('PBKDF2-SHA256');
  for (const dato of [CUENTA.pin, CUENTA.nombre, 'Rosa', CUENTA.celular]) expect(volcado).not.toContain(dato);

  // La actividad reinicia el contador (el build e2e usa 5 s de inactividad).
  await page.waitForTimeout(3000);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(3000);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();

  // Sin actividad se cierra la sesion y se vuelve a pedir el PIN.
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByTestId('aviso-inactividad')).toBeVisible();

  // Sin sesion, las pantallas internas mandan a "Entrar".
  await page.goto('/inicio');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();

  await escribirPinYEntrar(page, '000001');
  await expect(page.getByText('PIN incorrecto. Te quedan 4 intentos.')).toBeVisible();
  await escribirPinYEntrar(page);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();

  // Con cuenta pero sin sesion (recarga), la raiz lleva a "Entrar".
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await escribirPinYEntrar(page);
  await page.getByTestId('ir-casos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
  await expect(page.getByTestId('sin-casos')).toBeVisible();
  expect(errores).toEqual([]);
});
