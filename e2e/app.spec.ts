import { expect, test, type Page } from '@playwright/test';
import { curKey, richState } from './data';
import { FakeSupabase, login } from './mock';

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, 'no tiene que haber scroll horizontal').toBeLessThanOrEqual(cw);
}

const nav = (page: Page, name: string) => page.locator('#nav').getByRole('button', { name });

test.describe('login', () => {
  test('con contraseña incorrecta muestra el error', async ({ page }) => {
    await new FakeSupabase().install(page);
    await login(page, 'otra-clave');
    await expect(page.getByRole('alert')).toHaveText('El email o la contraseña no son correctos.');
    await expect(page.locator('#app')).toBeHidden();
  });

  test('entra, queda la sesión guardada y cerrar sesión vuelve al login', async ({ page }) => {
    await new FakeSupabase().install(page);
    await login(page);
    await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
    await expect(page.locator('.headline')).toContainText('Cargá tus ingresos y gastos');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
    await page.getByRole('button', { name: 'Datos' }).click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('cuentas-v2'))).toBeNull();
  });
});

test.describe('sincronización', () => {
  test('al entrar trae los datos de la nube', async ({ page }) => {
    await new FakeSupabase(richState()).install(page);
    await login(page);
    await nav(page, 'Ingresos').click();
    await expect(page.getByText('Sueldo de prueba')).toBeVisible();
    await expect(page.locator('.item', { hasText: 'Sueldo de prueba' }).locator('.amt')).toHaveText('$ 1.850.000,00');
  });

  test('un movimiento nuevo se guarda en la nube con su marca de tiempo', async ({ page }) => {
    const sb = new FakeSupabase(richState());
    await sb.install(page);
    await login(page);
    await nav(page, 'Hoy').click();
    await page.getByLabel('Monto ($ ARS)').fill('50000');
    await page.getByLabel('Nota (opcional)').fill('viajes de prueba');
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.locator('#note')).toContainText('Ingreso anotado: $ 50.000,00');
    await expect(page.locator('#save')).toHaveText('Guardado');
    const last = sb.saves.at(-1)! as { uber: { note: string }[]; t: number };
    expect(last.uber.some((u) => u.note === 'viajes de prueba')).toBe(true);
    expect(last.t).toBeGreaterThan(1000);
  });

  test('gana el más nuevo: adopta lo que guardó otro dispositivo', async ({ page }) => {
    const sb = new FakeSupabase(richState());
    await sb.install(page);
    await login(page);
    await nav(page, 'Ingresos').click();
    await expect(page.getByText('Sueldo de prueba')).toBeVisible();
    const newer = richState(Date.now() + 60_000);
    newer.months[curKey].income[0].name = 'Sueldo cambiado en la compu';
    sb.remoteWrite(newer);
    await page.getByRole('button', { name: 'Datos' }).click();
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
    await nav(page, 'Ingresos').click();
    await expect(page.getByText('Sueldo cambiado en la compu')).toBeVisible();
  });

  test('una versión vieja de la nube no pisa la local', async ({ page }) => {
    const sb = new FakeSupabase(richState(5));
    await sb.install(page);
    await login(page);
    await nav(page, 'Hoy').click();
    await page.getByLabel('Monto ($ ARS)').fill('1000');
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.locator('#save')).toHaveText('Guardado');
    const old = richState(10);
    old.months[curKey].income[0].name = 'Versión vieja';
    sb.remoteWrite(old);
    await page.getByRole('button', { name: 'Datos' }).click();
    await page.getByRole('button', { name: 'Sincronizar ahora' }).click();
    await expect(page.locator('#save')).toHaveText('Guardado');
    await nav(page, 'Ingresos').click();
    await expect(page.getByText('Sueldo de prueba')).toBeVisible();
    expect(sb.row!.t).toBeGreaterThan(10);
  });
});

