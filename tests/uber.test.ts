import { describe, expect, it } from 'vitest';
import { dayItems, dayStats, uberReal, uberStats } from '../src/calc';
import { mkState } from './helpers';

function sample() {
  return mkState({
    carDaily: 10000,
    uber: [
      { id: '1', date: '2026-05-04', type: 'in', cat: 'Viajes', amt: 60000 },
      { id: '2', date: '2026-05-04', type: 'out', cat: 'Combustible', amt: 15000 },
      { id: '3', date: '2026-05-05', type: 'in', cat: 'Viajes', amt: 40000 },
      { id: '4', date: '2026-05-05', type: 'in', cat: 'Propinas', amt: 2000 },
      { id: '5', date: '2026-05-07', type: 'out', cat: 'Pago alquiler del auto', amt: 70000 },
      { id: '6', date: '2026-05-08', type: 'out', cat: 'Lavado', amt: 5000 },
      { id: '7', date: '2026-04-27', type: 'in', cat: 'Viajes', amt: 30000 }, // ya es período de mayo
      { id: '8', date: '2026-05-27', type: 'in', cat: 'Viajes', amt: 99999 }, // período de junio
    ],
  });
}

describe('ganancia real de Uber', () => {
  it('ingresos − gastos del auto − cuota diaria × días trabajados', () => {
    const u = uberReal(sample(), '2026-05');
    expect(u.inn).toBe(132000);
    expect(u.out).toBe(20000); // el pago del alquiler no se cuenta
    expect(u.fuel).toBe(15000);
    expect(u.days).toBe(3); // 27/4, 4/5 y 5/5 (el 8/5 solo tuvo gastos)
    expect(u.car).toBe(30000);
    expect(u.profit).toBe(82000);
    expect(u.perDay).toBeCloseTo(82000 / 3);
    expect(u.fuelDay).toBe(5000);
  });

  it('desglose por día', () => {
    const rows = uberReal(sample(), '2026-05').rows;
    expect(rows.map((r) => r.date)).toEqual(['2026-04-27', '2026-05-04', '2026-05-05', '2026-05-07', '2026-05-08']);
    expect(rows[1]).toEqual({ date: '2026-05-04', in: 60000, out: 15000, car: 10000, profit: 35000 });
    expect(rows[3]).toEqual({ date: '2026-05-07', in: 0, out: 0, car: 0, profit: 0 });
    expect(rows[4]).toEqual({ date: '2026-05-08', in: 0, out: 5000, car: 0, profit: -5000 });
  });

  it('el pago del alquiler sí mueve la caja (uberStats)', () => {
    const u = uberStats(sample(), '2026-05');
    expect(u.inn).toBe(132000);
    expect(u.out).toBe(90000);
    expect(u.net).toBe(42000);
    expect(u.days).toBe(3);
    expect(u.avg).toBe(14000);
  });

  it('ganancia de un día', () => {
    expect(dayStats(sample(), '2026-05-04')).toEqual({ in: 60000, out: 15000, car: 10000, profit: 35000 });
    expect(dayStats(sample(), '2026-05-07')).toEqual({ in: 0, out: 0, car: 0, profit: 0 });
  });

  it('movimientos del período incluyen gastos y consumos', () => {
    const S = sample();
    S.gastos.push({ id: 'g', date: '2026-05-04', cat: 'Ocio', name: 'Cine', amt: 3000, ts: 5 });
    S.cards.push({ id: 'c', name: 'Visa', closeDay: 20, dueDay: 5 });
    S.consumos.push({ id: 'k', cardId: 'c', date: '2026-05-04', name: 'Libro', amt: 10, cur: 'USD' });
    const L = dayItems(S, '2026-05');
    expect(L).toHaveLength(9);
    expect(L.find((x) => x.id === 'k')).toMatchObject({ kind: 'card', amt: 10000, note: 'Visa · Libro', cat: 'Tarjeta' });
  });
});
