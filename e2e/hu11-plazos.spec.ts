// HU-11 · Saber hasta cuándo puedo actuar. Los días y su punto de partida salen de data/normativa/parametros.json;
// si esos parámetros cambian o dejan de estar verificados, estas pruebas fallan a propósito.
// La fecha del navegador se fija con page.clock (la app usa un reloj inyectable que lee Date).
import { expect, test } from '@playwright/test';

import { abrirRegistroManual, fijarFecha, llenarManual, registrarManual, sinViolacionesSerias } from './comparendo-comun';
import { capturar, crearCuentaYEntrar, escribirPinYEntrar } from './utilidades';

test('CA-11.1 comparendo en vía del viernes 13 nov 2026: fecha límite lunes 23 nov 2026', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await registrarManual(page, { numero: '99000012345678', fecha: '13/11/2026', placa: 'TST123', codigo: 'C02', tipo: 'via' });

  await expect(page.getByTestId('fecha-limite')).toHaveText('Tu fecha límite es el lunes 23 de noviembre de 2026.');
  const explicacion = page.getByTestId('explicacion-plazo');
  await expect(explicacion).toContainText('Contamos desde el día siguiente al comparendo');
  await expect(explicacion).toContainText('Sumamos 5 días hábiles');
  await expect(explicacion).toContainText('lunes 16 de noviembre de 2026');
  await page.getByRole('button', { name: /^¿De dónde sale este plazo\?/ }).click();
  await expect(page.getByRole('button', { name: /Ley 769 de 2002, artículo 135/ })).toBeVisible();
  test.info().annotations.push({ type: 'observacion', description: 'La prueba fija el reloj en el 13 nov 2026. La app no acepta fechas futuras, así que a mano solo se reproduce desde ese día.' });
  await capturar(page, 'CA-11.1');
});

test('CA-11.2 fotodetección notificada el viernes 13 nov 2026: fecha límite martes 1 dic 2026', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await registrarManual(page, {
    numero: '99000012345679',
    fecha: '05/11/2026',
    placa: 'TST123',
    codigo: 'C29',
    tipo: 'fotodeteccion',
    notificacion: '13/11/2026',
  });

  await expect(page.getByTestId('fecha-limite')).toHaveText('Tu fecha límite es el martes 1 de diciembre de 2026.');
  await expect(page.getByTestId('explicacion-plazo')).toContainText('Sumamos 11 días hábiles');
  await page.getByRole('button', { name: /^¿De dónde sale este plazo\?/ }).click();
  await expect(page.getByRole('button', { name: /Ley 1843 de 2017, artículo 8/ })).toBeVisible();
  test.info().annotations.push({ type: 'observacion', description: 'La prueba fija el reloj en el 13 nov 2026. La app no acepta fechas futuras, así que a mano solo se reproduce desde ese día.' });
  await capturar(page, 'CA-11.2');
});

test('CA-11.3 en fotodetección se pregunta la fecha de la notificación y el cálculo dice qué fecha usó', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await abrirRegistroManual(page);
  await expect(page.getByText('¿Qué día recibiste la notificación?')).toHaveCount(0);
  await llenarManual(page, {
    numero: '99000012345679',
    fecha: '05/11/2026',
    placa: 'TST123',
    codigo: 'C29',
    tipo: 'fotodeteccion',
    notificacion: '',
  });
  const pregunta = page.getByTestId('pregunta-notificacion');
  await expect(pregunta).toContainText('¿Qué día recibiste la notificación?');
  await expect(pregunta).toContainText('No es el día de la infracción.');
  await expect(pregunta).toContainText('Tu plazo se cuenta desde ese día.');

  // Sin esa fecha no se guarda.
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByText('Escribe el día en que recibiste la notificación, por ejemplo 13/11/2026.')).toBeVisible();
  await capturar(page, 'CA-11.3');
  await sinViolacionesSerias(page);

  await page.getByLabel('¿Qué día recibiste la notificación?', { exact: true }).fill('13/11/2026');
  await page.getByRole('button', { name: 'Guardar el comparendo' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tu comparendo' })).toBeVisible();
  await expect(page.getByTestId('explicacion-plazo')).toContainText(
    'usamos la fecha en que recibiste la notificación, viernes 13 de noviembre de 2026',
  );
  await capturar(page, 'CA-11.3-calculo');
});

test('CA-11.4 el caso muestra los días hábiles restantes o que el plazo venció', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  const id = await registrarManual(page, {
    numero: '99000012345678',
    fecha: '13/11/2026',
    placa: 'TST123',
    codigo: 'C02',
    tipo: 'via',
  });
  await expect(page.getByTestId('dias-restantes')).toContainText('Te quedan 5 días hábiles');

  // En "Mis casos" y en el detalle del caso tambien se ve.
  await page.getByRole('link', { name: 'Ver el caso completo' }).click();
  await expect(page.getByTestId(`plazo-${id}`)).toContainText('Te quedan 5 días hábiles.');
  await capturar(page, 'CA-11.4');

  // Despues del dia limite se dice que vencio. Cambiar la fecha cierra la sesion por inactividad: se vuelve a entrar.
  await fijarFecha(page, '2026-11-24');
  await page.goto('/entrar');
  await escribirPinYEntrar(page);
  await page.getByTestId('ir-casos').click();
  await expect(page.getByTestId(`plazo-${id}`)).toHaveText('El plazo venció el lunes 23 de noviembre de 2026.');
  // Al abrir el caso tambien se ve que vencio.
  await page.getByTestId(`caso-${id}`).getByRole('link', { name: /^Abrir/ }).click();
  await expect(page).toHaveURL(new RegExp(`/casos/${id}$`));
  await expect(page.getByTestId('seccion-comparendo').getByTestId(`plazo-${id}`)).toHaveText(
    'El plazo venció el lunes 23 de noviembre de 2026.',
  );
  await capturar(page, 'CA-11.4-vencido');
});
