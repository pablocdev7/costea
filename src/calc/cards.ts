import type { Card, Consumo, State } from '../types';
import { periodKey } from './period';
import { num, pad, shiftKey, toARS } from './util';

/**
 * Mes calendario ('AAAA-MM') en que vence el resumen que incluye un consumo de fecha ds.
 * Si el consumo es posterior al cierre, entra en el resumen del mes siguiente.
 * Si el vencimiento es un día menor o igual al cierre, vence el mes posterior al cierre.
 */
export function dueCal(c: Card, ds: string): string {
  const p = ds.split('-').map(Number);
  let ck = p[0] + '-' + pad(p[1]);
  if (p[2] > num(c.closeDay)) ck = shiftKey(ck, 1);
  return num(c.dueDay) > num(c.closeDay) ? ck : shiftKey(ck, 1);
}

/** Período (según el día de arranque) en que se paga el resumen que incluye el consumo. */
export function dueKeyFor(c: Card, ds: string, startDay: State['startDay']): string {
  return periodKey(dueCal(c, ds) + '-' + pad(num(c.dueDay) || 1), startDay);
}

export interface StmtInfo {
  card: Card;
  k: string;
  items: Consumo[];
  /** Suma de los consumos registrados (en ARS). */
  reg: number;
  /** Total real cargado del resumen (0 si no se cargó). */
  real: number;
  /** Lo que hay que pagar: el real si existe, si no lo registrado. */
  toPay: number;
  paid: boolean;
}

/** Resumen de la tarjeta c que se paga en el período k. */
export function stmtOf(S: State, c: Card, k: string): StmtInfo {
  const items = S.consumos.filter((x) => x.cardId === c.id && dueKeyFor(c, x.date, S.startDay) === k);
  const reg = items.reduce((a, x) => a + toARS(num(x.amt), x.cur, S.rate), 0);
  const st0 = S.stmts[c.id + '|' + k] || {};
  const real = num(st0.real);
  return { card: c, k, items, reg, real, toPay: real > 0 ? real : reg, paid: !!st0.paid };
}
