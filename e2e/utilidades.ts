// Utilidades compartidas por las pruebas e2e: cuenta de prueba, capturas por criterio,
// recorrido de registro, volcado de IndexedDB y simulacion del reconocimiento de voz.
import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Datos de prueba. No son de una persona real. */
export const CUENTA = {
  nombre: 'Rosa Elena Prueba',
  celular: '3001234567',
  pin: '482915',
  cedula: '1012345678',
} as const;

export interface DatosCuentaPrueba {
  nombre: string;
  celular: string;
  pin: string;
}

export interface CuentaCreadaPrueba extends DatosCuentaPrueba {
  /** Codigo de recuperacion tal como se muestra ("ABCD-EFGH-JKMN"). */
  codigo: string;
}

let celularesUsados = 0;

/**
 * Celular de prueba distinto en cada llamada (10 digitos, empieza por 3). El servidor e2e es uno
 * solo para toda la corrida y no acepta dos cuentas con el mismo celular.
 */
export function celularUnico(): string {
  celularesUsados++;
  const marca = String(Date.now() % 1_000_000).padStart(6, '0');
  return `3${marca}${String((process.pid * 7 + celularesUsados) % 1000).padStart(3, '0')}`;
}

/**
 * CUENTA.celular se reemplaza por uno unico: varias pruebas crean "la misma" cuenta y cada una
 * necesita su propio registro en el servidor. Un celular distinto de CUENTA.celular se respeta.
 */
function conCelularPropio<T extends { celular: string }>(datos: T): T {
  return datos.celular === CUENTA.celular ? { ...datos, celular: celularUnico() } : datos;
}

const CARPETA_EVIDENCIAS = path.join(__dirname, '..', 'evidencias');

/**
 * Guarda evidencias/<id>.png con la pantalla completa. Las pantallas usan un ScrollView
 * interno, asi que fullPage no basta: se alarga el viewport hasta el alto del contenido
 * y luego se restaura.
 */
export async function capturar(page: Page, id: string): Promise<void> {
  mkdirSync(CARPETA_EVIDENCIAS, { recursive: true });
  await page.waitForTimeout(250);
  const viewport = page.viewportSize();
  const alto = await page.evaluate(() => {
    let maximo = document.documentElement.clientHeight;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('div'))) {
      const estilo = getComputedStyle(el);
      const visible = el.getBoundingClientRect().width > 0;
      if (visible && (estilo.overflowY === 'auto' || estilo.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        maximo = Math.max(maximo, el.scrollHeight);
      }
    }
    return maximo;
  });
  if (viewport && alto > viewport.height) {
    await page.setViewportSize({ width: viewport.width, height: Math.min(alto, 8000) });
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: path.join(CARPETA_EVIDENCIAS, `${id}.png`), fullPage: true });
  if (viewport) await page.setViewportSize(viewport);
}

/** Llena el formulario de registro sin enviarlo. Sirve para probar validaciones. */
export async function llenarRegistro(
  page: Page,
  datos: Partial<DatosCuentaPrueba> & { confirmacion?: string; autoriza?: boolean } = {},
): Promise<void> {
  const d = conCelularPropio({ ...CUENTA, confirmacion: datos.pin ?? CUENTA.pin, autoriza: true, ...datos });
  await page.getByLabel('Tu nombre', { exact: true }).fill(d.nombre);
  await page.getByLabel('Tu celular', { exact: true }).fill(d.celular);
  await page.getByLabel('Tu PIN', { exact: true }).fill(d.pin);
  await page.getByLabel('Escribe otra vez tu PIN', { exact: true }).fill(d.confirmacion);
  const casilla = page.getByRole('checkbox', { name: /Autorizo el tratamiento de mis datos/ });
  const marcada = (await casilla.getAttribute('aria-checked')) === 'true';
  if (marcada !== d.autoriza) await casilla.click();
}

/**
 * Recorre bienvenida y registro, crea la cuenta (en el dispositivo y en el servidor) y devuelve
 * los datos usados con el codigo de recuperacion. Termina en /inicio con la sesion iniciada.
 */
