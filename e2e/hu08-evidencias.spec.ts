// HU-08 Agregar evidencias. La foto es un PNG generado en la prueba y la voz es simulada (utilidades.ts).
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  FIRMA_PNG_BASE64,
  FIRMA_WEBM_BASE64,
  fechaDeHoy,
  generarPNG,
  tocarMePararon,
  terminarMePararon,
} from './evidencias-comun';
import { capturar, crearCuentaYEntrar, leerIndexedDB, simularReconocimientoVoz } from './utilidades';

const NOTA_VOZ = 'El agente no me dejó grabar y no me mostró el equipo';
const NOTA_TEXTO = 'Testigo: el señor de la tienda de la esquina';

const HORA = /\d{1,2}:\d{2}\s?[ap]\.\s?m\./;

test.use({ permissions: ['microphone'] });

/** Cuenta nueva y un caso creado con "Me pararon"; termina en el detalle del caso. Devuelve su id. */
async function prepararCaso(page: Page): Promise<string> {
  await crearCuentaYEntrar(page);
  await tocarMePararon(page);
  await page.waitForTimeout(1200);
  return terminarMePararon(page);
}

/** Sale del caso y lo vuelve a abrir desde Mis casos: el detalle se lee otra vez de IndexedDB. */
async function reabrirCaso(page: Page, id: string): Promise<void> {
  await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
  await expect(page.getByTestId('detalle-caso')).toHaveCount(0);
  if (/\/inicio$/.test(new URL(page.url()).pathname)) await page.getByTestId('ir-casos').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mis casos' })).toBeVisible();
  await page.getByTestId(`caso-${id}`).getByRole('link').first().click();
  await expect(page.getByTestId('detalle-caso')).toBeVisible();
}

async function agregarFoto(page: Page): Promise<void> {
  const [selector] = await Promise.all([page.waitForEvent('filechooser'), page.getByTestId('boton-tomar-foto').click()]);
  await selector.setFiles({ name: 'foto-prueba.png', mimeType: 'image/png', buffer: generarPNG() });
  await expect(page.getByTestId('evidencia-foto')).toHaveCount(1, { timeout: 10_000 });
}

async function agregarNotaEscrita(page: Page, texto: string): Promise<void> {
  await page.getByTestId('boton-agregar-nota').click();
  await page.getByLabel('Tu nota', { exact: true }).fill(texto);
  await page.getByTestId('boton-guardar-nota').click();
  await expect(page.getByTestId('evidencia-nota').filter({ hasText: texto })).toBeVisible();
}

test('CA-08.1 una foto queda con fecha y hora y se ve su miniatura', async ({ page }) => {
  const id = await prepararCaso(page);
  await agregarFoto(page);
  const fechaAlAgregar = await page.getByTestId('evidencia-foto').getByTestId('fecha-evidencia').innerText();

  // Se comprueba despues de salir y volver a abrir el caso: la foto quedo guardada, no solo en pantalla.
  await reabrirCaso(page, id);
  const foto = page.getByTestId('lista-evidencias').getByTestId('evidencia-foto');
  await expect(foto).toHaveCount(1);
  await expect(foto).toContainText(fechaDeHoy());
  await expect(foto.getByTestId('fecha-evidencia')).toHaveText(HORA);
  await expect(foto.getByTestId('fecha-evidencia')).toHaveText(fechaAlAgregar);
  const miniatura = foto.getByTestId('miniatura-foto');
  await expect(miniatura).toBeVisible();
  // La miniatura es la imagen descifrada: 64 x 64 como la que se genero.
  const img = miniatura.locator('img');
  await expect(img).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(64);
  test.info().annotations.push({
    type: 'observado',
    description: `Foto con fecha "${await foto.getByTestId('fecha-evidencia').innerText()}" y miniatura de 64 x 64.`,
  });
  await capturar(page, 'CA-08.1');
});

