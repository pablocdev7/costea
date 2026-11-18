import { describe, expect, it } from 'vitest';
import { accBal, accTotal, adjustTo, flowsAll, linkedTarget, pendingTotal, totals, uberInAcc, withdraw } from '../src/calc';
import { normalize } from '../src/state';
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

describe('cuentas pendientes de retiro', () => {
  function withApp() {
    const S = mkState({
      defAcc: 'a1',
      accounts: [
        { id: 'a1', name: 'Banco', base: 100000, baseAt: T0 },
        { id: 'a2', name: 'Uber', base: 40000, baseAt: T0, pending: true },
      ],
      months: { '2026-05': { income: [], fixed: [{ id: 'f1', name: 'Luz', amt: 9000, cur: 'ARS', done: false }] } },
    });
    return S;
  }

  it('el total disponible no incluye las pendientes; pendingTotal las suma aparte', () => {
    const S = withApp();
    expect(accBal(S, S.accounts[1])).toBe(40000);
    expect(accTotal(S)).toBe(100000);
    expect(pendingTotal(S)).toBe(40000);
  });

  it('plata hoy y cierre proyectado usan solo lo disponible', () => {
    const t = totals(withApp(), '2026-05', '2026-05');
    expect(t.cash).toBe(100000);
    expect(t.close).toBe(91000);
  });

  it('transferir de una pendiente a una disponible pasa el monto a disponible', () => {
    const S = withApp();
    S.transfers.push({ id: 't1', from: 'a2', to: 'a1', amt: 15000, ts: T0 + 1 });
    expect(accTotal(S)).toBe(115000);
    expect(pendingTotal(S)).toBe(25000);
    expect(totals(S, '2026-05', '2026-05').cash).toBe(115000);
  });

  it('normalize: cuentas viejas sin el campo siguen disponibles', () => {
    const S = normalize({ v: 4, accounts: [{ id: 'a1', name: 'Banco', base: 500, baseAt: T0 }] });
    expect(S.accounts[0].pending).toBeUndefined();
    expect(accTotal(S)).toBe(500);
    expect(pendingTotal(S)).toBe(0);
  });
});

describe('retirar de una cuenta pendiente', () => {
  function app() {
    return mkState({
      defAcc: 'a1',
      accounts: [
        { id: 'a1', name: 'Banco', base: 100000, baseAt: T0 },
        { id: 'a2', name: 'Efectivo', base: 5000, baseAt: T0 },
        { id: 'p1', name: 'Uber', base: 40000, baseAt: T0, pending: true, withdrawTo: 'a1' },
      ],
      uber: [{ id: 'u1', date: '2026-05-01', type: 'in', cat: 'Viajes', amt: 20000, acc: 'p1', ts: T0 + 1 }],
      months: { '2026-05': { income: [], fixed: [] } },
    });
  }

  it('retirar todo: la pendiente queda en cero y la destino sube', () => {
    const S = app();
    expect(accBal(S, S.accounts[2])).toBe(60000);
    expect(withdraw(S, 'p1', 'a1', 60000, T0 + 2, 't1')).toBeNull();
    expect(accBal(S, S.accounts[2])).toBe(0);
    expect(accBal(S, S.accounts[0])).toBe(160000);
    expect(pendingTotal(S)).toBe(0);
    expect(totals(S, '2026-05', '2026-05').cash).toBe(165000);
  });

  it('retirar una parte: el resto sigue pendiente y puede ir a otra cuenta', () => {
    const S = app();
    expect(withdraw(S, 'p1', 'a2', 25000, T0 + 2, 't1')).toBeNull();
    expect(accBal(S, S.accounts[2])).toBe(35000);
    expect(accBal(S, S.accounts[1])).toBe(30000);
    expect(accTotal(S)).toBe(130000);
    expect(pendingTotal(S)).toBe(35000);
  });

  it('no deja retirar más del saldo, cero, ni hacia otra pendiente', () => {
    const S = app();
    S.accounts.push({ id: 'p2', name: 'Didi', base: 0, baseAt: T0, pending: true });
    expect(withdraw(S, 'p1', 'a1', 60001, T0 + 2, 't1')).toMatch(/más de lo que hay/);
    expect(withdraw(S, 'p1', 'a1', 0, T0 + 2, 't1')).toMatch(/mayor a cero/);
    expect(withdraw(S, 'p1', 'p2', 100, T0 + 2, 't1')).toMatch(/disponible/);
    expect(withdraw(S, 'a1', 'a2', 100, T0 + 2, 't1')).toMatch(/no es pendiente/);
    expect(S.transfers).toHaveLength(0);
  });

  it('ajustar saldo: fija el saldo real desde ahora y devuelve la diferencia', () => {
    const S = app(), p = S.accounts[2];
    expect(adjustTo(S, p, 58500, T0 + 5)).toBe(-1500);
    expect(accBal(S, p)).toBe(58500);
    S.uber.push({ id: 'u2', date: '2026-05-02', type: 'in', cat: 'Viajes', amt: 1000, acc: 'p1', ts: T0 + 6 });
    expect(accBal(S, p)).toBe(59500);
    expect(accTotal(S)).toBe(105000);
  });

  it('"Entra a" de un ingreso Uber: la última pendiente usada, o la primera', () => {
    const S = app();
    S.accounts.push({ id: 'p2', name: 'Didi', base: 0, baseAt: T0, pending: true });
    expect(uberInAcc(S)).toBe('p1');
    S.uber.push({ id: 'u2', date: '2026-05-02', type: 'in', cat: 'Viajes', amt: 1000, acc: 'p2', ts: T0 + 9 });
    expect(uberInAcc(S)).toBe('p2');
    S.uber = [{ id: 'u3', date: '2026-05-02', type: 'in', cat: 'Viajes', amt: 1000, acc: 'a1', ts: T0 + 9 }];
    expect(uberInAcc(S)).toBe('p1');
    S.accounts = S.accounts.filter((a) => !a.pending);
    expect(uberInAcc(S)).toBe('a1');
  });

  it('normalize: destino inválido se quita y una pendiente no queda como cuenta por defecto', () => {
    const S = normalize({
      v: 4, defAcc: 'p1',
      accounts: [
        { id: 'p1', name: 'Uber', base: 0, baseAt: T0, pending: true, withdrawTo: 'nada' },
        { id: 'p2', name: 'Didi', base: 0, baseAt: T0, pending: true, withdrawTo: 'p1' },
        { id: 'a1', name: 'Banco', base: 0, baseAt: T0, withdrawTo: 'p1' },
      ],
    });
    expect(S.accounts.map((a) => a.withdrawTo)).toEqual([undefined, undefined, undefined]);
    expect(S.defAcc).toBe('a1');
    expect(linkedTarget(S, S.accounts[0])).toBeUndefined();
  });
});
