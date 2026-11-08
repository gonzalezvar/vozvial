// HU-14 · Mis casos ordenados por urgencia. La fecha del navegador se fija con page.clock; los plazos
// salen de data/normativa/parametros.json igual que en HU-11.
import { expect, test } from '@playwright/test';

import { fijarFecha, irAlInicio, registrarManual, sinViolacionesSerias } from './comparendo-comun';
import { capturar, crearCuentaYEntrar } from './utilidades';

test('CA-14.1 Mis casos muestra primero el plazo más próximo, con estado y días restantes', async ({ page }) => {
  test.setTimeout(120_000);
  // Lunes 23 de noviembre de 2026.
  await fijarFecha(page, '2026-11-23');
  await crearCuentaYEntrar(page);

  // Se registran en un orden distinto al de urgencia, para que el orden no salga de la fecha de creación.
  const enTiempo = await registrarManual(page, { numero: '99000000000001', fecha: '20/11/2026', placa: 'TST001', codigo: 'C02', tipo: 'via' });
  await irAlInicio(page);
  const vencido = await registrarManual(page, { numero: '99000000000002', fecha: '30/10/2026', placa: 'TST002', codigo: 'C02', tipo: 'via' });
  await irAlInicio(page);
  const venceHoy = await registrarManual(page, { numero: '99000000000003', fecha: '13/11/2026', placa: 'TST003', codigo: 'C02', tipo: 'via' });
  await irAlInicio(page);

  await page.getByTestId('ir-casos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
  const lista = page.getByTestId('lista-casos');
  await expect(lista.getByRole('listitem')).toHaveCount(3);

  // Orden: el que vence hoy, el que tiene días por delante y al final el vencido.
  const orden = await lista
    .locator('[data-testid^="caso-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')!.replace(/^caso-/, '')));
  expect(orden).toEqual([venceHoy, enTiempo, vencido]);

  // Cada caso dice su estado y cuántos días le quedan (o que venció).
  for (const id of [venceHoy, enTiempo, vencido]) await expect(page.getByTestId(`caso-${id}`)).toContainText('Abierto');
  await expect(page.getByTestId(`plazo-${venceHoy}`)).toContainText('Hoy vence tu plazo para presentarte ante la autoridad de tránsito.');
  await expect(page.getByTestId(`plazo-${enTiempo}`)).toHaveText('Te quedan 4 días hábiles. Vence el viernes 27 de noviembre de 2026.');
  await expect(page.getByTestId(`plazo-${vencido}`)).toContainText('El plazo venció el');

  // El nombre accesible de cada fila también trae el estado y el plazo, para quien usa lector de pantalla.
  await expect(page.getByTestId(`caso-${enTiempo}`).getByRole('link')).toHaveAccessibleName(
    /^Abrir Comparendo 99000000000001\. Abierto\. Te quedan 4 días hábiles\./,
  );

  test.info().annotations.push({
    type: 'observado',
    description: 'Orden en pantalla: vence hoy, 4 días hábiles restantes y vencido; cada fila con estado "Abierto" y su plazo.',
  });
  await capturar(page, 'CA-14.1');
  await sinViolacionesSerias(page);

  // La fila entera abre el caso.
  await page.getByTestId(`caso-${venceHoy}`).getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/casos/${venceHoy}$`));
});
