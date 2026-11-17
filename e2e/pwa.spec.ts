import { expect, test } from '@playwright/test';
import { richState } from './data';
import { FakeSupabase, login } from './mock';

test('el manifest declara la app instalable', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: 'Cuentas', display: 'standalone', start_url: '/' });
  const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => i.sizes + (i.purpose ? ':' + i.purpose : ''));
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
  for (const i of m.icons) expect((await request.get('/' + i.src)).ok()).toBe(true);
});

test.describe('sin conexión', () => {
  test.use({ serviceWorkers: 'allow' });

  test('abre sin internet, guarda en el dispositivo y sincroniza al volver', async ({ page, context }) => {
    const sb = new FakeSupabase(richState());
    await sb.install(context);
    await login(page);
    await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
    // Esperar a que el service worker tenga la app en caché y controle la página.
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    sb.offline = true;
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
    await page.locator('#nav').getByRole('button', { name: 'Hoy' }).click();
    await page.getByLabel('Monto ($ ARS)').fill('7777');
    await page.getByLabel('Nota (opcional)').fill('anotado sin internet');
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.locator('#save')).toHaveText('Sin conexión · guardado en este dispositivo');

    sb.offline = false;
    await context.setOffline(false);
    await expect(page.locator('#save')).toHaveText('Guardado');
    const data = sb.row!.data as { uber: { note: string }[] };
    expect(data.uber.some((u) => u.note === 'anotado sin internet')).toBe(true);
  });
});
