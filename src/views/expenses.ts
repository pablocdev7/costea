import { ars, dueKeyFor, mlab, num, secOf, shiftKey, stmtOf, usd } from '../calc';
import { ctx, dOf, mo, tot } from '../app/ctx';
import { cardHead, esc, st } from '../app/dom';
import type { Card, Consumo } from '../types';
import { entryRow, itemRow } from './rows';

export function consRows(items: Consumo[]): string {
  return items.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) =>
    '<div class="hrow" data-cid="' + esc(x.id) + '"><span class="num">' + esc(x.date.slice(5).split('-').reverse().join('/')) + '</span><div>' + esc(x.name || 'Consumo') + (x.ex ? '<span class="ex">ejemplo</span>' : '') + ' <span class="num">' + (x.cur === 'USD' ? usd(num(x.amt)) : ars(num(x.amt))) + '</span></div><button class="x" type="button" data-act="edit-consumo" aria-label="Editar consumo">✎</button></div>',
  ).join('');
}

function cardBox(c: Card): string {
  const S = ctx.S, key = ctx.key;
  const s = stmtOf(S, c, key), ck = dueKeyFor(c, ctx.todayD, S.startDay), cur = ck !== key ? stmtOf(S, c, ck) : null;
  let diff = '';
  const chip = s.toPay > 0 ? (s.paid ? '<span class="chip ok">Pagado</span>' : '<span class="chip wn">Por pagar · vence el día ' + esc(c.dueDay) + '</span>') : '<span class="chip nn">Sin resumen este mes</span>';
  if (s.real > 0 && s.reg > 0) {
    const d = s.real - s.reg;
    diff = Math.abs(d) < 1 ? '<p class="hint">El resumen coincide con lo que registraste.</p>' : '<p class="hint">Registraste ' + ars(s.reg) + ' y el resumen dice ' + ars(s.real) + ': diferencia de ' + ars(d) + '.' + (d > 0 ? ' Puede ser algo que no anotaste, intereses o impuestos.' : ' Revisá si anotaste de más.') + '</p>';
  } else if (s.real > 0) diff = '<p class="hint">Monto cargado del resumen. No hay consumos registrados para compararlo.</p>';
  else if (s.reg > 0) diff = '<p class="hint">Suma de los consumos que registraste. Cuando llegue el resumen, cargá su monto para verificarlo.</p>';
  return '<section class="card" ' + st('card') + ' data-card="' + esc(c.id) + '"><div class="card-h"><div class="dtitle"><h2>' + esc(c.name || 'Tarjeta') + '</h2>' + (c.ex ? '<span class="ex">ejemplo</span>' : '') + '</div><button class="link" type="button" data-act="edit-card">Editar</button></div>'
    + '<p class="hint">Cierra el día ' + esc(c.closeDay) + ' · vence el día ' + esc(c.dueDay) + '</p>'
    + '<div class="stat"><span class="hint">Resumen de ' + mlab(key).toLowerCase() + '</span><span class="v">' + ars(s.toPay) + '</span></div>' + chip + diff
    + '<div class="btns"><button class="btn pri" type="button" data-act="toggle-stmt" data-card="' + esc(c.id) + '">' + (s.paid ? 'Desmarcar pago' : 'Marcar pagado') + '</button><button class="btn" type="button" data-act="stmt-sheet" data-card="' + esc(c.id) + '">Cargar monto del resumen</button><button class="btn" type="button" data-act="add-consumo" data-card="' + esc(c.id) + '">+ Consumo</button></div>'
    + '<details><summary>Consumos de este resumen (' + s.items.length + ')</summary>' + (s.items.length ? consRows(s.items) : '<p class="empty">No hay consumos para este resumen.</p>') + '</details>'
    + (cur && cur.reg > 0 ? '<p class="hint">Ciclo en curso: ' + ars(cur.reg) + ' en consumos van al resumen de ' + mlab(ck).toLowerCase() + '.</p>' : '') + '</section>';
}

export function vExpenses(): string {
  const S = ctx.S, key = ctx.key, m = mo(key), t = tot(key), sf = secOf(t, 'fixed'), de = t.e.filter((x) => x.sec === 'debts'), nk = shiftKey(key, 1), nm = S.months[nk];
  const fl = m.fixed.filter((f) => !f.early).map((f) => ({ f, mk: key }))
    .concat(nm ? nm.fixed.filter((f) => f.early).map((f) => ({ f, mk: nk })) : []);
  const dk0 = (o: { f: { day?: unknown }; mk: string }) => (num(o.f.day as number) ? dOf(o.mk, num(o.f.day as number)) : '9999');
  fl.sort((a, b) => (dk0(a) < dk0(b) ? -1 : dk0(a) > dk0(b) ? 1 : 0));
  return '<section class="card" ' + st('fix') + '>' + cardHead('fix', 'Gastos fijos', '<span class="sub"><b class="num">' + ars(sf.pd) + '</b> de <b class="num">' + ars(sf.tot) + '</b></span>')
    + (fl.length ? '<div class="list">' + fl.map((o) => itemRow('fixed', o.f, o.mk)).join('') + '</div>' : '<p class="empty">Todavía no cargaste gastos fijos.</p>')
    + '<button class="add" type="button" data-act="add" data-sec="fixed">+ Agregar gasto fijo</button></section>'
    + '<section class="card" ' + st('card') + '>' + cardHead('card', 'Tarjetas') + '<p class="hint">Cada tarjeta tiene su cierre y vencimiento. Anotá los consumos y el resumen de cada mes se arma solo, o cargá el monto del resumen directamente.</p>'
    + '<div class="btns"><button class="add" style="flex:1" type="button" data-act="add-card">+ Tarjeta</button><button class="add" style="flex:1" type="button" data-act="add-consumo">+ Consumo</button></div></section>'
    + S.cards.map(cardBox).join('')
    + '<section class="card" ' + st('debt') + '>' + cardHead('debt', 'Cuotas de deudas del mes', '<button class="link" type="button" data-act="go" data-tab="debts">Ir a Deudas ›</button>')
    + (de.length ? '<div class="list">' + de.map((x) => entryRow(x)).join('') + '</div>' : '<p class="empty">No hay cuotas de deudas este mes.</p>') + '</section>';
}