test('importar JSON reemplaza los datos y los sube', async ({ page }) => {
  const sb = new FakeSupabase();
  await sb.install(page);
  await login(page);
  await page.getByRole('button', { name: 'Datos' }).click();
  page.once('dialog', (d) => d.accept());
  await page.locator('#imp').setInputFiles({ name: 'respaldo-cuentas.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(richState())) });
  await expect(page.locator('#note')).toHaveText('Respaldo importado.');
  await nav(page, 'Deudas').click();
  await expect(page.getByRole('heading', { name: 'Préstamo de prueba' })).toBeVisible();
  await expect(page.locator('#save')).toHaveText('Guardado');
  expect((sb.row!.data as { debts: unknown[] }).debts).toHaveLength(2);
});

test('importar un archivo que no es respaldo avisa y no cambia nada', async ({ page }) => {
  await new FakeSupabase(richState()).install(page);
  await login(page);
  await page.getByRole('button', { name: 'Datos' }).click();
  await page.locator('#imp').setInputFiles({ name: 'otro.json', mimeType: 'application/json', buffer: Buffer.from('{"hola":1}') });
  await expect(page.locator('#note')).toHaveText('Ese archivo no parece un respaldo de Cuentas.');
});

test('registrar un pago de préstamo reparte interés y capital', async ({ page }) => {
  const sb = new FakeSupabase(richState());
  await sb.install(page);
  await login(page);
  await nav(page, 'Deudas').click();
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Préstamo de prueba' }) });
  await card.getByRole('button', { name: 'Registrar pago' }).click();
  // Saldo 5000 USD al 2% mensual → 100 de interés; el resto de 400 a capital.
  await expect(page.locator('#prev')).toHaveText('De US$ 400,00: US$ 100,00 van a interés y US$ 300,00 a capital. El saldo queda en US$ 4.700,00.');
  await page.locator('#sform').getByRole('button', { name: 'Registrar pago' }).click();
  await expect(card.locator('.stat .v')).toHaveText('US$ 4.700,00');
});

test('consumo con tarjeta muestra a qué resumen va y deshacer un borrado', async ({ page }) => {
  await new FakeSupabase(richState()).install(page);
  await login(page);
  await nav(page, 'Gastos').click();
  await page.locator('section[data-card="c1"]').getByRole('button', { name: '+ Consumo' }).click();
  await expect(page.locator('#prev')).toContainText('Va al resumen de Tarjeta de prueba que vence el 5 de');
  await page.locator('#sform input[name=amt]').fill('1500');
  await page.locator('#sform').getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('#note')).toContainText('Va al resumen de Tarjeta de prueba');
  // Borrar un gasto fijo y deshacer.
  await page.getByRole('button', { name: /Gimnasio/ }).click();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByRole('button', { name: /Gimnasio/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByRole('button', { name: /Gimnasio/ })).toBeVisible();
});

test('a 400px de ancho no hay scroll horizontal en ninguna pestaña', async ({ page }) => {
  await new FakeSupabase(richState()).install(page);
  await login(page);
  await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
  for (const name of ['Resumen', 'Ingresos', 'Hoy', 'Gastos', 'Deudas', 'Análisis']) {
    await nav(page, name).click();
    await page.locator('details').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)));
    await noHorizontalScroll(page);
  }
  await page.getByRole('button', { name: 'Datos' }).click();
  await noHorizontalScroll(page);
  await nav(page, 'Deudas').click();
  await page.getByRole('button', { name: 'Registrar pago' }).first().click();
  await noHorizontalScroll(page);
});

test('tema oscuro: respeta el del sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await new FakeSupabase().install(page);
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(14, 19, 27)');
});

test('iOS: los campos tienen letra de 16px o más y los botones no esperan el doble toque', async ({ page }) => {
  await new FakeSupabase(richState()).install(page);
  await login(page);
  await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
  await expect(page.locator('meta[name=viewport]')).not.toHaveAttribute('content', /maximum-scale|user-scalable/);
  const check = async () => {
    const bad = await page.evaluate(() => [
      ...[...document.querySelectorAll('input,select,textarea')].filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => 'campo ' + (e.getAttribute('name') || e.id || e.tagName)),
      ...[...document.querySelectorAll('button')].filter((e) => getComputedStyle(e).touchAction !== 'manipulation').map((e) => 'botón ' + (e.textContent || '').trim()),
    ]);
    expect(bad).toEqual([]);
  };
  for (const name of ['Resumen', 'Ingresos', 'Hoy', 'Gastos', 'Deudas', 'Análisis']) {
    await nav(page, name).click();
    await check();
  }
  await page.getByRole('button', { name: 'Datos' }).click();
  await check();
  await nav(page, 'Resumen').click();
  await page.getByRole('button', { name: '+ Cuenta' }).click();
  await check();
  await noHorizontalScroll(page);
});
