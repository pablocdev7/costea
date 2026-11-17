import type { State } from '../types';
import { periodKey } from './period';
import { num, toARS } from './util';

/** Categoría del pago semanal del alquiler: mueve la cuenta pero no es gasto (ya se aparta como cuota diaria). */
export const CAR_RENT_CAT = 'Pago alquiler del auto';

export interface UberStats {
  inn: number;
  out: number;
  net: number;
  days: number;
  /** Neto promedio por día trabajado. */
  avg: number;
}

/** Neto de caja de Uber en el período (incluye el pago del alquiler como salida). */
export function uberStats(S: State, k: string): UberStats {
  const es = S.uber.filter((e) => periodKey(e.date, S.startDay) === k);
  let inn = 0, out = 0;
  const days: Record<string, 1> = {};
  es.forEach((e) => { if (e.type === 'in') { inn += num(e.amt); days[e.date] = 1; } else out += num(e.amt); });
  const nd = Object.keys(days).length;
  return { inn, out, net: inn - out, days: nd, avg: nd ? (inn - out) / nd : 0 };
}

export interface UberDayRow { date: string; in: number; out: number; car: number; profit: number }

export interface UberReal {
  inn: number;
  /** Gastos del auto sin el pago del alquiler. */
  out: number;
  fuel: number;
  /** Cuota diaria × días trabajados. */
  car: number;
  profit: number;
  days: number;
  perDay: number;
  fuelDay: number;
  rows: UberDayRow[];
}

/** Ganancia real = ingresos − gastos del auto − cuota diaria × días trabajados. */
export function uberReal(S: State, k: string): UberReal {
  const es = S.uber.filter((e) => periodKey(e.date, S.startDay) === k);
  const by: Record<string, { in: number; out: number }> = {};
  let inn = 0, out = 0, fuel = 0;
  es.forEach((e) => {
    const a = num(e.amt);
    const d = (by[e.date] = by[e.date] || { in: 0, out: 0 });
    if (e.type === 'in') { inn += a; d.in += a; }
    else if (e.cat !== CAR_RENT_CAT) { out += a; d.out += a; if (e.cat === 'Combustible') fuel += a; }
  });
  const ds = Object.keys(by).sort();
  const nd = ds.filter((x) => by[x].in > 0).length;
  const car = num(S.carDaily) * nd;
  const rows = ds.map((x) => {
    const c = by[x].in > 0 ? num(S.carDaily) : 0;
    return { date: x, in: by[x].in, out: by[x].out, car: c, profit: by[x].in - by[x].out - c };
  });
  const profit = inn - out - car;
  return { inn, out, fuel, car, profit, days: nd, perDay: nd ? profit / nd : 0, fuelDay: nd ? fuel / nd : 0, rows };
}

/** Ganancia real de un día. */
export function dayStats(S: State, ds: string): { in: number; out: number; car: number; profit: number } {
  let inn = 0, out = 0;
  S.uber.forEach((e) => {
    if (e.date !== ds) return;
    const a = num(e.amt);
    if (e.type === 'in') inn += a;
    else if (e.cat !== CAR_RENT_CAT) out += a;
  });
  const car = inn > 0 ? num(S.carDaily) : 0;
  return { in: inn, out, car, profit: inn - out - car };
}

export interface DayItem {
  date: string;
  ts: number;
  kind: 'in' | 'out' | 'exp' | 'card';
  id: string;
  cat: string;
  note?: string;
  /** Monto en ARS. */
  amt: number;
}

/** Movimientos del día a día del período: Uber, gastos y consumos de tarjeta. */
export function dayItems(S: State, k: string): DayItem[] {
  const L: DayItem[] = [];
  S.uber.forEach((e) => { if (periodKey(e.date, S.startDay) === k) L.push({ date: e.date, ts: e.ts || 0, kind: e.type, id: e.id, cat: e.cat, note: e.note, amt: num(e.amt) }); });
  S.gastos.forEach((g) => { if (periodKey(g.date, S.startDay) === k) L.push({ date: g.date, ts: g.ts || 0, kind: 'exp', id: g.id, cat: g.cat, note: g.name, amt: num(g.amt) }); });
  S.consumos.forEach((c) => {
    if (periodKey(c.date, S.startDay) !== k) return;
    const cd = S.cards.find((x) => x.id === c.cardId);
    L.push({ date: c.date, ts: 0, kind: 'card', id: c.id, cat: c.cat || 'Tarjeta', note: (cd ? cd.name : '') + (c.name ? ' · ' + c.name : ''), amt: toARS(num(c.amt), c.cur, S.rate) });
  });
  return L;
}
