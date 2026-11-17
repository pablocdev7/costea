/* Estado de la interfaz (lo que en el prototipo eran variables sueltas: S, key, tab…). */
import { dateOf, dstr, periodKey, totals, type Totals } from '../calc';
import { emptyState, ensureMonth } from '../state';
import type { Month, State } from '../types';

export type Tab = 'resumen' | 'income' | 'uber' | 'expenses' | 'debts' | 'analisis' | 'datos';
export type UType = 'in' | 'out' | 'exp';

export interface SheetCtx {
  kind: 'item' | 'debt' | 'payloan' | 'payfixed' | 'card' | 'consumo' | 'stmt' | 'account' | 'transfer' | 'cash';
  sec?: 'income' | 'fixed';
  id?: string | null;
  mk?: string;
  dkind?: 'loan' | 'fixed';
  cardId?: string;
}

/** Último elemento borrado, para "Deshacer". */
export type Undo =
  | { k: 'item'; key: string; sec: 'income' | 'fixed'; item: Month['income'][number]; ix: number }
  | { k: 'uber'; item: State['uber'][number]; ix: number }
  | { k: 'gasto'; item: State['gastos'][number]; ix: number }
  | { k: 'debt'; item: State['debts'][number]; ix: number }
  | { k: 'consumo'; item: State['consumos'][number]; ix: number }
  | { k: 'account'; item: State['accounts'][number]; ix: number; def: string }
  | { k: 'card'; item: State['cards'][number]; ix: number; cons: State['consumos']; sts: State['stmts'] }
  | { k: 'pay'; debt: string; item: State['debts'][number]['payments'][number]; ix: number };

export const ctx = {
  S: emptyState() as State,
  /** Período que se está mirando. */
  key: '',
  tab: 'resumen' as Tab,
  todayD: dstr(new Date()),
  todayKey: '',
  uType: 'in' as UType,
  sheet: null as SheetCtx | null,
  last: null as Undo | null,
  refocus: false,
};

/** Recalcula "hoy" (la app puede quedar abierta de un día para otro). */
export function refreshToday(): void {
  ctx.todayD = dstr(new Date());
  ctx.todayKey = periodKey(ctx.todayD, ctx.S.startDay);
}

/** Reemplaza el estado completo y vuelve al período actual. */
export function setState(S: State): void {
  delete S._rs;
  ctx.S = S;
  refreshToday();
  ctx.key = ctx.todayKey;
  ensureMonth(S, ctx.key);
}

export const mo = (k: string): Month => ensureMonth(ctx.S, k);
export const pk = (ds: string): string => periodKey(ds, ctx.S.startDay);
export const dOf = (k: string, d: number): string => dateOf(k, d, ctx.S.startDay);
export const tot = (k: string): Totals => totals(ctx.S, k, ctx.todayKey);
