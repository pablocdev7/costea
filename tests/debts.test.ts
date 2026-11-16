import { describe, expect, it } from 'vitest';
import { debtBalance, debtEntries, fixedInfo, loanInfo, paidIn, splitLoanPayment } from '../src/calc';
import type { Debt } from '../src/types';
import { mkState } from './helpers';

const loan = (over: Partial<Debt> = {}): Debt => ({ id: 'l1', kind: 'loan', name: 'Préstamo', cur: 'USD', principal: 1000, rate: 2, ratePer: 'm', planned: 100, day: 10, payments: [], ...over });

describe('préstamos', () => {
  it('interés del próximo pago = saldo × tasa mensual', () => {
    const li = loanInfo(loan());
    expect(li.bal).toBe(1000);
    expect(li.mr).toBeCloseTo(0.02);
    expect(li.nextInt).toBeCloseTo(20);
  });

  it('una tasa anual se divide por 12', () => {
    const li = loanInfo(loan({ rate: 24, ratePer: 'y' }));
    expect(li.mr).toBeCloseTo(0.02);
    expect(li.nextInt).toBeCloseTo(20);
  });

  it('el pago va primero a interés y el resto a capital', () => {
    const v = splitLoanPayment(loan(), 100);
    expect(v.interest).toBeCloseTo(20);
    expect(v.capital).toBeCloseTo(80);
    expect(v.left).toBeCloseTo(920);
    expect(v.over).toBeCloseTo(0);
  });

  it('si el pago no cubre el interés, todo es interés (interés = min(pago, saldo × tasa))', () => {
    const v = splitLoanPayment(loan(), 15);
    expect(v.interest).toBe(15);
    expect(v.capital).toBe(0);
    expect(v.left).toBe(1000);
  });

  it('el interés es editable y el capital no supera el saldo', () => {
    const d = loan({ principal: 50 });
    const v = splitLoanPayment(d, 100, 0);
    expect(v.interest).toBe(0);
    expect(v.capital).toBe(50);
    expect(v.left).toBe(0);
    expect(v.over).toBe(50);
  });

  it('el saldo baja con los pagos registrados', () => {
    const d = loan({ payments: [{ id: 'p1', date: '2026-04-10', paid: 100, interest: 20, capital: 80 }] });
    const li = loanInfo(d);
    expect(li.bal).toBe(920);
    expect(li.int).toBe(20);
    expect(li.nextInt).toBeCloseTo(18.4);
    expect(debtBalance(d)).toBe(920);
  });
});

describe('deudas de cuota fija', () => {
  const fx = (over: Partial<Debt> = {}): Debt => ({ id: 'f1', kind: 'fixed', name: 'Celular', cur: 'ARS', amount: 25000, total: 12, day: 5, payments: [], ...over });

  it('cuenta cuotas pagadas, faltantes y monto restante', () => {
    const d = fx({ payments: [1, 2, 3].map((i) => ({ id: 'p' + i, date: '2026-0' + i + '-05', paid: 25000 })) });
    expect(fixedInfo(d)).toEqual({ n: 3, tot: 12, left: 9, remain: 225000 });
  });

  it('sin total definido no hay faltantes', () => {
    expect(fixedInfo(fx({ total: '' }))).toEqual({ n: 0, tot: 0, left: null, remain: null });
  });
});

describe('cuotas del período', () => {
  it('paidIn agrupa por período con arranque el 27', () => {
    const d = loan({ payments: [
      { id: 'a', date: '2026-04-26', paid: 100 },
      { id: 'b', date: '2026-04-27', paid: 50 },
    ] });
    expect(paidIn(d, '2026-04', 27)).toBe(100);
    expect(paidIn(d, '2026-05', 27)).toBe(50);
  });

  it('muestra lo pagado si ya se pagó, si no la cuota prevista convertida a pesos', () => {
    const S = mkState({ debts: [
      loan(),
      { id: 'f1', kind: 'fixed', name: 'Celular', cur: 'ARS', amount: 25000, total: 1, day: '', payments: [{ id: 'p', date: '2026-03-05', paid: 25000 }] },
      { id: 'f2', kind: 'fixed', name: 'Heladera', cur: 'ARS', amount: 30000, total: 6, day: 3, payments: [{ id: 'q', date: '2026-05-03', paid: 30000 }] },
    ] });
    const es = debtEntries(S, '2026-05');
    expect(es).toHaveLength(2); // el celular ya está terminado
    expect(es[0]).toMatchObject({ debt: 'l1', ars: 100000, orig: 100, day: 10, done: false });
    expect(es[1]).toMatchObject({ debt: 'f2', ars: 30000, orig: null, done: true });
  });

  it('un préstamo saldado no genera cuota', () => {
    const S = mkState({ debts: [loan({ principal: 80, payments: [{ id: 'p', date: '2026-01-10', paid: 80, interest: 0, capital: 80 }] })] });
    expect(debtEntries(S, '2026-05')).toHaveLength(0);
  });
});
