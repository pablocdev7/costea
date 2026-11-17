import type { Debt, State } from '../types';
import { periodKey } from './period';
import { num, toARS } from './util';

export interface LoanInfo {
  /** Capital devuelto. */
  cap: number;
  /** Interés pagado. */
  int: number;
  paid: number;
  /** Saldo de capital. */
  bal: number;
  /** Tasa mensual (fracción). Una tasa anual se divide por 12. */
  mr: number;
  /** Interés del próximo pago: saldo × tasa mensual. */
  nextInt: number;
}

export function loanInfo(d: Debt): LoanInfo {
  let cap = 0, int = 0, paid = 0;
  d.payments.forEach((p) => { cap += num(p.capital); int += num(p.interest); paid += num(p.paid); });
  const bal = Math.max(0, num(d.principal) - cap);
  const mr = num(d.rate) / 100 / (d.ratePer === 'y' ? 12 : 1);
  return { cap, int, paid, bal, mr, nextInt: bal * mr };
}

export interface LoanSplit {
  paid: number;
  interest: number;
  capital: number;
  /** Saldo de capital después del pago. */
  left: number;
  /** Lo que sobra y no se aplica (pago mayor que interés + saldo). */
  over: number;
}

/**
 * Reparte un pago de préstamo: primero interés (por defecto saldo × tasa mensual, editable,
 * nunca más que el pago), el resto a capital (nunca más que el saldo).
 */
export function splitLoanPayment(d: Debt, paidIn: number, interestIn?: number): LoanSplit {
  const li = loanInfo(d);
  const paid = Math.max(0, paidIn);
  const interest = Math.min(Math.max(interestIn ?? li.nextInt, 0), paid);
  const capital = Math.min(Math.max(paid - interest, 0), li.bal);
  return { paid, interest, capital, left: li.bal - capital, over: paid - interest - capital };
}

export interface FixedInfo {
  /** Cuotas pagadas. */
  n: number;
  /** Cuotas totales (0 = sin definir). */
  tot: number;
  /** Cuotas que faltan, o null si no hay total. */
  left: number | null;
  /** Monto que falta pagar, o null si no hay total. */
  remain: number | null;
}

export function fixedInfo(d: Debt): FixedInfo {
  const n = d.payments.length;
  const tot = num(d.total);
  const left = tot > 0 ? Math.max(0, tot - n) : null;
  return { n, tot, left, remain: left == null ? null : left * num(d.amount) };
}

/** Total pagado de una deuda en el período k. */
export function paidIn(d: Debt, k: string, startDay: State['startDay']): number {
  return d.payments.filter((p) => periodKey(p.date, startDay) === k).reduce((a, p) => a + num(p.paid), 0);
}

/** Saldo pendiente de una deuda en su moneda (null si es de cuotas sin total). */
export function debtBalance(d: Debt): number | null {
  return d.kind === 'loan' ? loanInfo(d).bal : fixedInfo(d).remain;
}

export interface Entry {
  sec: 'debts' | 'fixed' | 'card';
  label: string;
  /** Monto en ARS. */
  ars: number;
  /** Monto original en USD, si la deuda/gasto es en dólares. */
  orig: number | null;
  /** Día de pago (99 = sin día). */
  day: number;
  done: boolean;
  /** Orden de desempate en el mismo día: deudas, fijos, tarjetas. */
  ord: number;
  /** Fecha real de pago 'AAAA-MM-DD' ('9999-99-99' = sin fecha). */
  dt: string;
  debt?: string;
  id?: string;
  /** Período dueño del gasto fijo. */
  mk?: string;
  early?: boolean;
  cardId?: string;
}

/** Cuotas de deudas a pagar en el período k (sin dt; lo agrega entries()). */
export function debtEntries(S: State, k: string): Omit<Entry, 'dt'>[] {
  const out: Omit<Entry, 'dt'>[] = [];
  S.debts.forEach((d) => {
    const paid = paidIn(d, k, S.startDay);
    let amt = 0, done = false;
    if (paid > 0) { amt = paid; done = true; }
    else if (d.kind === 'loan') { if (num(d.planned) > 0 && loanInfo(d).bal > 0) amt = num(d.planned); }
    else {
      const fi = fixedInfo(d);
      if (num(d.amount) > 0 && (fi.left == null || fi.left > 0)) amt = num(d.amount);
    }
    if (amt > 0) out.push({ sec: 'debts', debt: d.id, label: d.name || 'Deuda', ars: toARS(amt, d.cur, S.rate), orig: d.cur === 'USD' ? amt : null, day: num(d.day) || 99, done, ord: 0 });
  });
  return out;
}
