import type { Month, State } from '../types';
import { accTotal } from './accounts';
import { stmtOf } from './cards';
import { debtEntries, type Entry } from './debts';
import { dateOf, periodKey } from './period';
import { CAR_RENT_CAT, uberReal, uberStats, type UberStats } from './uber';
import { nid, num, shiftKey, toARS } from './util';

/**
 * Período nuevo armado con los ingresos y gastos fijos del último período anterior,
 * sin tildar. No lo guarda en el estado (eso lo hace state.ensureMonth).
 */
export function deriveMonth(S: State, k: string): Month {
  const ks = Object.keys(S.months).filter((x) => x < k).sort();
  const p = ks.length ? S.months[ks[ks.length - 1]] : null;
  const copy = (i: Month['income'][number]) => ({ ...i, id: nid(), done: false, ex: 0 });
  return { income: p ? p.income.map(copy) : [], fixed: p ? p.fixed.map(copy) : [] };
}

/** El período k tal como está, o como quedaría al abrirlo. */
export function monthOf(S: State, k: string): Month {
  return S.months[k] || deriveMonth(S, k);
}

/** Todo lo que hay que pagar en el período k: cuotas de deudas, gastos fijos y resúmenes de tarjeta. */
export function entries(S: State, k: string): Entry[] {
  const m = monthOf(S, k);
  const out = debtEntries(S, k) as Entry[];
  const nk = shiftKey(k, 1);
  const nm = S.months[nk];
  const fx = (f: Month['fixed'][number], mk: string) => {
    out.push({ sec: 'fixed', id: f.id, mk, early: mk !== k, label: f.name || 'Gasto fijo', ars: toARS(num(f.amt), f.cur, S.rate), orig: f.cur === 'USD' ? num(f.amt) : null, day: num(f.day) || 99, done: !!f.done, ord: 1, dt: '' });
  };
  m.fixed.forEach((f) => { if (!f.early) fx(f, k); });
  if (nm) nm.fixed.forEach((f) => { if (f.early) fx(f, nk); });
  S.cards.forEach((c) => {
    const s = stmtOf(S, c, k);
    if (s.toPay > 0) out.push({ sec: 'card', cardId: c.id, label: c.name || 'Tarjeta', ars: s.toPay, orig: null, day: num(c.dueDay) || 99, done: s.paid, ord: 2, dt: '' });
  });
  out.forEach((x) => { x.dt = x.day === 99 ? '9999-99-99' : dateOf(k, x.day, S.startDay); });
  return out;
}

export interface Totals {
  e: Entry[];
  u: UberStats;
  opening: number;
  /** Sueldo e ingresos fijos cobrados / totales. */
  salIn: number;
  salAll: number;
  /** Ingresos totales / cobrados (incluye el neto de Uber como cobrado). */
  incAll: number;
  incIn: number;
  incPend: number;
  expAll: number;
  expPaid: number;
  expDue: number;
  /** Plata hoy: apertura + cobrado − pagado. */
  cash: number;
  /** Cierre proyectado: apertura + todos los ingresos − todos los gastos. */
  close: number;
}

/** Plata con la que arranca el período: la ajustada a mano o el cierre del período anterior. */
export function openingOf(S: State, k: string, todayKey: string): number {
  const m = S.months[k];
  if (m && m.opening != null && m.opening !== '') return num(m.opening);
  const ks = Object.keys(S.months).filter((x) => x < k).sort();
  return ks.length ? totals(S, ks[ks.length - 1], todayKey).close : 0;
}

/**
 * Totales del período k. En el período actual, si hay cuentas, la apertura se
 * deduce de los saldos reales: apertura = total en cuentas − (cobrado − pagado).
 */
export function totals(S: State, k: string, todayKey: string): Totals {
  const m = monthOf(S, k);
  const e = entries(S, k);
  const u = uberStats(S, k);
  let incAll = 0, incIn = 0, expAll = 0, expPaid = 0;
  let op = openingOf(S, k, todayKey);
  m.income.forEach((i) => { const a = toARS(num(i.amt), i.cur, S.rate); incAll += a; if (i.done) incIn += a; });
  const salIn = incIn, salAll = incAll;
  incAll += u.net; incIn += u.net;
  e.forEach((x) => { expAll += x.ars; if (x.done) expPaid += x.ars; });
  if (k === todayKey && S.accounts.length) op = accTotal(S) - (incIn - expPaid);
  return { e, u, opening: op, salIn, salAll, incAll, incIn, incPend: incAll - incIn, expAll, expPaid, expDue: expAll - expPaid, cash: op + incIn - expPaid, close: op + incAll - expAll };
}

export type OrderedEntry = Entry & { short: number; covered: boolean };

/**
 * Lo que falta pagar ordenado por fecha, descontando de la plata de hoy:
 * para cada pago, cuánto falta (short) y si alcanza (covered).
 */
export function orderList(t: Totals): OrderedEntry[] {
  const items = t.e.filter((x) => !x.done).map((x) => ({ ...x, short: 0, covered: true }));
  items.sort((a, b) => (a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : a.ord - b.ord));
  let run = t.cash;
  items.forEach((x) => { run -= x.ars; x.short = Math.max(0, -run); x.covered = run >= -0.5; });
  return items;
}

/** Total y pagado de una sección ('fixed', 'debts', 'card') en el período. */
export function secOf(t: Totals, sec: Entry['sec']): { tot: number; pd: number } {
  let tot = 0, pd = 0;
  t.e.filter((x) => x.sec === sec).forEach((x) => { tot += x.ars; if (x.done) pd += x.ars; });
  return { tot, pd };
}

/**
 * Gasto por categoría del período (en ARS). Incluye gastos diarios, consumos de tarjeta
 * por fecha de compra, gastos fijos, costos del auto (sin el pago del alquiler), la cuota
 * diaria del auto e intereses de deudas. No incluye capital de deudas.
 */
export function spendByCat(S: State, k: string): { m: Record<string, number>; tot: number } {
  const m: Record<string, number> = {};
  let tot = 0;
  const add = (c: string, a: number) => { if (!(a > 0)) return; m[c] = (m[c] || 0) + a; tot += a; };
  const pk = (ds: string) => periodKey(ds, S.startDay);
  S.gastos.forEach((g) => { if (pk(g.date) === k) add(g.cat || 'Otros', num(g.amt)); });
  S.consumos.forEach((c) => { if (pk(c.date) === k) add(c.cat || 'Tarjeta sin categoría', toARS(num(c.amt), c.cur, S.rate)); });
  (S.months[k] ? S.months[k].fixed : []).forEach((f) => { if (!f.early) add(f.cat || 'Gastos fijos sin categoría', toARS(num(f.amt), f.cur, S.rate)); });
  S.uber.forEach((e) => { if (e.type === 'out' && e.cat !== CAR_RENT_CAT && pk(e.date) === k) add('Auto: ' + e.cat, num(e.amt)); });
  add('Auto: cuota del alquiler', uberReal(S, k).car);
  S.debts.forEach((d) => { d.payments.forEach((p) => { if (pk(p.date) === k) add('Intereses de deudas', toARS(num(p.interest), d.cur, S.rate)); }); });
  return { m, tot };
}
