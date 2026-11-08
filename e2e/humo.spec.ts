import { expect, test } from '@playwright/test';

test('humo: la app abre y muestra VozVial sin errores de consola', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errores.push(msg.text());
  });
  page.on('pageerror', (error) => errores.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'VozVial' })).toBeVisible();
  // Detecta, por ejemplo, bloqueos de la CSP de vercel.json.
  expect(errores).toEqual([]);
});

test('humo: una ruta desconocida tambien carga la SPA', async ({ page }) => {
  const respuesta = await page.goto('/ruta-que-no-existe');
  expect(respuesta?.status()).toBe(200);
  await expect(page.locator('#root')).toBeAttached();
  // Pantalla propia en español, no la de Expo Router ("Unmatched Route").
  await expect(page.getByRole('heading', { level: 1, name: 'No encontramos esta página' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Unmatched Route');
  await page.getByTestId('ir-comienzo').click();
  await expect(page).toHaveURL(/\/bienvenida$/);
});

test('humo: el endpoint del asistente responde JSON en el mismo origen', async ({ request }) => {
  const respuesta = await request.post('/api/asistente', { data: { pregunta: 'hola' } });
  expect(respuesta.headers()['content-type']).toContain('application/json');
});
