// HU-02 Entrar con mi PIN. El build e2e usa bloqueo de 3 s e inactividad de 5 s (scripts/build-e2e.sh).
import { expect, test, type Page } from '@playwright/test';

import { CUENTA, capturar, crearCuentaYEntrar, escribirPinYEntrar } from './utilidades';

/** La sesion vive solo en memoria: recargar obliga a entrar de nuevo con el PIN. */
async function cerrarRecargando(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
}

test('CA-02.1 con el PIN correcto entro y veo mi nombre en el inicio', async ({ page }) => {
  await crearCuentaYEntrar(page);
  await cerrarRecargando(page);
  await escribirPinYEntrar(page, CUENTA.pin);
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
  await capturar(page, 'CA-02.1');
});

test('CA-02.2 con un PIN incorrecto no entro y me dice cuántos intentos quedan', async ({ page }) => {
  await crearCuentaYEntrar(page);
  await cerrarRecargando(page);

  await escribirPinYEntrar(page, '000001');
  const alerta = page.getByRole('alert').filter({ hasText: 'PIN incorrecto. Te quedan 4 intentos.' });
  await expect(alerta).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);
  await capturar(page, 'CA-02.2');

  // Un PIN incompleto se avisa sin gastar un intento.
  await escribirPinYEntrar(page, '123');
  await expect(page.getByText('Tu PIN tiene 6 números. Escríbelo completo.', { exact: true })).toBeVisible();

  await escribirPinYEntrar(page, '000002');
  await expect(page.getByText('PIN incorrecto. Te quedan 3 intentos.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
});

test('CA-02.3 tras 5 fallos seguidos se bloquea con un contador visible del tiempo restante', async ({ page }) => {
  await crearCuentaYEntrar(page);
  await cerrarRecargando(page);

  for (let i = 1; i <= 4; i++) {
    await escribirPinYEntrar(page, `00000${i}`);
    await expect(page.getByText(`PIN incorrecto. Te quedan ${5 - i} intento${5 - i === 1 ? '' : 's'}.`)).toBeVisible();
  }
  await escribirPinYEntrar(page, '000005');

  const bloqueo = page.getByTestId('bloqueo');
  await expect(bloqueo).toBeVisible();
  await expect(bloqueo).toHaveAttribute('role', 'alert');
  // Recargar la pagina no quita el bloqueo: queda guardado en el navegador.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await expect(bloqueo).toBeVisible();
  const contador = page.getByTestId('tiempo-bloqueo');
  await expect(contador).toHaveText(/^0:0[1-3]$/);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled();
  await capturar(page, 'CA-02.3');

  // El contador baja y, al terminar, se puede entrar con el PIN correcto.
  const primero = await contador.innerText();
  await expect.poll(async () => (await contador.count()) === 0 || (await contador.innerText()) !== primero).toBe(true);
  await expect(bloqueo).toBeHidden({ timeout: 6_000 });
  await expect(page.getByTestId('fin-bloqueo')).toBeVisible();
  await escribirPinYEntrar(page, CUENTA.pin);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
});

test('CA-02.4 sin actividad la sesión se cierra y vuelve a pedir el PIN', async ({ page }) => {
  test.setTimeout(60_000);
  await crearCuentaYEntrar(page);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();

  // Con actividad la sesion sigue abierta aunque pasen mas de 5 s: el cierre es solo por inactividad.
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    await page.keyboard.press('Shift');
  }
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();

  // Sin tocar nada durante mas de 5 s se cierra la sesion.
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible({ timeout: 12_000 });
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByTestId('aviso-inactividad')).toContainText('Escribe tu PIN para seguir.');
  await capturar(page, 'CA-02.4');

  // La pantalla interna ya no se abre sin el PIN.
  await page.goto('/casos');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await escribirPinYEntrar(page, CUENTA.pin);
  await expect(page.getByRole('heading', { level: 1, name: `Hola, ${CUENTA.nombre}` })).toBeVisible();
});
