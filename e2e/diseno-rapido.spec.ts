// Etapa 2 del ciclo de vida (diseno rapido): recorre los wireframes navegables en Pixel 7
// y guarda una captura por pantalla en docs/diseno-rapido/<nn>-<pantalla>.png.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CARPETA = path.join(__dirname, '..', 'docs', 'diseno-rapido');
mkdirSync(CARPETA, { recursive: true });

/** Captura la pantalla completa: alarga el viewport hasta el alto del contenido con scroll. */
async function capturar(page: Page, nombre: string) {
  await page.waitForTimeout(300);
  const viewport = page.viewportSize() ?? { width: 412, height: 915 };
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
  await page.setViewportSize({ width: viewport.width, height: Math.min(alto, 6000) });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(CARPETA, `${nombre}.png`) });
  await page.setViewportSize(viewport);
}

async function abrir(page: Page, ruta: string, titulo: string | RegExp) {
  await page.goto(ruta);
  await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
}

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  return errores;
}

test.describe('diseno rapido: wireframes navegables', () => {
  test('modulo 1: bienvenida, registro, codigo, entrar y recuperar', async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, '/', 'VozVial');
    await expect(page.getByText('VozVial informa y organiza. No reemplaza a un abogado.')).toBeVisible();
    await capturar(page, '01-bienvenida');

    await page.getByTestId('ir-registro').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Crear mi cuenta' })).toBeVisible();
    await capturar(page, '02-registro');
    await page.getByTestId('ver-errores').click();
    await expect(page.getByText('Escribe tu celular de 10 dígitos, por ejemplo 3001234567')).toBeVisible();
    await capturar(page, '03-registro-errores');

    await page.getByTestId('crear-cuenta').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tu código de recuperación' })).toBeVisible();
    await capturar(page, '04-codigo-recuperacion');

    await abrir(page, '/entrar', 'Entrar');
    await capturar(page, '05-entrar');
    await page.getByRole('radio', { name: 'Bloqueo temporal' }).click();
    await expect(page.getByTestId('bloqueo')).toBeVisible();
    await capturar(page, '06-entrar-bloqueo');

    await abrir(page, '/recuperar', 'Recuperar el acceso');
    await capturar(page, '07-recuperar');
    expect(errores).toEqual([]);
  });

  test('inicio y navegacion con accesos grandes', async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrir(page, '/inicio', /Hola/);
    await expect(page.getByTestId('boton-me-pararon')).toBeVisible();
    await capturar(page, '08-inicio');

    // Navegacion real: cada acceso abre su seccion y "Volver" regresa.
    const destinos: [string, string][] = [
      ['ir-asistente', 'Preguntar'],
      ['ir-casos', 'Mis casos'],
      ['ir-comparendo', 'Registrar un comparendo'],
      ['ir-ajustes', 'Ajustes'],
    ];
    for (const [id, titulo] of destinos) {
      await page.getByTestId(id).click();
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
      await page.getByRole('button', { name: 'Volver a la pantalla anterior' }).click();
      await expect(page.getByRole('heading', { level: 1, name: /Hola/ })).toBeVisible();
    }
    await page.getByTestId('boton-me-pararon').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Me pararon' })).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('modulo 2: ajustes con tamano de letra que se conserva', async ({ page }) => {
    await abrir(page, '/ajustes', 'Ajustes');
    await capturar(page, '09-ajustes');

    const muestra = page.getByTestId('muestra-letra');
    await expect(muestra).toHaveCSS('font-size', '18px');
    await page.getByRole('radio', { name: 'Muy grande' }).click();
    await expect(muestra).toHaveCSS('font-size', '26px');
    await capturar(page, '10-ajustes-muy-grande');

    // La eleccion vive en localStorage: al recargar sigue en "Muy grande".
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Muy grande' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('muestra-letra')).toHaveCSS('font-size', '26px');
    await abrir(page, '/inicio', /Hola/);
    await capturar(page, '11-inicio-muy-grande');
  });

  test('modulo 3: asistente con transcripcion, respuesta, cita y sin conexion', async ({ page }) => {
    await abrir(page, '/asistente', 'Preguntar');
    await capturar(page, '12-asistente');

    await page.getByTestId('boton-microfono').click();
    await expect(page.getByTestId('transcripcion')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Corregir la pregunta' })).toBeVisible();
    await capturar(page, '13-asistente-transcripcion');

    await page.getByRole('button', { name: 'Enviar la pregunta', exact: true }).click();
    await expect(page.getByTestId('respuesta')).toBeVisible();
    await page.getByTestId('tarjeta-cita').getByRole('button').first().click();
    await expect(page.getByText(/Consultado el 8 de noviembre de 2026/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Repetir/ })).toBeVisible();
    await capturar(page, '14-asistente-respuesta');

    await page.getByRole('radio', { name: 'Sin internet' }).click();
    await expect(page.getByText('El asistente necesita internet')).toBeVisible();
    await capturar(page, '15-asistente-sin-conexion');
  });

  test('modulo 4: me pararon y caso con evidencias', async ({ page }) => {
    await abrir(page, '/me-pararon', 'Me pararon');
    await expect(page.getByTestId('indicador-grabando')).toContainText('Grabando');
    await expect(page.getByText('Sin ubicación')).toBeVisible();
    await page.waitForTimeout(1200);
    await capturar(page, '16-me-pararon');

    await page.getByTestId('boton-terminar').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Caso de ejemplo 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Agregar nota' }).click();
    await capturar(page, '17-caso-evidencias');
  });

  test('modulo 5: comparendo, infraccion y plazos', async ({ page }) => {
    await abrir(page, '/comparendo/nuevo', 'Registrar un comparendo');
    await capturar(page, '18-comparendo-opciones');
    await page.getByTestId('comparendo-foto').click();
    await page.getByRole('radio', { name: 'Por fotomulta' }).click();
    await expect(page.getByText('Revisa este dato')).toBeVisible();
    await expect(page.getByText('¿Qué día recibiste la notificación?')).toBeVisible();
    await capturar(page, '19-comparendo-revision');

    await abrir(page, '/comparendo/ejemplo-1', 'Tu comparendo');
    await expect(page.getByText('Valor de referencia para AAAA según [fuente]. Confirma en SIMIT.')).toBeVisible();
    await capturar(page, '20-comparendo-detalle');
  });

  test('modulo 6: solicitud con dato faltante y vista previa', async ({ page }) => {
    await abrir(page, '/solicitud/ejemplo-1', 'Solicitud de audiencia');
    await expect(page.getByTestId('datos-faltantes')).toBeVisible();
    await capturar(page, '21-solicitud-faltantes');
    await page.getByLabel('Tu cédula').fill('1234567890');
    await page.getByTestId('generar-solicitud').click();
    await expect(page.getByTestId('vista-previa')).toBeVisible();
    await capturar(page, '22-solicitud-vista-previa');
  });

  test('modulo 7: mis casos ordenados por urgencia', async ({ page }) => {
    await abrir(page, '/casos', 'Mis casos');
    await expect(page.getByTestId('lista-casos').getByRole('listitem')).toHaveCount(3);
    await capturar(page, '23-mis-casos');
  });

  test('acerca del prototipo y politica de datos abren sin cuenta', async ({ page }) => {
    await abrir(page, '/bienvenida', 'VozVial');
    await page.getByRole('link', { name: 'Qué es real y qué es simulado' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Acerca del prototipo' })).toBeVisible();
    await expect(page.getByTestId('lista-real')).toBeVisible();
    await expect(page.getByTestId('lista-simulado')).toBeVisible();
    await capturar(page, '24-acerca');

    await abrir(page, '/registro', 'Crear mi cuenta');
    await page.getByRole('link', { name: 'Lee la política de datos en palabras sencillas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Política de datos' })).toBeVisible();
    await capturar(page, '25-privacidad');
  });

  test('cada pantalla tiene "Escuchar" y cambia a "Detener" mientras lee', async ({ page }) => {
    // speechSynthesis simulado: la lectura dura hasta que se cancela, para ver el estado "Detener".
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      class Enunciado {
        text = '';
        lang = '';
        rate = 1;
        onend: ((e: unknown) => void) | null = null;
        onerror: ((e: unknown) => void) | null = null;
        onstart: ((e: unknown) => void) | null = null;
      }
      let actual: Enunciado | null = null;
      w.SpeechSynthesisUtterance = Enunciado;
      w.__lecturas = [] as { text: string; lang: string }[];
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          speak(u: Enunciado) {
            actual = u;
            (w.__lecturas as { text: string; lang: string }[]).push({ text: u.text, lang: u.lang });
            u.onstart?.({});
          },
          cancel() {
            const u = actual;
            actual = null;
            u?.onerror?.({ error: 'interrupted' });
          },
          getVoices: () => [],
          speaking: false,
          pending: false,
          paused: false,
          pause() {},
          resume() {},
        },
      });
    });
    await abrir(page, '/inicio', /Hola/);
    const escuchar = page.getByRole('button', { name: /^Escuchar: leer en voz alta esta pantalla/ });
    await escuchar.click();
    const detener = page.getByRole('button', { name: /^Detener la lectura/ });
    await expect(detener).toBeVisible();
    const lecturas = await page.evaluate(() => (window as unknown as { __lecturas: { text: string; lang: string }[] }).__lecturas);
    expect(lecturas.at(-1)?.lang).toBe('es-CO');
    expect(lecturas.at(-1)?.text).toContain('Me pararon');
    await capturar(page, '26-escuchar-detener');
    await detener.click();
    await expect(page.getByRole('button', { name: /^Escuchar: leer en voz alta esta pantalla/ })).toBeVisible();
  });
});

test.describe('diseno rapido: chequeo rapido con axe', () => {
  const resumen: Record<string, { id: string; impacto: string | null; ayuda: string; nodos: number }[]> = {};

  for (const [ruta, titulo] of [
    ['/bienvenida', 'VozVial'],
    ['/inicio', /Hola/],
    ['/ajustes', 'Ajustes'],
    ['/registro', 'Crear mi cuenta'],
  ] as [string, string | RegExp][]) {
    test(`axe ${ruta} sin violaciones serias ni criticas`, async ({ page }) => {
      await abrir(page, ruta, titulo);
      const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      resumen[ruta] = resultado.violations.map((v) => ({ id: v.id, impacto: v.impact ?? null, ayuda: v.help, nodos: v.nodes.length }));
      const graves = resultado.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }

  test.afterAll(() => {
    writeFileSync(path.join(CARPETA, 'axe-resumen.json'), `${JSON.stringify(resumen, null, 2)}\n`);
  });
});