export async function crearCuentaCompleta(page: Page, datos: DatosCuentaPrueba = CUENTA): Promise<CuentaCreadaPrueba> {
  const d = conCelularPropio({ nombre: datos.nombre, celular: datos.celular, pin: datos.pin });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible();
  await page.getByTestId('ir-registro').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Crear mi cuenta' })).toBeVisible();
  await llenarRegistro(page, d);
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tu código de recuperación' })).toBeVisible({
    timeout: 30_000,
  });
  const codigo = ((await page.getByTestId('codigo-recuperacion').innerText()) ?? '').trim();
  await page.getByRole('link', { name: /^Ya lo guardé/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${d.nombre}` })).toBeVisible();
  return { ...d, codigo };
}

/** Como crearCuentaCompleta, pero devuelve solo el codigo de recuperacion (por ejemplo "ABCD-EFGH-JKMN"). */
export async function crearCuenta(page: Page, datos: DatosCuentaPrueba = CUENTA): Promise<string> {
  return (await crearCuentaCompleta(page, datos)).codigo;
}

/**
 * Entra en un navegador sin cuenta guardada (otro dispositivo): /entrar pide celular y PIN.
 * No espera el resultado.
 */
export async function entrarConCelular(page: Page, celular: string, pin: string = CUENTA.pin): Promise<void> {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.getByLabel('Tu celular', { exact: true }).fill(celular);
  await page.getByLabel('Tu PIN', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Deja la sesion iniciada en /inicio con una cuenta nueva. Devuelve el codigo de recuperacion. */
export async function crearCuentaYEntrar(page: Page, datos: DatosCuentaPrueba = CUENTA): Promise<string> {
  const codigo = await crearCuenta(page, datos);
  await expect(page).toHaveURL(/\/inicio$/);
  return codigo;
}

/** Escribe el PIN en /entrar y toca "Entrar". No espera el resultado. */
export async function escribirPinYEntrar(page: Page, pin: string = CUENTA.pin): Promise<void> {
  if (!/\/entrar$/.test(new URL(page.url()).pathname)) await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await page.getByLabel('Tu PIN', { exact: true }).fill(pin);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Vuelca todos los stores de la base "vozvial". Los binarios salen como texto base64. */
export async function leerIndexedDB(page: Page): Promise<Record<string, unknown[]>> {
  return page.evaluate(async () => {
    const aBase64 = (bytes: Uint8Array): string => {
      let binario = '';
      for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]!);
      return btoa(binario);
    };
    const limpiar = (valor: unknown): unknown => {
      if (valor instanceof ArrayBuffer) return aBase64(new Uint8Array(valor));
      if (ArrayBuffer.isView(valor)) return aBase64(new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength));
      if (valor instanceof Blob) return `[Blob ${valor.type} ${valor.size}]`;
      if (Array.isArray(valor)) return valor.map(limpiar);
      if (valor && typeof valor === 'object') {
        return Object.fromEntries(Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, limpiar(v)]));
      }
      return valor;
    };
    const db = await new Promise<IDBDatabase>((resolver, rechazar) => {
      const solicitud = indexedDB.open('vozvial');
      solicitud.onsuccess = () => resolver(solicitud.result);
      solicitud.onerror = () => rechazar(solicitud.error);
    });
    const salida: Record<string, unknown[]> = {};
    for (const nombre of Array.from(db.objectStoreNames)) {
      const valores = await new Promise<unknown[]>((resolver, rechazar) => {
        const solicitud = db.transaction(nombre, 'readonly').objectStore(nombre).getAll();
        solicitud.onsuccess = () => resolver(solicitud.result as unknown[]);
        solicitud.onerror = () => rechazar(solicitud.error);
      });
      salida[nombre] = valores.map(limpiar);
    }
    db.close();
    return salida;
  });
}

/**
 * SIMULACION declarada: reemplaza SpeechRecognition por uno falso que, al llamar start(),
 * entrega la frase como resultado final y termina. La voz real se muestra en el video.
 * Se puede llamar otra vez en la misma prueba para cambiar la frase.
 * Deja en window.__reconocimientoVoz el idioma pedido y cuantas veces se inicio.
 */
export async function simularReconocimientoVoz(page: Page, frase: string): Promise<void> {
  await page.addInitScript((fraseInicial: string) => {
    const w = window as unknown as Record<string, unknown>;
    w.__fraseVoz = fraseInicial;
    w.__reconocimientoVoz = { lang: null as string | null, inicios: 0 };

    type Manejador = ((evento: unknown) => void) | null;
    class ReconocimientoFalso {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      onstart: Manejador = null;
      onaudiostart: Manejador = null;
      onspeechstart: Manejador = null;
      onresult: Manejador = null;
      onspeechend: Manejador = null;
      onerror: Manejador = null;
      onend: Manejador = null;
      private oyentes: Record<string, ((evento: unknown) => void)[]> = {};
      private activo = false;

      addEventListener(tipo: string, fn: (evento: unknown) => void) {
        (this.oyentes[tipo] ??= []).push(fn);
      }
      removeEventListener(tipo: string, fn: (evento: unknown) => void) {
        this.oyentes[tipo] = (this.oyentes[tipo] ?? []).filter((f) => f !== fn);
      }
      private emitir(tipo: string, evento: Record<string, unknown> = {}) {
        const e = { type: tipo, ...evento };
        const propio = (this as unknown as Record<string, Manejador>)[`on${tipo}`];
        propio?.call(this, e);
        for (const fn of this.oyentes[tipo] ?? []) fn.call(this, e);
      }
      start() {
        const estado = w.__reconocimientoVoz as { lang: string | null; inicios: number };
        estado.lang = this.lang;
        estado.inicios += 1;
        this.activo = true;
        const texto = String(w.__fraseVoz ?? '');
        setTimeout(() => this.emitir('start'), 10);
        setTimeout(() => this.emitir('audiostart'), 20);
        setTimeout(() => {
          if (!this.activo) return;
          const alternativa = { transcript: texto, confidence: 0.92 };
          const resultado = Object.assign([alternativa], { isFinal: true, item: () => alternativa });
          const resultados = Object.assign([resultado], { item: () => resultado });
          this.emitir('result', { resultIndex: 0, results: resultados });
        }, 300);
        setTimeout(() => {
          if (!this.activo) return;
          this.activo = false;
          this.emitir('speechend');
          this.emitir('end');
        }, 400);
      }
      stop() {
        if (!this.activo) return;
        this.activo = false;
        setTimeout(() => this.emitir('end'), 10);
      }
      abort() {
        this.stop();
      }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, writable: true, value: ReconocimientoFalso });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      configurable: true,
      writable: true,
      value: ReconocimientoFalso,
    });
  }, frase);
  // Si la pagina ya cargo, se cambia la frase sin recargar.
  await page.evaluate((f) => ((window as unknown as Record<string, unknown>).__fraseVoz = f), frase).catch(() => undefined);
}

/** Simula un navegador sin reconocimiento de voz (por ejemplo Firefox). */
export async function sinReconocimientoVoz(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const nombre of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      try {
        delete (window as unknown as Record<string, unknown>)[nombre];
      } catch {
        // Si no se puede borrar, se tapa abajo.
      }
      if (nombre in window) {
        Object.defineProperty(window, nombre, { configurable: true, writable: true, value: undefined });
      }
    }
  });
}

/**
 * Vuelve al inicio sin recargar (recargar cierra la sesion): toca "Volver" hasta ver el saludo.
 */
export async function volverAlInicio(page: Page): Promise<void> {
  const saludo = page.getByRole('heading', { level: 1, name: /^Hola, / });
  for (let i = 0; i < 5 && !(await saludo.isVisible()); i++) {
    await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
    await page.waitForTimeout(300);
  }
  await expect(saludo).toBeVisible();
}
