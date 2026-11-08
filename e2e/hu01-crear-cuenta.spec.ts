// HU-01 Crear mi cuenta. Una prueba por criterio de aceptacion.
import { expect, test, type Page } from '@playwright/test';

import { espiarLecturaEnVoz, lecturas } from './asistente-comun';
import { iniciarServidorPrueba } from './hu01-servidor-prueba';
import { CUENTA, capturar, crearCuentaCompleta, leerIndexedDB, llenarRegistro } from './utilidades';

async function abrirRegistro(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('ir-registro').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Crear mi cuenta' })).toBeVisible();
}

async function tocarCrear(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
}

/** Sin cuenta creada, la raiz sigue llevando a la bienvenida. */
async function esperarSinCuenta(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'VozVial' })).toBeVisible();
}

test('CA-01.1 registro exitoso muestra el código de 12 caracteres, se puede escuchar y pide guardarlo', async ({ page }) => {
  await espiarLecturaEnVoz(page);
  await abrirRegistro(page);
  await llenarRegistro(page);
  await tocarCrear(page);

  await expect(page.getByRole('heading', { level: 1, name: 'Tu código de recuperación' })).toBeVisible({ timeout: 30_000 });
  const codigo = (await page.getByTestId('codigo-recuperacion').innerText()).trim();
  expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  expect(codigo.replace(/-/g, '')).toHaveLength(12);
  await expect(page.getByTestId('aviso-guardar-codigo')).toContainText('Guárdalo');

  await page.getByRole('button', { name: /^Escuchar el código/ }).click();
  // Se lee caracter por caracter: "A, B, C, D".
  await expect.poll(async () => (await lecturas(page)).map((l) => l.texto).join(' ')).toContain(
    codigo.slice(0, 4).split('').join(', '),
  );
  const lectura = (await lecturas(page)).at(-1);
  expect(lectura?.idioma).toBe('es-CO');
  for (const grupo of codigo.split('-')) expect(lectura?.texto).toContain(grupo.split('').join(', '));
  await capturar(page, 'CA-01.1');

  await page.getByRole('link', { name: /^Ya lo guardé/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
});

test('CA-01.2 un campo vacío se marca con mensaje claro, se lee en voz alta y no se crea la cuenta', async ({ page }) => {
  await espiarLecturaEnVoz(page);
  await abrirRegistro(page);
  await llenarRegistro(page, { nombre: '' });
  await tocarCrear(page);

  const nombre = page.getByTestId('campo-nombre');
  await expect(page.getByText('Escribe tu nombre.', { exact: true })).toBeVisible();
  await expect(nombre).toHaveAttribute('aria-invalid', 'true');
  // El foco queda en el primer campo con error.
  await expect(nombre).toBeFocused();
  await expect.poll(async () => (await lecturas(page)).map((l) => l.texto).join(' ')).toContain('Escribe tu nombre.');
  await expect(page.getByRole('heading', { level: 1, name: 'Crear mi cuenta' })).toBeVisible();
  await capturar(page, 'CA-01.2');

  // Tambien con todo vacio: cada campo muestra su mensaje.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Crear mi cuenta' })).toBeVisible();
  await tocarCrear(page);
  for (const mensaje of [
    'Escribe tu nombre.',
    'Escribe tu número de celular.',
    'Escribe un PIN de 6 números.',
    'Escribe tu PIN otra vez para confirmarlo.',
    'Para crear tu cuenta, marca que autorizas el tratamiento de tus datos.',
  ]) {
    await expect(page.getByText(mensaje, { exact: true })).toBeVisible();
  }
  await esperarSinCuenta(page);
});

test('CA-01.3 un celular que no tiene 10 dígitos o no empieza por 3 se rechaza', async ({ page }) => {
  await abrirRegistro(page);
  const mensaje = page.getByText('Escribe tu celular de 10 dígitos, por ejemplo 3001234567', { exact: true });

  for (const celular of ['300123456', '30012345678', '4001234567']) {
    await llenarRegistro(page, { celular });
    await tocarCrear(page);
    await expect(mensaje).toBeVisible();
    await expect(page.getByTestId('campo-celular')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('campo-celular')).toBeFocused();
    if (celular === '4001234567') await capturar(page, 'CA-01.3');
  }
  await esperarSinCuenta(page);
});

test('CA-01.4 el PIN se rechaza diciendo qué regla falló', async ({ page }) => {
  await abrirRegistro(page);
  const casos: { pin: string; confirmacion?: string; campo: string; mensaje: string }[] = [
    { pin: '12345', campo: 'campo-pin', mensaje: 'Tu PIN debe tener exactamente 6 números, sin letras ni espacios.' },
    { pin: '123456', campo: 'campo-pin', mensaje: 'Tu PIN no puede ser una secuencia como 123456 o 654321.' },
    { pin: '654321', campo: 'campo-pin', mensaje: 'Tu PIN no puede ser una secuencia como 123456 o 654321.' },
    { pin: '111111', campo: 'campo-pin', mensaje: 'Tu PIN no puede tener todos los números iguales, como 111111.' },
    {
      pin: CUENTA.pin,
      confirmacion: '482916',
      campo: 'campo-confirmacion',
      mensaje: 'La confirmación no es igual a tu PIN. Escríbelo otra vez.',
    },
  ];
  for (const c of casos) {
    await llenarRegistro(page, { pin: c.pin, confirmacion: c.confirmacion ?? c.pin });
    await tocarCrear(page);
    await expect(page.getByText(c.mensaje, { exact: true })).toBeVisible();
    await expect(page.getByTestId(c.campo)).toHaveAttribute('aria-invalid', 'true');
    if (c.pin === '123456') await capturar(page, 'CA-01.4');
  }
  await esperarSinCuenta(page);
});

test('CA-01.5 sin la autorización de datos no se crea la cuenta y se enlaza la política', async ({ page }) => {
  await abrirRegistro(page);
  await llenarRegistro(page, { autoriza: false });
  await tocarCrear(page);

  await expect(page.getByText('Para crear tu cuenta, marca que autorizas el tratamiento de tus datos.')).toBeVisible();
  const aviso = page.getByTestId('aviso-autorizacion');
  await expect(aviso).toContainText('Ley 1581 de 2012');
  await expect(page.getByRole('checkbox', { name: /Autorizo el tratamiento/ })).toBeFocused();
  await capturar(page, 'CA-01.5');

  await aviso.getByRole('link', { name: /Leer la política de datos/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Política de datos' })).toBeVisible();
  // La politica cita solo articulos verificados de la Ley 1581.
  await expect(page.getByTestId('ley-1581')).toContainText('Ley 1581 de 2012, artículo 9');
  await esperarSinCuenta(page);
});

test('CA-01.6 el PIN no queda en texto plano: ni en el navegador ni en la base del servidor', async ({ page }) => {
  // Las peticiones de cuentas y datos van a un servidor propio de esta prueba para poder leer sus tablas.
  const servidor = await iniciarServidorPrueba(page.context());
  const enviado: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) enviado.push(`${r.url()} ${r.postData() ?? ''}`);
  });
  try {
    const cuenta = await crearCuentaCompleta(page);
    const volcado = await leerIndexedDB(page);
    const cuentas = volcado.cuenta as { credencial: Record<string, unknown> }[];
    expect(cuentas).toHaveLength(1);
    const credencial = cuentas[0]!.credencial;
    expect(Object.keys(credencial).sort()).toEqual(['algoritmo', 'hash', 'iteraciones', 'sal']);
    expect(credencial.algoritmo).toBe('PBKDF2-SHA256');
    expect(typeof credencial.hash).toBe('string');
    expect(typeof credencial.sal).toBe('string');
    expect(credencial.iteraciones).toBeGreaterThan(0);

    const almacenamientoWeb = await page.evaluate(() => {
      const leer = (s: Storage) => Object.fromEntries(Object.keys(s).map((k) => [k, s.getItem(k)]));
      return JSON.stringify({ local: leer(localStorage), sesion: leer(sessionStorage), cookies: document.cookie });
    });
    const todo = JSON.stringify(volcado) + almacenamientoWeb;
    expect(todo).not.toContain(cuenta.pin);
    // Tampoco el nombre ni el celular quedan legibles en el navegador.
    expect(todo).not.toContain(cuenta.nombre);
    expect(todo).not.toContain(cuenta.celular);

    // En la base del servidor: una fila en "cuentas" con verificadores protegidos con scrypt.
    // El PIN, el codigo y el nombre no estan en ninguna tabla ni viajaron en ninguna peticion.
    const base = await servidor.volcar();
    expect(base.cuentas).toHaveLength(1);
    const fila = base.cuentas![0]!;
    expect(fila.celular).toBe(cuenta.celular);
    expect(String(fila.verificador_pin)).toMatch(/^scrypt\$/);
    expect(String(fila.verificador_codigo)).toMatch(/^scrypt\$/);
    const textoBase = JSON.stringify(base);
    const codigoLimpio = cuenta.codigo.replace(/-/g, '');
    for (const secreto of [cuenta.pin, cuenta.nombre, codigoLimpio, cuenta.codigo]) {
      expect(textoBase).not.toContain(secreto);
      expect(enviado.join('\n')).not.toContain(secreto);
    }

    // Evidencia visible: lo que guarda el navegador y la fila de la base, en la pagina.
    const resumenFila = {
      celular: fila.celular,
      verificador_pin: `${String(fila.verificador_pin).slice(0, 40)}…`,
      verificador_codigo: `${String(fila.verificador_codigo).slice(0, 40)}…`,
      clave_envuelta_pin: '{ iv, sal, iteraciones, datos } (cifrada)',
      perfil_cifrado: '{ iv, datos } (cifrado)',
    };
    await page.evaluate(
      ({ navegador, servidorTexto }) => {
        const pre = document.createElement('pre');
        pre.setAttribute('data-testid', 'volcado');
        pre.style.cssText =
          'position:fixed;inset:0;margin:0;padding:16px;background:#fff;color:#000;font-size:14px;white-space:pre-wrap;word-break:break-all;overflow:auto;z-index:99999';
        pre.textContent =
          'IndexedDB "vozvial", store "cuenta" (PIN usado: no aparece).\n' +
          'Build de pruebas: 1000 iteraciones para que corra rapido. La app publicada usa 600000.\n\n' +
          navegador +
          '\n\nBase del servidor, tabla "cuentas" (PIN, nombre y codigo: no aparecen en ninguna tabla).\n\n' +
          servidorTexto;
        document.body.appendChild(pre);
      },
      { navegador: JSON.stringify({ credencial }, null, 2), servidorTexto: JSON.stringify(resumenFila, null, 2) },
    );
    await capturar(page, 'CA-01.6');
  } finally {
    await servidor.cerrar();
  }
});
