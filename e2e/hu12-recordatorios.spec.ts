// HU-12 · Recordatorios de plazo. Son alertas dentro de la app al abrirla, no notificaciones push.
// La fecha del navegador se fija con page.clock antes de crear la cuenta. Tras registrar el comparendo
// se cierra y se vuelve a abrir la app (recarga + PIN), que es lo que dice el criterio.
import { expect, test } from '@playwright/test';

import { fijarFecha, reabrirApp, registrarManual, sinViolacionesSerias } from './comparendo-comun';
import { capturar, crearCuentaYEntrar, escribirPinYEntrar } from './utilidades';

const EN_VIA = { numero: '99000012345678', fecha: '13/11/2026', placa: 'TST123', codigo: 'C02', tipo: 'via' } as const;

test('CA-12.1 con 2 días hábiles o menos el inicio muestra una alerta que lleva al caso', async ({ page }) => {
  // Jueves 19 nov 2026: al comparendo del 13 nov (vence el lunes 23) le quedan el viernes 20 y el lunes 23.
  await fijarFecha(page, '2026-11-19');
  await crearCuentaYEntrar(page);
  await expect(page.getByTestId('alertas-plazo')).toHaveCount(0);
  const id = await registrarManual(page, EN_VIA);
  await reabrirApp(page, escribirPinYEntrar);

  const alerta = page.getByTestId(`alerta-plazo-${id}`);
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText('Tu plazo vence pronto');
  await expect(alerta).toContainText('Te quedan 2 días hábiles.');
  await expect(alerta).toContainText('lunes 23 de noviembre de 2026');
  await capturar(page, 'CA-12.1');
  await sinViolacionesSerias(page);

  await alerta.getByRole('link', { name: 'Ver el caso del comparendo 99000012345678' }).click();
  await expect(page).toHaveURL(new RegExp(`/casos/${id}$`));
  await expect(page.getByTestId('detalle-caso')).toBeVisible();
});

test('CA-12.2 el día límite la alerta dice "Hoy vence tu plazo para …"', async ({ page }) => {
  await fijarFecha(page, '2026-11-23');
  await crearCuentaYEntrar(page);
  const id = await registrarManual(page, EN_VIA);
  await reabrirApp(page, escribirPinYEntrar);

  const alerta = page.getByTestId(`alerta-plazo-${id}`);
  await expect(alerta).toContainText('Hoy vence tu plazo para presentarte ante la autoridad de tránsito');
  await expect(alerta).toContainText('Hoy, lunes 23 de noviembre de 2026, es el último día.');
  await capturar(page, 'CA-12.2');
});
