// RNF-01 Privacidad: al servidor solo viaja el texto de la pregunta.
import { expect, test } from '@playwright/test';

import { abrirAsistente, preguntaVerificada } from './asistente-comun';
import { capturar, crearCuentaYEntrar, CUENTA, simularReconocimientoVoz } from './utilidades';

test('RNF-01 la peticion solo lleva el texto de la pregunta', async ({ page, baseURL }) => {
  const origen = new URL(baseURL ?? 'http://localhost').origin;
  const externas: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith(origen) && !url.startsWith('data:') && !url.startsWith('blob:')) externas.push(url);
  });

  const pregunta = preguntaVerificada('PV-002').pregunta;
  await simularReconocimientoVoz(page, pregunta);
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);

  // Pregunta hecha por voz: tampoco viaja audio, solo el texto reconocido.
  await page.getByRole('button', { name: /^Hablar/ }).click();
  const [peticion] = await Promise.all([
    page.waitForRequest('**/api/asistente'),
    page.getByTestId('transcripcion').getByRole('button', { name: 'Enviar la pregunta', exact: true }).click(),
  ]);
  await expect(page.getByTestId('respuesta')).toBeVisible();

  expect(peticion.method()).toBe('POST');
  expect(new URL(peticion.url()).origin).toBe(origen);
  const cuerpo = peticion.postData() ?? '';
  const json = JSON.parse(cuerpo) as Record<string, unknown>;
  expect(Object.keys(json)).toEqual(['pregunta']);
  expect(json.pregunta).toBe(pregunta);
  for (const dato of [CUENTA.nombre, CUENTA.celular, CUENTA.pin, CUENTA.cedula]) {
    expect(cuerpo).not.toContain(dato);
  }
  for (const campo of ['nombre', 'celular', 'ubicacion', 'latitud', 'longitud', 'audio']) {
    expect(cuerpo.toLowerCase()).not.toContain(`"${campo}"`);
  }
  // Sin cookies ni datos de la cuenta en la URL o en las cabeceras.
  const cabeceras = await peticion.allHeaders();
  expect(cabeceras.cookie).toBeUndefined();
  expect(peticion.url()).not.toContain(CUENTA.celular);

  // Ninguna petición a terceros (sin analítica ni scripts externos) durante todo el recorrido.
  expect(externas).toEqual([]);
  await capturar(page, 'RNF-01');
});
