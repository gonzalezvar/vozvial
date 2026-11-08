// HU-06 Respuestas con sustento. Las preguntas salen de data/preguntas-verificadas.json y de
// data/banco-evaluacion.json; lo esperado se lee de data/normativa, no se escribe a mano.
import { expect, test } from '@playwright/test';

import {
  abrirAsistente,
  entradaNormativa,
  esperarRespuestaApi,
  fechaLegible,
  preguntaBanco,
  preguntarEscribiendo,
  preguntaVerificada,
} from './asistente-comun';
import { capturar, crearCuentaYEntrar } from './utilidades';

const AVISO = 'VozVial informa y organiza. No reemplaza a un abogado.';
const AUDIENCIA = preguntaVerificada('PV-005');
const SIN_SUSTENTO = preguntaBanco('BE-041');
const FUERA_DE_TEMA = preguntaBanco('BE-051');

test('CA-06.1 la respuesta muestra norma, artículo y enlace, y al tocar la cita el texto literal y la fecha', async ({ page }) => {
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);
  const api = esperarRespuestaApi(page);
  await preguntarEscribiendo(page, AUDIENCIA.pregunta);
  const datos = await api;
  const claude = datos.modo === 'claude';

  // Modo verificado: respuesta y citas fijas. Con Claude: el texto y las citas que devolvio el servidor.
  expect(datos.tipo).toBe('respuesta');
  await expect(page.getByTestId('texto-respuesta')).toHaveText(claude ? datos.texto : AUDIENCIA.respuesta_sencilla);
  const ids = claude ? datos.citas.map((c) => c.id) : AUDIENCIA.citas;
  expect(ids.length).toBeGreaterThan(0);
  const citas = page.getByTestId('tarjeta-cita');
  await expect(citas).toHaveCount(ids.length);

  const entrada = entradaNormativa(ids[0]!);
  const tarjeta = citas.first();
  const encabezado = tarjeta.getByRole('button', { name: new RegExp(`^${entrada.norma}, artículo ${entrada.articulo}`) });
  await expect(encabezado).toBeVisible();
  await encabezado.click();

  await expect(tarjeta.getByText(entrada.texto_literal.slice(0, 80), { exact: false })).toBeVisible();
  await expect(tarjeta.getByText(`Consultado el ${fechaLegible(entrada.fecha_consulta)}.`)).toBeVisible();
  const enlace = tarjeta.getByRole('link', { name: /^Ver texto oficial/ });
  await expect(enlace).toBeVisible();
  test.info().annotations.push({
    type: 'observacion',
    description: claude
      ? 'El enlace al texto oficial aparece al tocar la cita. Respuesta redactada por Claude a partir de los artículos citados; las citas se validan contra la base.'
      : 'El enlace al texto oficial aparece al tocar la cita. Solo responde preguntas parecidas a las 49 verificadas: con otras palabras suele abstenerse (ver docs/evaluacion/asistente.md).',
  });
  await capturar(page, 'CA-06.1');

  // El enlace abre la URL oficial guardada en la base (se intercepta para no salir a internet).
  const hostOficial = new URL(entrada.url_fuente).host.replace(/\./g, '\\.');
  await page.context().route(new RegExp(hostOficial), (ruta) => ruta.fulfill({ status: 200, body: 'texto oficial' }));
  const [ventana] = await Promise.all([page.context().waitForEvent('page'), enlace.click()]);
  expect(ventana.url()).toBe(entrada.url_fuente);
  await ventana.close();
});

test('CA-06.2 sin sustento verificado se abstiene y sugiere dónde consultar', async ({ page }) => {
  expect(SIN_SUSTENTO.tipo).toBe('sin_sustento');
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);
  await preguntarEscribiendo(page, SIN_SUSTENTO.pregunta);

  await expect(page.getByTestId('texto-respuesta')).toHaveText('No tengo información verificada sobre eso.');
  await expect(page.getByTestId('sugerencia')).toContainText('organismo de tránsito');
  await expect(page.getByTestId('tarjeta-cita')).toHaveCount(0);
  await capturar(page, 'CA-06.2');
});

test('CA-06.3 una pregunta que no es de tránsito se declina explicando los temas cubiertos', async ({ page }) => {
  expect(FUERA_DE_TEMA.tipo).toBe('fuera_de_tema');
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);
  await preguntarEscribiendo(page, FUERA_DE_TEMA.pregunta);

  const texto = page.getByTestId('texto-respuesta');
  await expect(texto).toContainText('no parece ser de tránsito');
  await expect(texto).toContainText('Puedo ayudarte con comparendos');
  await expect(page.getByTestId('tarjeta-cita')).toHaveCount(0);
  await capturar(page, 'CA-06.3');
});

test('CA-06.4 toda respuesta trae el aviso legal', async ({ page }) => {
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);
  const respuesta = page.getByTestId('respuesta');

  for (const pregunta of [FUERA_DE_TEMA.pregunta, SIN_SUSTENTO.pregunta, AUDIENCIA.pregunta]) {
    await preguntarEscribiendo(page, pregunta);
    await expect(respuesta.getByTestId('aviso-legal')).toHaveText(AVISO);
  }
  await capturar(page, 'CA-06.4');
});

test('CA-06.5 sin internet avisa que el asistente necesita internet y ofrece lo que sí funciona', async ({ page, context }) => {
  await crearCuentaYEntrar(page);
  await context.setOffline(true);
  await abrirAsistente(page);

  const aviso = page.getByTestId('aviso-sin-conexion');
  await expect(aviso.getByRole('heading', { name: 'El asistente necesita internet' })).toBeVisible();
  for (const nombre of [/^Me pararon/, /^Mis casos y evidencias/, /^Registrar un comparendo/, /^Ver mis plazos/]) {
    await expect(aviso.getByRole('link', { name: nombre })).toBeVisible();
  }
  // Sin conexión no se ofrece un envío que va a fallar.
  await expect(page.getByTestId('campo-pregunta')).toHaveCount(0);
  test.info().annotations.push({ type: 'observacion', description: 'Vale con la app ya abierta antes de perder la conexión: no hay service worker, así que recargar sin internet no abre la app.' });
  await capturar(page, 'CA-06.5');

  // Los accesos funcionan sin conexión.
  await aviso.getByRole('link', { name: /^Mis casos y evidencias/ }).click();
  await expect(page).toHaveURL(/\/casos$/);

  // Al volver la conexión, el asistente vuelve a estar disponible.
  await page.goBack().catch(() => undefined);
  if (!/\/asistente$/.test(page.url())) {
    await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  }
  await context.setOffline(false);
  await expect(page.getByTestId('campo-pregunta')).toBeVisible();
});
