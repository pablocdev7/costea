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
  await page.getByRole('button', { name: 'Cuentas', exact: true }).click();
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

/** Monto en pesos de un texto como "$ 1.234,56" (toma el primero). */
async function pesos(loc: import('@playwright/test').Locator): Promise<number> {
  const m = (await loc.innerText()).match(/-?\$\s*([\d.]+,\d{2})/);
  return Number(m![1].replace(/\./g, '').replace(',', '.'));
}

test('cuenta pendiente de punta a punta: crear, ingreso Uber, retirar y actualizar saldo', async ({ page }) => {
  await new FakeSupabase(richState()).install(page);
  await login(page);
  await expect(page.getByRole('heading', { name: 'Cuentas del mes' })).toBeVisible();
  // Cuentas no está en la barra de abajo: se abre desde el encabezado.
  await expect(nav(page, 'Cuentas')).toHaveCount(0);
  const plataHoy = page.getByRole('button', { name: /^Plata hoy/ }), pendiente = page.getByRole('button', { name: /^Pendiente de retiro/ });
  const cash0 = await pesos(plataHoy);
  expect(await pesos(pendiente)).toBe(0);

  // Crear la cuenta pendiente, sin destino vinculado y sin opción de cuenta por defecto.
  await page.getByRole('button', { name: 'Cuentas', exact: true }).click();
  await page.getByRole('button', { name: '+ Cuenta pendiente' }).click();
  const sheet = page.locator('#sheet');
  await expect(sheet.getByLabel('¿Cuenta por defecto?')).toHaveCount(0);
  await sheet.getByLabel('Nombre').fill('Uber');
  await sheet.getByLabel('Saldo actual ($ ARS)').fill('10000');
  await sheet.getByLabel('Cuenta destino al retirar').selectOption({ label: 'Elegirla al retirar' });
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  const row = page.locator('.item[data-acc]').filter({ hasText: 'Uber' });
  await expect(row).toContainText('Sin cuenta destino vinculada');

  // Ingreso Uber: "Entra a" propone la pendiente; los gastos no la ofrecen.
  await nav(page, 'Hoy').click();
  await expect(page.locator('#u-med option:checked')).toHaveText('Uber');
  await page.getByText('Gasto del auto').click();
  await expect(page.locator('#u-med option', { hasText: 'Uber' })).toHaveCount(0);
  await page.getByText('Ingreso Uber').click();
  await expect(page.locator('#u-med option:checked')).toHaveText('Uber');
  await page.locator('#u-amt').fill('25000');
  await page.getByRole('button', { name: 'Agregar' }).click();

  // En Resumen lo pendiente sube y la plata de hoy no cambia.
  await nav(page, 'Resumen').click();
  expect(await pesos(pendiente)).toBe(35000);
  expect(await pesos(plataHoy)).toBe(cash0);
  await pendiente.click();
  const banco = page.locator('.item:not([data-acc])').filter({ hasText: 'Banco de prueba' });
  const banco0 = await pesos(banco);

  // Retirar: monto precargado con todo; sin destino obliga a elegir y ofrece vincularlo.
  await row.getByRole('button', { name: 'Retirar' }).click();
  await expect(sheet.getByLabel('Monto ($ ARS)')).toHaveValue('35000');
  await sheet.getByLabel('Monto ($ ARS)').fill('30000');
  await sheet.getByRole('button', { name: 'Retirar' }).click();
  await expect(page.locator('#note')).toHaveText('Elegí la cuenta a la que retirás.');
  await expect(sheet).toBeVisible();
  await sheet.locator('select[name=to]').selectOption({ label: 'Banco de prueba' });
  await expect(sheet.getByLabel(/Guardarla como cuenta destino/)).toBeChecked();
  await sheet.getByRole('button', { name: 'Retirar' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('#note')).toContainText('Quedan $');

  expect(await pesos(row)).toBe(5000);
  await expect(row).toContainText('Se retira a Banco de prueba');
  expect(await pesos(banco)).toBeCloseTo(banco0 + 30000, 2);

  // La próxima vez la destino viene precargada.
  await row.getByRole('button', { name: 'Retirar' }).click();
  await expect(sheet.locator('select[name=to] option:checked')).toHaveText('Banco de prueba');
  await expect(sheet.getByLabel(/Guardarla como cuenta destino/)).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Actualizar saldo con lo que muestra la app.
  await row.getByRole('button', { name: 'Actualizar saldo' }).click();
  await sheet.getByLabel('Saldo real en la app ($ ARS)').fill('4500');
  await sheet.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('#note')).toContainText('Saldo actualizado');
  expect(await pesos(row)).toBe(4500);

  await nav(page, 'Resumen').click();
  expect(await pesos(pendiente)).toBe(4500);
  expect(await pesos(plataHoy)).toBeCloseTo(cash0 + 30000, 2);
  await noHorizontalScroll(page);
});
