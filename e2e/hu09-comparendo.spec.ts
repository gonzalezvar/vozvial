// HU-09 · Registrar el comparendo con una foto.
// La fecha del navegador se fija en el 13 nov 2026 porque la app no acepta infracciones con fecha futura.
// Las fotos son imagenes sinteticas con datos ficticios (scripts/generar-fixture-comparendo.py).
// El OCR es real: tesseract.js autoalojado en public/tesseract corre en el navegador de la prueba.
import { expect, test, type Page } from '@playwright/test';

import {
  abrirRegistroManual,
  fijarFecha,
  FIXTURE_BORROSO,
  FIXTURE_LEGIBLE,
  llenarManual,
  registrarManual,
  sinViolacionesSerias,
} from './comparendo-comun';
import { capturar, crearCuentaYEntrar } from './utilidades';

async function subirFoto(page: Page, archivo: string): Promise<void> {
  await page.getByTestId('ir-comparendo').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Registrar un comparendo' })).toBeVisible();
  const [selector] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /^Tomar foto del comparendo/ }).click(),
  ]);
  await selector.setFiles(archivo);
  // El lector muestra su avance y luego el formulario con lo leido.
  await expect(page.getByTestId('formulario-comparendo')).toBeVisible({ timeout: 90_000 });
}

test('CA-09.1 la foto legible llena número, fecha, placa y código', async ({ page }) => {
  test.setTimeout(150_000);
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await subirFoto(page, FIXTURE_LEGIBLE);

  await expect(page.getByLabel('Número del comparendo', { exact: true })).toHaveValue('99000012345678');
  await expect(page.getByLabel('Fecha de la infracción', { exact: true })).toHaveValue('13/11/2026');
  await expect(page.getByLabel('Placa', { exact: true })).toHaveValue('TST123');
  await expect(page.getByLabel('Código de la infracción', { exact: true })).toHaveValue('C29');
  await expect(page.getByText('Revisa este dato')).toHaveCount(0);
  await capturar(page, 'CA-09.1');

  // Con el tipo elegido se guarda sin escribir nada mas.
  await page.getByRole('radio', { name: 'En la vía' }).click();
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tu comparendo' })).toBeVisible();
  await expect(page.getByTestId('datos-comparendo')).toContainText('99000012345678');
});

test('CA-09.2 el dato con baja confianza se resalta y no se guarda sin confirmarlo', async ({ page }) => {
  test.setTimeout(150_000);
  // Baja confianza forzada de forma honesta: la imagen tiene la placa manchada (no se cambia el umbral).
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await subirFoto(page, FIXTURE_BORROSO);

  const placa = page.getByLabel('Placa', { exact: true });
  await expect(page.getByText('Revisa este dato')).toHaveCount(1);
  await expect(placa).toHaveAttribute('aria-describedby', /dudoso/);
  // Los datos legibles si se llenaron.
  await expect(page.getByLabel('Número del comparendo', { exact: true })).toHaveValue('99000012345678');

  await page.getByRole('radio', { name: 'En la vía' }).click();
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByTestId('error-guardar')).toContainText('revisa los datos marcados con “Revisa este dato”');
  await expect(page).toHaveURL(/\/comparendo\/nuevo/);
  await capturar(page, 'CA-09.2');
  await sinViolacionesSerias(page);

  // Cambiar a "Escribir los datos" no borra la marca: lo leido sigue sin confirmar.
  await page.getByRole('button', { name: 'Escribir los datos del comparendo a mano' }).click();
  await expect(page.getByText('Revisa este dato')).toHaveCount(1);
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByTestId('error-guardar')).toContainText('revisa los datos marcados con “Revisa este dato”');
  await expect(page).toHaveURL(/\/comparendo\/nuevo/);

  // Corrige la placa y confirma: ahora si se guarda.
  await placa.fill('TST123');
  await page.getByRole('checkbox', { name: 'Ya revisé la placa y está bien' }).click();
  await expect(page.getByText('Revisa este dato')).toHaveCount(0);
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tu comparendo' })).toBeVisible();
  await expect(page.getByTestId('datos-comparendo')).toContainText('Placa: TST123');
});

test('CA-09.3 un código que no está en el catálogo se rechaza', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await abrirRegistroManual(page);
  await llenarManual(page, { numero: '99000012345678', fecha: '13/11/2026', placa: 'TST123', codigo: 'C99', tipo: 'via' });
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByText('Ese código no aparece en el Código de Tránsito. Revísalo.')).toBeVisible();
  await expect(page).toHaveURL(/\/comparendo\/nuevo/);
  await capturar(page, 'CA-09.3');

  // No se creo ningun caso.
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await page.getByTestId('ir-casos').click();
  await expect(page.getByTestId('sin-casos')).toBeVisible();
});

test('CA-09.4 "Escribir los datos" registra el comparendo a mano', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  const id = await registrarManual(page, {
    numero: '99000012345678',
    fecha: '13/11/2026',
    placa: 'TST123',
    codigo: 'C02',
    tipo: 'via',
  });
  const datos = page.getByTestId('datos-comparendo');
  await expect(datos).toContainText('Número: 99000012345678');
  await expect(datos).toContainText('Fecha de la infracción: 13/11/2026');
  await expect(datos).toContainText('Placa: TST123');
  await expect(datos).toContainText('Código: C02');
  await capturar(page, 'CA-09.4');

  // Queda guardado en "Mis casos" igual que uno leido con foto.
  await page.getByRole('link', { name: 'Ver el caso completo' }).click();
  await expect(page).toHaveURL(new RegExp(`/casos/${id}$`));
  await expect(page.getByTestId('seccion-comparendo')).toContainText('99000012345678');
});
