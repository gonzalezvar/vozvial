// Ayudas compartidas por las pruebas de HU-07 y HU-08: imagen PNG de prueba y recorrido de "Me pararon".
import { expect, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

/** Firma de un PNG en base64: si aparece en IndexedDB, la imagen esta en claro. */
export const FIRMA_PNG_BASE64 = 'iVBORw0KGgo';
/** Firma EBML de un webm (1A 45 DF A3) en base64. */
export const FIRMA_WEBM_BASE64 = 'GkXfo';

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** PNG RGB de ancho x alto con un degradado, generado en la prueba (no es una foto real). */
export function generarPNG(ancho = 64, alto = 64): Buffer {
  const fila = 1 + ancho * 3;
  const crudo = Buffer.alloc(fila * alto);
  for (let y = 0; y < alto; y++) {
    crudo[y * fila] = 0;
    for (let x = 0; x < ancho; x++) {
      const i = y * fila + 1 + x * 3;
      crudo[i] = Math.round((x / ancho) * 255);
      crudo[i + 1] = 90;
      crudo[i + 2] = Math.round((y / alto) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo)),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

/** "8 de noviembre de 2026" en hora de Colombia, como lo muestra la app. */
export function fechaDeHoy(): string {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(),
  );
}

/** Desde /inicio: un toque en "Me pararon" y espera el indicador de grabacion. */
export async function tocarMePararon(page: Page): Promise<void> {
  await page.getByTestId('boton-me-pararon').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Me pararon' })).toBeVisible();
  await expect(page.getByTestId('indicador-grabando')).toBeVisible({ timeout: 10_000 });
}

/** Toca "Terminar" y espera el detalle del caso. Devuelve el id del caso. */
export async function terminarMePararon(page: Page): Promise<string> {
  await page.getByTestId('boton-terminar').click();
  await expect(page.getByTestId('detalle-caso')).toBeVisible({ timeout: 15_000 });
  const id = /\/casos\/([^/?#]+)/.exec(page.url())?.[1];
  expect(id).toBeTruthy();
  return id!;
}

/** Devuelve el contenido de un elemento audio del detalle: tamano y tipo del blob descifrado. */
export async function leerAudio(page: Page): Promise<{ src: string; tamano: number; tipo: string; listo: number }> {
  const reproductor = page.getByTestId('reproductor-audio');
  await expect(reproductor).toBeVisible({ timeout: 10_000 });
  return reproductor.evaluate(async (el: HTMLAudioElement) => {
    const blob = await fetch(el.src).then((r) => r.blob());
    // Espera a que el navegador lea los metadatos: asi se comprueba que el audio es reproducible.
    if (el.readyState < 1) {
      await new Promise<void>((ok) => {
        el.addEventListener('loadedmetadata', () => ok(), { once: true });
        el.addEventListener('error', () => ok(), { once: true });
        setTimeout(ok, 4000);
      });
    }
    return { src: el.src, tamano: blob.size, tipo: blob.type, listo: el.readyState };
  });
}