test('CA-08.2 una nota dictada o escrita se guarda y se ve con fecha y hora', async ({ page }) => {
  await simularReconocimientoVoz(page, NOTA_VOZ);
  const id = await prepararCaso(page);

  // Por voz (simulada): el texto reconocido llena el campo y se guarda.
  await page.getByTestId('boton-agregar-nota').click();
  await page.getByTestId('boton-dictar-nota').click();
  await expect(page.getByLabel('Tu nota', { exact: true })).toHaveValue(NOTA_VOZ);
  await page.getByTestId('boton-guardar-nota').click();
  const notaVoz = page.getByTestId('evidencia-nota').filter({ hasText: NOTA_VOZ });
  await expect(notaVoz).toBeVisible();
  await expect(notaVoz).toContainText(fechaDeHoy());
  await expect(page.getByTestId('aviso-evidencia')).toHaveText('Nota guardada.');

  // Escrita.
  await agregarNotaEscrita(page, NOTA_TEXTO);
  const notaTexto = page.getByTestId('evidencia-nota').filter({ hasText: NOTA_TEXTO });
  await expect(notaTexto).toContainText(fechaDeHoy());
  await expect(page.getByTestId('evidencia-nota')).toHaveCount(2);

  // Las dos notas siguen en el caso al volver a abrirlo, con fecha y hora.
  await reabrirCaso(page, id);
  const notas = page.getByTestId('lista-evidencias').getByTestId('evidencia-nota');
  await expect(notas).toHaveCount(2);
  for (const texto of [NOTA_VOZ, NOTA_TEXTO]) {
    const nota = notas.filter({ hasText: texto });
    await expect(nota.getByTestId('texto-nota')).toHaveText(texto);
    await expect(nota.getByTestId('fecha-evidencia')).toContainText(fechaDeHoy());
    await expect(nota.getByTestId('fecha-evidencia')).toHaveText(HORA);
  }
  expect(await page.evaluate(() => (window as unknown as { __reconocimientoVoz: { lang: string } }).__reconocimientoVoz.lang)).toBe(
    'es-CO',
  );
  test.info().annotations.push({
    type: 'observado',
    description: 'Nota dictada (reconocimiento simulado, es-CO) y nota escrita, ambas con fecha y hora.',
  });
  await capturar(page, 'CA-08.2');
});

test('CA-08.3 en IndexedDB las evidencias están cifradas: sin texto ni imagen legible', async ({ page }) => {
  await prepararCaso(page);
  await agregarFoto(page);
  await agregarNotaEscrita(page, NOTA_TEXTO);
  await expect(page.getByTestId('evidencia-audio')).toHaveCount(1);

  const volcado = await leerIndexedDB(page);
  const evidencias = volcado.evidencias ?? [];
  // Audio y foto tienen contenido binario guardado; la nota va dentro del caso cifrado.
  expect(evidencias.length).toBe(2);
  expect((volcado.casos ?? []).length).toBe(1);

  const texto = JSON.stringify(volcado);
  expect(texto).not.toContain(NOTA_TEXTO);
  expect(texto).not.toContain('Testigo');
  expect(texto).not.toContain(FIRMA_PNG_BASE64);
  expect(texto).not.toContain(FIRMA_WEBM_BASE64);
  // Ni los metadatos de las evidencias (tipo, mime, fecha) quedan en claro en casos y evidencias.
  const casosYEvidencias = JSON.stringify({ casos: volcado.casos, evidencias });
  for (const dato of ['image/png', 'audio/', '"tipo"', '"mime"', '"creadaEn"']) expect(casosYEvidencias).not.toContain(dato);

  // Ademas se decodifica cada binario y se busca el contenido en claro.
  const binarios: Buffer[] = [];
  const recorrer = (v: unknown) => {
    if (typeof v === 'string' && v.length >= 16 && /^[A-Za-z0-9+/]+=*$/.test(v)) binarios.push(Buffer.from(v, 'base64'));
    else if (Array.isArray(v)) v.forEach(recorrer);
    else if (v && typeof v === 'object') Object.values(v).forEach(recorrer);
  };
  recorrer(volcado);
  expect(binarios.length).toBeGreaterThan(0);
  const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const firmaWebm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  for (const b of binarios) {
    expect(b.includes(firmaPng)).toBe(false);
    expect(b.includes(firmaWebm)).toBe(false);
    expect(b.toString('utf8')).not.toContain('Testigo');
    expect(b.toString('latin1')).not.toContain('IHDR');
  }

  // La app si las puede abrir con la clave de la sesion.
  await expect(page.getByTestId('miniatura-foto')).toBeVisible();
  await expect(page.getByTestId('evidencia-nota').filter({ hasText: NOTA_TEXTO })).toBeVisible();

  // Copia del volcado como evidencia para la evaluacion.
  const carpeta = path.join(__dirname, '..', 'evidencias');
  mkdirSync(carpeta, { recursive: true });
  const recorte = (v: unknown): unknown =>
    typeof v === 'string' && v.length > 120
      ? `${v.slice(0, 120)}… (${v.length} caracteres en base64)`
      : Array.isArray(v)
        ? v.map(recorte)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recorte(x)]))
          : v;
  writeFileSync(
    path.join(carpeta, 'CA-08.3-indexeddb.json'),
    JSON.stringify({ casos: recorte(volcado.casos), evidencias: recorte(evidencias) }, null, 2),
  );
  test.info().annotations.push({
    type: 'observado',
    description: `IndexedDB: 1 caso y ${evidencias.length} contenidos, solo id, iv y datos cifrados. No aparece el texto de la nota ni la firma PNG o webm.`,
  });
  await capturar(page, 'CA-08.3');
});
