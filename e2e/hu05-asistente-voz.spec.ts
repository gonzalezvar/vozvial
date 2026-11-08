// HU-05 Preguntar hablando. El reconocimiento de voz y la lectura en voz alta se simulan
// (declarado): se verifica lo que la app hace con el texto reconocido y que pide leer en es-CO.
import { expect, test } from '@playwright/test';

import { abrirAsistente, esperarRespuestaApi, espiarLecturaEnVoz, lecturas, preguntaVerificada } from './asistente-comun';
import { capturar, crearCuentaYEntrar, simularReconocimientoVoz, sinReconocimientoVoz } from './utilidades';

const GRABAR = preguntaVerificada('PV-002');

test('CA-05.1 al terminar de hablar muestra lo que entendió con Enviar y Corregir', async ({ page }) => {
  await simularReconocimientoVoz(page, GRABAR.pregunta);
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);

  await page.getByRole('button', { name: /^Hablar/ }).click();
  const transcripcion = page.getByTestId('transcripcion');
  await expect(transcripcion.getByRole('heading', { name: 'Esto entendí' })).toBeVisible();
  await expect(page.getByTestId('texto-transcrito')).toHaveText(GRABAR.pregunta);
  await expect(transcripcion.getByRole('button', { name: 'Enviar la pregunta', exact: true })).toBeVisible();
  await expect(transcripcion.getByRole('button', { name: 'Corregir la pregunta' })).toBeVisible();
  // El reconocimiento se pidió en español de Colombia.
  const estado = await page.evaluate(() => (window as unknown as { __reconocimientoVoz: { lang: string } }).__reconocimientoVoz);
  expect(estado.lang).toBe('es-CO');
  await capturar(page, 'CA-05.1');

  // "Corregir" deja el texto en el campo para editarlo.
  await transcripcion.getByRole('button', { name: 'Corregir la pregunta' }).click();
  await expect(page.getByTestId('transcripcion')).toHaveCount(0);
  await expect(page.getByTestId('campo-pregunta')).toHaveValue(GRABAR.pregunta);

  // "Enviar" manda lo transcrito y llega la respuesta.
  await page.getByRole('button', { name: /^Hablar/ }).click();
  await page.getByTestId('transcripcion').getByRole('button', { name: 'Enviar la pregunta', exact: true }).click();
  await expect(page.getByTestId('respuesta')).toContainText(`Preguntaste: ${GRABAR.pregunta}`, { timeout: 20_000 });
});

test('CA-05.2 sin reconocimiento de voz o con el permiso negado se puede escribir y se explica por qué', async ({ page }) => {
  await sinReconocimientoVoz(page);
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);

  // Navegador sin reconocimiento de voz (como Firefox).
  const aviso = page.getByTestId('aviso-sin-voz');
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('Este navegador no puede reconocer la voz');
  await expect(page.getByTestId('boton-microfono')).toHaveCount(0);
  await expect(page.getByLabel('Escribe tu pregunta', { exact: true })).toBeVisible();
  await capturar(page, 'CA-05.2');

  // Permiso de micrófono negado: el reconocedor responde "not-allowed" al empezar.
  await page.evaluate(() => {
    class ReconocedorSinPermiso {
      lang = '';
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          this.onerror?.({ error: 'not-allowed' });
          this.onend?.();
        }, 20);
      }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: ReconocedorSinPermiso });
  });
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await abrirAsistente(page);
  await page.getByRole('button', { name: /^Hablar/ }).click();
  await expect(page.getByTestId('aviso-sin-voz')).toContainText('No diste permiso para usar el micrófono');
  await expect(page.getByLabel('Escribe tu pregunta', { exact: true })).toBeVisible();
  await capturar(page, 'CA-05.2-permiso-negado');

  // Permiso ya negado antes: se avisa apenas se abre el asistente, sin tocar "Hablar".
  await page.evaluate(() => {
    const consultaOriginal = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = ((descriptor: PermissionDescriptor) =>
      descriptor.name === ('microphone' as PermissionName)
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : consultaOriginal(descriptor)) as typeof navigator.permissions.query;
  });
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await abrirAsistente(page);
  await expect(page.getByTestId('aviso-sin-voz')).toContainText('No diste permiso para usar el micrófono');
  await expect(page.getByTestId('boton-microfono')).toHaveCount(0);
  await expect(page.getByLabel('Escribe tu pregunta', { exact: true })).toBeVisible();
});

test('CA-05.3 la respuesta verificada se lee en voz alta y se puede repetir', async ({ page }) => {
  await espiarLecturaEnVoz(page);
  await simularReconocimientoVoz(page, GRABAR.pregunta);
  await crearCuentaYEntrar(page);
  await abrirAsistente(page);

  await page.getByRole('button', { name: /^Hablar/ }).click();
  const api = esperarRespuestaApi(page);
  await page.getByTestId('transcripcion').getByRole('button', { name: 'Enviar la pregunta', exact: true }).click();
  const datos = await api;

  const respuesta = page.getByTestId('respuesta');
  // Modo verificado: la respuesta sencilla fija. Con Claude: el texto que devolvio el servidor, con la cita del art. 21.
  const esperado = datos.modo === 'claude' ? datos.texto : GRABAR.respuesta_sencilla;
  expect(datos.tipo).toBe('respuesta');
  expect(datos.citas.map((c) => c.id)).toContain('L1801-2016-art21');
  await expect(page.getByTestId('texto-respuesta')).toHaveText(esperado);
  // Respuesta corta, no el texto completo de la ley.
  expect(esperado.length).toBeLessThan(700);

  // Se pidió leerla en voz alta en español apenas llegó (verificación del llamado).
  await expect.poll(async () => (await lecturas(page)).length).toBeGreaterThan(0);
  const [primera] = await lecturas(page);
  expect(primera?.texto).toContain(esperado.slice(0, 60));
  expect(primera?.idioma).toMatch(/^es/);

  const repetir = respuesta.getByRole('button', { name: /^Repetir/ });
  await expect(repetir).toBeVisible();
  await capturar(page, 'CA-05.3');

  const antes = (await lecturas(page)).length;
  await repetir.click();
  await expect.poll(async () => (await lecturas(page)).length).toBe(antes + 1);
});
