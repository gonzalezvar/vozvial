// HU-10 · Entender mi infracción. Los textos salen de data/infracciones.json y de la base normativa verificada.
import { expect, test } from '@playwright/test';

import { fijarFecha, registrarManual, sinViolacionesSerias } from './comparendo-comun';
import { capturar, crearCuentaYEntrar } from './utilidades';

const C02 = { numero: '99000012345678', fecha: '13/11/2026', placa: 'TST123', codigo: 'C02', tipo: 'via' } as const;

test('CA-10.1 el detalle explica la infracción en palabras sencillas, con su artículo y el texto literal desplegable', async ({
  page,
}) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await registrarManual(page, C02);

  const tarjeta = page.getByTestId('significado-infraccion');
  await expect(page.getByTestId('descripcion-sencilla')).toHaveText('Parquear en un sitio prohibido.');
  await expect(page.getByTestId('articulo-infraccion')).toContainText('Artículo 131 de la Ley 769 de 2002, literal C, numeral 2');
  await expect(page.getByTestId('texto-literal')).toHaveCount(0);

  await tarjeta.getByRole('button', { name: 'Ver el texto de la ley, tal como está escrito' }).click();
  await expect(page.getByTestId('texto-literal')).toContainText('Estacionar un vehículo en sitios prohibidos.');
  // La cita del articulo trae el texto oficial con su fecha de consulta.
  await tarjeta.getByRole('button', { name: /Ley 769 de 2002, artículo 131/ }).click();
  await expect(tarjeta.getByText(/Consultado el 8 de noviembre de 2026/)).toBeVisible();
  await capturar(page, 'CA-10.1');
  await sinViolacionesSerias(page);
});

test('CA-10.2 el valor aparece con su unidad, su vigencia y su fuente', async ({ page }) => {
  await fijarFecha(page, '2026-11-13');
  await crearCuentaYEntrar(page);
  await registrarManual(page, C02);

  const valor = page.getByTestId('valor-referencia');
  // data/infracciones.json no tiene valor en pesos verificado (valor_referencia: null en todas):
  // se muestra la sancion en su unidad legal, su fuente y la fecha del texto vigente.
  await expect(valor).toContainText('15 SMDLV (salarios mínimos diarios legales vigentes)');
  await expect(page.getByTestId('fuente-valor')).toHaveText(
    'Fuente: el artículo 131 de la Ley 769 de 2002, texto vigente consultado el domingo 8 de noviembre de 2026.',
  );
  await expect(page.getByTestId('sin-valor-pesos')).toContainText('no tiene verificado el valor en pesos');
  await expect(valor).toContainText('Confirma el valor en SIMIT.');
  test.info().annotations.push({
    type: 'parcial',
    description:
      'No aparece un valor en pesos con su año: ninguna infracción tiene valor_referencia verificado y la UVB 2026 está en verificado:false. La app muestra la sanción en SMDLV, la fuente con su fecha de consulta y remite a SIMIT.',
  });
  await capturar(page, 'CA-10.2');
});
