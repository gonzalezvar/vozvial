// HU-03 Recuperar el acceso con el codigo de recuperacion.
import { expect, test, type Page } from '@playwright/test';

import { CUENTA, capturar, crearCuentaYEntrar, escribirPinYEntrar, leerIndexedDB } from './utilidades';

const PIN_NUEVO = '739164';

async function abrirRecuperar(page: Page): Promise<void> {
  // Recargar borra la sesion (vive solo en memoria), como si se hubiera olvidado el PIN.
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.getByRole('link', { name: 'Olvidé mi PIN' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Recuperar el acceso' })).toBeVisible();
}

async function llenarRecuperacion(page: Page, codigo: string, pin: string = PIN_NUEVO): Promise<void> {
  await page.getByLabel('Código de recuperación', { exact: true }).fill(codigo);
  await page.getByLabel('PIN nuevo', { exact: true }).fill(pin);
  await page.getByLabel('Escribe otra vez el PIN nuevo', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Cambiar PIN y entrar', exact: true }).click();
}

/** Un codigo con el formato correcto pero distinto del real. */
function codigoAjeno(real: string): string {
  const primera = real[0] === 'A' ? 'B' : 'A';
  return primera + real.slice(1);
}

test('CA-03.1 con el código correcto y un PIN nuevo entro y mis casos anteriores siguen ahí', async ({ page }) => {
  const codigo = await crearCuentaYEntrar(page);

  // Caso anterior: se crea con "Me pararon" -> "Terminar" (HU-07) y se espera a que quede guardado.
  await page.getByTestId('boton-me-pararon').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Me pararon' })).toBeVisible();
  await page.getByTestId('boton-terminar').click();
  await expect
    .poll(async () => ((await leerIndexedDB(page)).casos ?? []).length, {
      timeout: 15_000,
      message: 'Me pararon debe guardar un caso real en IndexedDB',
    })
    .toBe(1);

  await abrirRecuperar(page);
  // Se acepta con minusculas y sin guiones.
  await llenarRecuperacion(page, codigo.replace(/-/g, '').toLowerCase());
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('ir-casos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
  const lista = page.getByTestId('lista-casos').getByRole('listitem');
  await expect(lista).toHaveCount(1);
  await capturar(page, 'CA-03.1');
  await lista.first().getByRole('link', { name: /^Abrir/ }).click();
  await expect(page.getByTestId('detalle-caso')).toBeVisible();

  // Desde ahora vale el PIN nuevo y el anterior ya no.
  await page.goto('/');
  await escribirPinYEntrar(page, CUENTA.pin);
  await expect(page.getByText('PIN incorrecto. Te quedan 4 intentos.', { exact: true })).toBeVisible();
  await escribirPinYEntrar(page, PIN_NUEVO);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
});

test('CA-03.2 con un código incorrecto se rechaza y el PIN no cambia', async ({ page }) => {
  const codigo = await crearCuentaYEntrar(page);
  await abrirRecuperar(page);

  await llenarRecuperacion(page, codigoAjeno(codigo));
  const error = page.getByText('El código no es correcto. Revísalo letra por letra.', { exact: true });
  await expect(error).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('campo-codigo')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { level: 1, name: 'Recuperar el acceso' })).toBeVisible();
  // Lo escrito como PIN nuevo se borra.
  await expect(page.getByLabel('PIN nuevo', { exact: true })).toHaveValue('');
  await capturar(page, 'CA-03.2');

  // Un codigo con formato invalido tambien se rechaza.
  await llenarRecuperacion(page, 'ABC');
  await expect(page.getByText('El código tiene 12 letras y números. Revísalo.', { exact: true })).toBeVisible();

  // El PIN nuevo no quedo: sigue valiendo el original.
  await page.goto('/');
  await escribirPinYEntrar(page, PIN_NUEVO);
  await expect(page.getByText('PIN incorrecto. Te quedan 4 intentos.', { exact: true })).toBeVisible();
  await escribirPinYEntrar(page, CUENTA.pin);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
});
