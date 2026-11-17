import { describe, expect, it } from 'vitest';
import { entries, orderList, secOf, spendByCat, totals } from '../src/calc';
import { ensureMonth } from '../src/state';
import type { State } from '../src/types';
import { mkState } from './helpers';

function sample(): State {
  return mkState({
    carDaily: 10000,
    months: {
      '2026-05': {
        income: [
          { id: 'i1', name: 'Sueldo', amt: 800000, cur: 'ARS', done: true },
          { id: 'i2', name: 'Freelance', amt: 100, cur: 'USD', done: false },
        ],
        fixed: [
          { id: 'f1', name: 'Alquiler', amt: 300000, cur: 'ARS', day: 5, cat: 'Alquiler', done: true },
          { id: 'f2', name: 'Cloud', amt: 20, cur: 'USD', day: 15, cat: 'Cloud / software', done: false },
          { id: 'f3', name: 'Gimnasio', amt: 25000, cur: 'ARS', day: '', done: false },
        ],
      },
      '2026-06': {
        income: [],
        // Gasto de junio que se paga antes, en mayo.
        fixed: [{ id: 'f4', name: 'Seguro', amt: 40000, cur: 'ARS', day: 28, early: true, done: false }],
      },
    },
    cards: [{ id: 'c1', name: 'Visa', closeDay: 20, dueDay: 10 }],
    consumos: [{ id: 'x1', cardId: 'c1', date: '2026-04-10', name: 'Súper', amt: 50000, cur: 'ARS', cat: 'Supermercado' }],
    debts: [{ id: 'd1', kind: 'loan', name: 'Préstamo', cur: 'ARS', principal: 100000, rate: 5, ratePer: 'm', planned: 30000, day: 20, payments: [{ id: 'p', date: '2026-05-20', paid: 30000, interest: 5000, capital: 25000 }] }],
    uber: [
      { id: 'u1', date: '2026-05-02', type: 'in', cat: 'Viajes', amt: 50000 },
      { id: 'u2', date: '2026-05-02', type: 'out', cat: 'Combustible', amt: 10000 },
      { id: 'u3', date: '2026-05-07', type: 'out', cat: 'Pago alquiler del auto', amt: 70000 },
    ],
    gastos: [{ id: 'g1', date: '2026-05-03', cat: 'Ocio', name: '', amt: 6000 }],
  });
}

describe('entries', () => {
  it('junta deudas, fijos (incluido el adelantado) y resúmenes con su fecha real', () => {
    const e = entries(sample(), '2026-05');
    const by = Object.fromEntries(e.map((x) => [x.id || x.debt || x.cardId, x]));
    expect(by.d1).toMatchObject({ sec: 'debts', ars: 30000, done: true, dt: '2026-05-20' });
    expect(by.f1).toMatchObject({ sec: 'fixed', ars: 300000, dt: '2026-05-05', early: false });
    expect(by.f2).toMatchObject({ ars: 20000, orig: 20, dt: '2026-05-15' });
    expect(by.f3).toMatchObject({ day: 99, dt: '9999-99-99' });
    expect(by.f4).toMatchObject({ early: true, mk: '2026-06', dt: '2026-04-28' });
    expect(by.c1).toMatchObject({ sec: 'card', ars: 50000, dt: '2026-05-10' });
    expect(e).toHaveLength(6);
  });
});

describe('totals', () => {
  it('cierre proyectado y plata de hoy', () => {
    const S = sample();
    const t = totals(S, '2026-05', '2026-05');
    // Uber neto de caja: 50000 − 10000 − 70000 = −30000
    expect(t.u.net).toBe(-30000);
    expect(t.salIn).toBe(800000);
    expect(t.salAll).toBe(900000);
    expect(t.incIn).toBe(770000);
    expect(t.incAll).toBe(870000);
    expect(t.incPend).toBe(100000);
    expect(t.expAll).toBe(30000 + 300000 + 20000 + 25000 + 40000 + 50000);
    expect(t.expPaid).toBe(330000);
    expect(t.opening).toBe(0);
    expect(t.cash).toBe(440000);
    expect(t.close).toBe(870000 - 465000);
  });

  it('la apertura es el cierre del período anterior, salvo ajuste manual', () => {
    const S = sample();
    S.months['2026-04'] = { income: [{ id: 'a', name: 'Sueldo', amt: 1000, cur: 'ARS', done: true }], fixed: [] };
    // Cierre de abril: 1000 de sueldo − 30000 de la cuota prevista del préstamo.
    expect(totals(S, '2026-05', '2026-05').opening).toBe(-29000);
    S.months['2026-05'].opening = 5000;
    expect(totals(S, '2026-05', '2026-05').opening).toBe(5000);
  });

  it('en el período actual, con cuentas, la apertura sale de los saldos', () => {
    const S = sample();
    S.accounts = [{ id: 'a1', name: 'Banco', base: 500000, baseAt: 0 }];
    const t = totals(S, '2026-05', '2026-05');
    // Ningún movimiento tiene ts → total en cuentas = 500000 = plata hoy.
    expect(t.cash).toBe(500000);
    expect(totals(S, '2026-05', '2026-06').cash).toBe(440000);
  });

  it('un período sin abrir usa la plantilla del anterior, sin tildar y sin guardarlo', () => {
    const S = sample();
    const t = totals(S, '2026-07', '2026-05');
    expect(t.salAll).toBe(0); // la plantilla es junio, que no tiene ingresos
    expect(S.months['2026-07']).toBeUndefined();
    const m = ensureMonth(S, '2026-07');
    expect(m.fixed).toHaveLength(1);
    expect(m.fixed[0]).toMatchObject({ name: 'Seguro', done: false, ex: 0 });
    expect(m.fixed[0].id).not.toBe('f4');
  });

  it('secOf separa por sección', () => {
    const t = totals(sample(), '2026-05', '2026-05');
    expect(secOf(t, 'fixed')).toEqual({ tot: 385000, pd: 300000 });
    expect(secOf(t, 'debts')).toEqual({ tot: 30000, pd: 30000 });
  });
});

describe('orderList', () => {
  it('ordena lo pendiente por fecha y marca hasta dónde alcanza la plata', () => {
    const S = sample();
    S.months['2026-05'].opening = -400000; // plata hoy = 40000
    const t = totals(S, '2026-05', '2026-05');
    expect(t.cash).toBe(40000);
    const L = orderList(t);
    expect(L.map((x) => x.label)).toEqual(['Seguro', 'Visa', 'Cloud', 'Gimnasio']);
    expect(L[0]).toMatchObject({ covered: true, short: 0 }); // 40000 − 40000 = 0
    expect(L[1]).toMatchObject({ covered: false, short: 50000 });
    expect(L[3]).toMatchObject({ short: 95000 });
  });
});

describe('spendByCat', () => {
  it('suma por categoría sin el pago del alquiler y sin capital de deudas', () => {
    const sp = spendByCat(sample(), '2026-05');
    expect(sp.m).toEqual({
      Ocio: 6000,
      // El consumo es del 10/4 → período de abril (por fecha de compra), no entra.
      Alquiler: 300000,
      'Cloud / software': 20000,
      'Gastos fijos sin categoría': 25000,
      'Auto: Combustible': 10000,
      'Auto: cuota del alquiler': 10000,
      'Intereses de deudas': 5000,
    });
    expect(sp.tot).toBe(376000);
  });

  it('los consumos cuentan por fecha de compra', () => {
    const sp = spendByCat(sample(), '2026-04');
    expect(sp.m).toEqual({ Supermercado: 50000 });
  });
});
