import { ars, availAccounts, dayItems, dayStats, mlab, pendingAccounts, uberInAcc, uberReal, type DayItem } from '../calc';
import { ctx, type UType } from '../app/ctx';
import { $, cardHead, esc, st } from '../app/dom';
import { CATS } from '../state';
import type { Account } from '../types';

const UCAT: Record<UType, string[]> = { in: CATS.uin, out: CATS.auto, exp: CATS.gasto };
export const MEDL: Record<UType, string> = { in: 'Entra a', out: 'Sale de', exp: 'Pagué con' };

export function dayLabel(ds: string): string {
  try { return new Date(ds + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' }); } catch { return ds; }
}

function catOpts(t: UType): string {
  return UCAT[t].map((c) => '<option>' + esc(c) + '</option>').join('');
}

/** Opciones de "Entra a / Sale de / Pagué con": cuentas y, para gastos, tarjetas. */
function medOpts(t: UType): string {
  const S = ctx.S;
  // Las pendientes de retiro (Uber, Didi, Cabify) solo reciben ingresos Uber; ahí se proponen primero.
  const sel = t === 'in' ? uberInAcc(S) : S.defAcc, opt = (a: Account) => '<option value="' + esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.name) + '</option>';
  const pe = t === 'in' ? pendingAccounts(S) : [];
  let o = availAccounts(S).map(opt).join('');
  if (pe.length) o += '<optgroup label="Pendientes de retiro">' + pe.map(opt).join('') + '</optgroup>';
  if (!o) o = '<option value="">(sin cuenta)</option>';
  if (t === 'exp' && S.cards.length) o += '<optgroup label="Tarjeta de crédito">' + S.cards.map((c) => '<option value="card:' + esc(c.id) + '">' + esc(c.name) + '</option>').join('') + '</optgroup>';
  return o;
}

export function fillUForm(): void {
  const c = $('#u-cat'), m = $('#u-med'), l = $('#u-medl');
  if (c) c.innerHTML = catOpts(ctx.uType);
  if (m) m.innerHTML = medOpts(ctx.uType);
  if (l) l.textContent = MEDL[ctx.uType];
}

export function vUber(): string {
  const S = ctx.S, key = ctx.key, u = uberReal(S, key), td = dayStats(S, ctx.todayD), items = dayItems(S, key), days: Record<string, DayItem[]> = {};
  items.forEach((x) => { (days[x.date] = days[x.date] || []).push(x); });
  const ds = Object.keys(days).sort().reverse();
  const rad = (v: UType, l: string, c?: string) => '<label' + (c ? ' class="' + c + '"' : '') + '><input type="radio" name="utype" value="' + v + '"' + (ctx.uType === v ? ' checked' : '') + '>' + l + '</label>';
  let h = '<section class="card" ' + st('uber') + '>' + cardHead('uber', 'Anotar movimiento')
    + '<form id="uform" style="display:flex;flex-direction:column;gap:10px"><div class="seg" role="radiogroup" aria-label="Tipo de movimiento">' + rad('in', 'Ingreso Uber') + rad('out', 'Gasto del auto', 'out') + rad('exp', 'Otro gasto', 'exp') + '</div>'
    + '<label class="fld" for="u-amt"><span>Monto ($ ARS)</span><input id="u-amt" class="big-in" type="number" step="any" min="0" inputmode="decimal" placeholder="0"></label>'
    + '<div class="form"><label class="fld" for="u-cat"><span>Categoría</span><select id="u-cat">' + catOpts(ctx.uType) + '</select></label><label class="fld" for="u-med"><span id="u-medl">' + MEDL[ctx.uType] + '</span><select id="u-med">' + medOpts(ctx.uType) + '</select></label></div>'
    + '<div class="form"><label class="fld" for="u-date"><span>Fecha</span><input id="u-date" type="date" value="' + ctx.todayD + '"></label><label class="fld" for="u-note"><span>Nota (opcional)</span><input id="u-note" type="text" placeholder="Ej: 8 viajes"></label></div>'
    + '<button class="btn pri block" type="submit">Agregar</button></form></section>';
  h += '<section class="card" ' + st('uber') + '>' + cardHead('uber', 'Hoy · ' + esc(dayLabel(ctx.todayD)))
    + '<div class="kpis"><div class="kpi"><span>Ingresó</span><b>' + ars(td.in) + '</b></div><div class="kpi"><span>Gastos del auto</span><b>' + ars(td.out) + '</b></div><div class="kpi"><span>Cuota del auto</span><b>' + ars(td.car) + '</b></div><div class="kpi c"><span>Ganancia real</span><b>' + ars(td.profit) + '</b></div></div>'
    + '<label class="inl" for="carDaily">Cuota diaria del auto que apartás ($) <input id="carDaily" type="number" step="any" min="0" inputmode="decimal" style="width:7rem" value="' + esc(S.carDaily || '') + '"></label>'
    + '<p class="hint">Ganancia real = lo que ingresó menos los gastos del auto y la cuota diaria del alquiler. El pago semanal del jueves anotalo como "Pago alquiler del auto": mueve la cuenta pero no cuenta como gasto de nuevo.</p></section>';
  h += '<section class="card" ' + st('uber') + '>' + cardHead('uber', 'Uber de ' + mlab(key).toLowerCase())
    + '<div class="kpis"><div class="kpi"><span>Ingresos</span><b>' + ars(u.inn) + '</b></div><div class="kpi"><span>Gastos del auto</span><b>' + ars(u.out) + '</b></div><div class="kpi"><span>Cuota del auto</span><b>' + ars(u.car) + '</b></div><div class="kpi c"><span>Ganancia real</span><b>' + ars(u.profit) + '</b></div><div class="kpi"><span>Días trabajados</span><b>' + u.days + '</b></div><div class="kpi"><span>Ganancia por día</span><b>' + ars(u.perDay) + '</b></div></div></section>';
  h += '<section class="card" ' + st('uber') + '>' + cardHead('uber', 'Día por día')
    + (ds.length ? ds.map((d) => {
      const es = days[d], t = dayStats(S, d), sp = es.filter((x) => x.kind === 'exp' || x.kind === 'card').reduce((a, x) => a + x.amt, 0);
      return '<div class="day"><div class="day-h"><b>' + esc(dayLabel(d)) + '</b><span class="num ' + (t.in > 0 ? (t.profit >= 0 ? 'pos' : 'neg') : '') + '">' + (t.in > 0 ? 'Ganancia ' + ars(t.profit) : 'Gastos ' + ars(sp)) + '</span></div>'
        + es.sort((a, b) => b.ts - a.ts).map((e) => {
          const lab = { in: 'Ingreso', out: 'Auto', exp: 'Gasto', card: 'Tarjeta' }[e.kind];
          const btn = e.kind === 'card' ? '<button class="x" type="button" data-act="edit-consumo" aria-label="Editar consumo">✎</button>' : '<button class="x" type="button" data-act="' + (e.kind === 'exp' ? 'del-gasto' : 'del-uber') + '" aria-label="Quitar movimiento">×</button>';
          return '<div class="ent" data-uid="' + esc(e.id) + '" data-gid="' + esc(e.id) + '" data-cid="' + esc(e.id) + '"><span class="tag ' + e.kind + '">' + lab + '</span><div class="t">' + esc(e.cat || '') + (e.note ? ' <small>· ' + esc(e.note) + '</small>' : '') + '</div><span class="num">' + (e.kind === 'in' ? '' : '−') + ars(e.amt) + '</span>' + btn + '</div>';
        }).join('') + '</div>';
    }).join('') : '<p class="empty">Todavía no anotaste movimientos en este período.</p>') + '</section>';
  return h;
}
