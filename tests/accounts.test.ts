import { describe, expect, it } from 'vitest';
import { accBal, accTotal, flowsAll } from '../src/calc';
import { mkState } from './helpers';

const T0 = 1_000_000;

function sample() {
  return mkState({
    defAcc: 'a1',
    accounts: [
      { id: 'a1', name: 'Banco', base: 100000, baseAt: T0 },
      { id: 'a2', name: 'Efectivo', base: 5000, baseAt: T0 },
    ],
    uber: [
      { id: 'u1', date: '2026-05-01', type: 'in', cat: 'Viajes', amt: 30000, ts: T0 + 1 },
      { id: 'u2', date: '2026-05-01', type: 'out', cat: 'Combustible', amt: 8000, acc: 'a2', ts: T0 + 2 },
      { id: 'u3', date: '2026-04-01', type: 'in', cat: 'Viajes', amt: 99999, ts: T0 - 1 }, // anterior al saldo base
      { id: 'u4', date: '2026-05-01', type: 'in', cat: 'Viajes', amt: 77777 }, // sin ts: no mueve cuentas
    ],
    gastos: [{ id: 'g1', date: '2026-05-02', cat: 'Ocio', name: '', amt: 2000, ts: T0 + 3 }],
    months: {
      '2026-05': {
        income: [{ id: 'i1', name: 'Sueldo', amt: 500, cur: 'USD', done: true, doneAt: T0 + 4 }],
        fixed: [
          { id: 'f1', name: 'Alquiler', amt: 200000, cur: 'ARS', done: true, doneAt: T0 + 5 },
          { id: 'f2', name: 'Luz', amt: 9000, cur: 'ARS', done: false },
        ],
      },
    },
    debts: [{ id: 'd1', kind: 'fixed', name: 'Cuotas', cur: 'ARS', amount: 1000, payments: [{ id: 'p1', date: '2026-05-03', paid: 1000, acc: 'a2', ts: T0 + 6 }] }],
    stmts: { 'c1|2026-05': { paid: true, paidAt: T0 + 7, amt: 15000 } },
    transfers: [{ id: 't1', from: 'a1', to: 'a2', amt: 10000, ts: T0 + 8 }],
  });
}

describe('saldos por cuenta', () => {
  it('saldo base + movimientos posteriores a baseAt; sin cuenta va a la de por defecto', () => {
    const S = sample();
    // Banco: 100000 + 30000 (uber) − 2000 (gasto) + 500000 (sueldo USD) − 200000 (alquiler) − 15000 (resumen) − 10000 (transf.)
    expect(accBal(S, S.accounts[0])).toBe(403000);
    // Efectivo: 5000 − 8000 (combustible) − 1000 (cuota) + 10000 (transf.)
    expect(accBal(S, S.accounts[1])).toBe(6000);
    expect(accTotal(S)).toBe(409000);
  });

  it('un movimiento justo en baseAt cuenta', () => {
    const S = sample();
    S.accounts[1].baseAt = T0 + 2;
    expect(accBal(S, S.accounts[1])).toBe(6000);
    S.accounts[1].baseAt = T0 + 3;
    expect(accBal(S, S.accounts[1])).toBe(14000);
  });

  it('ignora lo que no tiene marca de tiempo y los gastos sin tildar', () => {
    const fl = flowsAll(sample());
    expect(fl.some((f) => f.amt === 77777)).toBe(false);
    expect(fl.some((f) => f.amt === -9000)).toBe(false);
  });
});
