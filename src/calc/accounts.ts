import type { Account, State } from '../types';
import { num, r2, toARS } from './util';

export interface Flow {
  acc: string;
  /** Monto en ARS: positivo entra, negativo sale. */
  amt: number;
  ts: number;
}

function accOf(S: State, x: { acc?: string }): string {
  return x.acc || S.defAcc || '';
}

/** Todos los movimientos de plata con su cuenta y momento. */
export function flowsAll(S: State): Flow[] {
  const f: Flow[] = [];
  S.uber.forEach((e) => { if (e.ts) f.push({ acc: accOf(S, e), amt: (e.type === 'in' ? 1 : -1) * num(e.amt), ts: e.ts }); });
  S.gastos.forEach((g) => { if (g.ts) f.push({ acc: accOf(S, g), amt: -num(g.amt), ts: g.ts }); });
  Object.keys(S.months).forEach((k) => {
    const m = S.months[k];
    m.income.forEach((i) => { if (i.done && i.doneAt) f.push({ acc: accOf(S, i), amt: toARS(num(i.amt), i.cur, S.rate), ts: i.doneAt }); });
    m.fixed.forEach((x) => { if (x.done && x.doneAt) f.push({ acc: accOf(S, x), amt: -toARS(num(x.amt), x.cur, S.rate), ts: x.doneAt }); });
  });
  S.debts.forEach((d) => { d.payments.forEach((p) => { if (p.ts) f.push({ acc: accOf(S, p), amt: -toARS(num(p.paid), d.cur, S.rate), ts: p.ts }); }); });
  Object.keys(S.stmts).forEach((k) => { const s = S.stmts[k]; if (s.paid && s.paidAt) f.push({ acc: accOf(S, s), amt: -num(s.amt), ts: s.paidAt }); });
  S.transfers.forEach((t) => { f.push({ acc: t.from, amt: -num(t.amt), ts: t.ts }, { acc: t.to, amt: num(t.amt), ts: t.ts }); });
  return f;
}

function balWith(a: Account, fl: Flow[]): number {
  let b = num(a.base);
  fl.forEach((f) => { if (f.acc === a.id && f.ts >= num(a.baseAt)) b += f.amt; });
  return b;
}

/** Saldo de una cuenta: saldo base + movimientos desde baseAt (inclusive). */
export function accBal(S: State, a: Account): number {
  return balWith(a, flowsAll(S));
}

/** Suma de los saldos de las cuentas disponibles (sin las pendientes de retiro). */
export function accTotal(S: State): number {
  const fl = flowsAll(S);
  return S.accounts.reduce((s, a) => (a.pending ? s : s + balWith(a, fl)), 0);
}

/** Suma de los saldos de las cuentas pendientes de retiro. */
export function pendingTotal(S: State): number {
  const fl = flowsAll(S);
  return S.accounts.reduce((s, a) => (a.pending ? s + balWith(a, fl) : s), 0);
}

/** ¿Hay alguna cuenta disponible? Si no, la plata de hoy se ajusta a mano. */
export function hasAvail(S: State): boolean {
  return S.accounts.some((a) => !a.pending);
}

export const availAccounts = (S: State): Account[] => S.accounts.filter((a) => !a.pending);
export const pendingAccounts = (S: State): Account[] => S.accounts.filter((a) => a.pending);

/** Cuenta destino vinculada de una pendiente, solo si sigue existiendo y es disponible. */
export function linkedTarget(S: State, a: Account): Account | undefined {
  const to = a.withdrawTo ? S.accounts.find((b) => b.id === a.withdrawTo) : undefined;
  return to && !to.pending ? to : undefined;
}

/**
 * Retira plata de una cuenta pendiente a una disponible: registra una transferencia.
 * Lo que no se retira queda pendiente. Devuelve un mensaje de error o null si salió bien.
 */
export function withdraw(S: State, fromId: string, toId: string, amt: number, ts: number, id: string): string | null {
  const from = S.accounts.find((a) => a.id === fromId), to = S.accounts.find((a) => a.id === toId);
  if (!from || !from.pending) return 'Esa cuenta no es pendiente de retiro.';
  if (!to || to.pending) return 'Elegí una cuenta disponible como destino.';
  if (!(amt > 0)) return 'Poné un monto mayor a cero.';
  if (amt > r2(accBal(S, from)) + 0.005) return 'No podés retirar más de lo que hay pendiente.';
  S.transfers.push({ id, from: fromId, to: toId, amt: r2(amt), note: 'Retiro', ts });
  return null;
}

/** Fija el saldo real de una cuenta desde ahora. Devuelve la diferencia con el saldo anterior. */
export function adjustTo(S: State, a: Account, bal: number, ts: number): number {
  const diff = r2(bal - accBal(S, a));
  a.base = r2(bal);
  a.baseAt = ts;
  return diff;
}

/**
 * Cuenta que se propone en "Entra a" para un ingreso Uber: la última pendiente que se usó
 * en un ingreso, o la primera pendiente; si no hay pendientes, la de por defecto.
 */
export function uberInAcc(S: State): string {
  const pend = pendingAccounts(S);
  if (!pend.length) return S.defAcc || '';
  let best: { acc: string; ts: number } | null = null;
  S.uber.forEach((e) => {
    if (e.type !== 'in' || !e.acc || !e.ts || !pend.some((a) => a.id === e.acc)) return;
    if (!best || e.ts > best.ts) best = { acc: e.acc, ts: e.ts };
  });
  return best ? (best as { acc: string }).acc : pend[0].id;
}
