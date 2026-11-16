import { ars, mlab, num, usd, whenTxt, type Entry, type OrderedEntry } from '../calc';
import { ctx, dOf } from '../app/ctx';
import { amtHtml, esc, st } from '../app/dom';
import type { Item } from '../types';

export const SC: Record<string, string> = { income: 'inc', fixed: 'fix', card: 'card', debts: 'debt', uber: 'uber' };

export function when(dt: string) {
  return whenTxt(dt, ctx.key === ctx.todayKey, ctx.todayD);
}

/** Fila de ingreso o gasto fijo con su tilde. */
export function itemRow(sec: 'income' | 'fixed', it: Item, mk?: string): string {
  mk = mk || ctx.key;
  const pre = sec === 'fixed' && mk !== ctx.key ? 'De ' + mlab(mk).toLowerCase() + ' · ' : '';
  let meta: string, late = false, cls = '';
  if (sec === 'income') { meta = it.done ? 'Cobrado' : 'Por cobrar'; cls = it.done ? 'ok' : ''; }
  else if (it.done) { meta = 'Pagado'; cls = 'ok'; }
  else { const w = when(num(it.day) ? dOf(mk, num(it.day)) : '9999-99-99'); meta = w.t; late = w.late; }
  return '<div class="item' + (it.done ? ' done' : '') + '" data-sec="' + sec + '" data-id="' + esc(it.id) + '" data-mk="' + mk + '">'
    + '<input type="checkbox" class="chk" data-act="toggle"' + (it.done ? ' checked' : '') + ' aria-label="' + (sec === 'income' ? 'Cobrado' : 'Pagado') + '">'
    + '<button class="body" type="button" data-act="edit"><span class="nm">' + esc(it.name || 'Sin nombre') + (it.ex ? '<span class="ex">ejemplo</span>' : '') + '</span><span class="meta' + (late ? ' late' : '') + (cls ? ' ' + cls : '') + '">' + esc(pre + meta) + '</span></button>'
    + '<div class="amt">' + amtHtml(it.cur, num(it.amt)) + '</div></div>';
}

/** Fila de "Por pagar": gasto fijo, cuota de deuda o resumen de tarjeta. */
export function entryRow(x: Entry, cov?: OrderedEntry): string {
  const w = when(x.dt);
  let meta = w.t, late = w.late, cls = '';
  const pre = x.sec === 'fixed' && x.early ? 'De ' + mlab(x.mk!).toLowerCase() + ' · ' : '';
  if (x.done) { meta = 'Pagado'; late = false; cls = 'ok'; }
  else if (cov) { if (cov.covered) meta += ' · cubierto'; else { meta += ' · faltan ' + ars(cov.short); cls = 'no'; } }
  let left: string, edit: string;
  if (x.sec === 'fixed') {
    left = '<input type="checkbox" class="chk" data-act="toggle" data-sec="fixed" data-id="' + esc(x.id) + '" data-mk="' + x.mk + '"' + (x.done ? ' checked' : '') + ' aria-label="Pagado">';
    edit = '<button class="body" type="button" data-act="edit" data-sec="fixed" data-id="' + esc(x.id) + '" data-mk="' + x.mk + '">';
  } else if (x.sec === 'debts') {
    left = '<input type="checkbox" class="chk" data-act="pay-entry" data-debt="' + esc(x.debt) + '"' + (x.done ? ' checked disabled' : '') + ' aria-label="Registrar pago">';
    edit = '<button class="body" type="button" data-act="go" data-tab="debts">';
  } else {
    left = '<input type="checkbox" class="chk" data-act="toggle-stmt" data-card="' + esc(x.cardId) + '"' + (x.done ? ' checked' : '') + ' aria-label="Resumen pagado">';
    edit = '<button class="body" type="button" data-act="go" data-tab="expenses">';
  }
  return '<div class="item' + (x.done ? ' done' : '') + '" ' + st(SC[x.sec]) + '>' + left + edit + '<span class="nm"><span class="dot"></span> ' + esc(x.label) + '</span><span class="meta' + (late ? ' late' : '') + (cls ? ' ' + cls : '') + '">' + esc(pre + meta) + '</span></button>'
    + '<div class="amt">' + ars(x.ars) + (x.orig != null ? '<small>' + usd(x.orig) + '</small>' : '') + '</div></div>';
}
