import { accBal, accTotal, ars, hasAvail, num, orderList, pendingTotal, usd } from '../calc';
import { ctx, mo, tot } from '../app/ctx';
import { cardHead, esc, st } from '../app/dom';
import type { State } from '../types';
import { entryRow, itemRow, when } from './rows';

function accRows(list: State['accounts']): string {
  const S = ctx.S;
  return '<div class="list">' + list.map((a) => '<div class="item noleft"><button class="body" type="button" data-act="edit-account" data-acc="' + esc(a.id) + '"><span class="nm">' + esc(a.name) + (a.id === S.defAcc ? '<span class="chip nn" style="margin-left:6px">por defecto</span>' : '') + '</span><span class="meta">Tocá para ajustar el saldo</span></button><div class="amt">' + ars(accBal(S, a)) + '</div></div>').join('') + '</div>';
}

function accGroup(title: string, total: number, note: string, body: string): string {
  return '<div class="accgrp"><div class="accgrp-h"><p class="eyebrow">' + title + '</p><b class="num">' + ars(total) + '</b></div>' + (note ? '<p class="hint">' + note + '</p>' : '') + body + '</div>';
}

export function accountsCard(): string {
  const S = ctx.S, total = accTotal(S), avail = S.accounts.filter((a) => !a.pending), pend = S.accounts.filter((a) => a.pending);
  return '<section class="card" ' + st('accent') + '>' + cardHead('accent', 'Tus cuentas', '<span class="sub"><b class="num">' + ars(total) + '</b></span>')
    + (S.accounts.length
      ? accGroup('Disponibles', total, '', avail.length ? accRows(avail) : '<p class="empty">Todavía no tenés cuentas disponibles.</p>')
        + accGroup('Pendientes de retiro', pendingTotal(S), 'No cuenta como plata disponible.', pend.length ? accRows(pend) : '<p class="empty">Ninguna. Usalas para la plata que juntás en Uber, Didi o Cabify y todavía no retiraste.</p>')
      : '<p class="empty">Creá una cuenta por cada lugar donde tenés plata (banco, billetera, efectivo, cuenta del auto). Cada cobro, pago y gasto que registres mueve su saldo.</p>')
    + '<div class="btns"><button class="add" style="flex:1" type="button" data-act="add-account">+ Cuenta</button>' + (S.accounts.length > 1 ? '<button class="add" style="flex:1" type="button" data-act="transfer">Transferir</button>' : '') + '</div></section>';
}

export function vResumen(): string {
  const S = ctx.S, t = tot(ctx.key), r = num(S.rate), empty = t.incAll === 0 && t.expAll === 0;
  let cls = '', head: string;
  if (empty) head = 'Cargá tus ingresos y gastos para ver cómo cerrás el mes.';
  else if (t.close < 0) { cls = 'bad'; head = 'Te faltan <b>' + ars(-t.close) + '</b>' + (r ? ' (≈ ' + usd(-t.close / r) + ')' : '') + ' para cerrar el mes.'; }
  else { cls = 'good'; head = 'El mes cierra con <b>' + ars(t.close) + '</b> a favor.'; }
  let h = '<section class="answer ' + cls + '"><p class="eyebrow">Cierre proyectado</p><p class="headline">' + head + '</p>'
    + '<div class="three"><div><span>Plata hoy</span><b>' + ars(t.cash) + '</b></div><div><span>Por pagar</span><b>' + ars(t.expDue) + '</b></div><div><span>Por cobrar</span><b>' + ars(t.incPend) + '</b></div></div>'
    + (hasAvail(S) ? '' : '<p style="margin-top:10px"><button class="link" type="button" data-act="set-cash" ' + st('accent') + '>Ajustar la plata que tengo hoy</button></p>')
    + (t.close < 0 && t.u.avg > 0 ? '<p class="sub" style="margin-top:10px">Con tu promedio en Uber (' + ars(t.u.avg) + ' netos por día) son unos <b class="num">' + Math.ceil(-t.close / t.u.avg) + '</b> días de trabajo.</p>' : '') + '</section>';
  h += accountsCard();
  if (empty) h += '<section class="card" ' + st('accent') + '>' + cardHead('accent', 'Por dónde empezar') + '<ol style="margin:0;padding-left:1.2rem;display:flex;flex-direction:column;gap:6px"><li>Cargá tu sueldo en <b>Ingresos</b> y tus pagos en <b>Gastos</b>, con el día en que los pagás. Tildá lo que ya pagaste.</li><li>Agregá tus <b>tarjetas</b> (cierre y vencimiento) y tus <b>deudas</b>.</li><li>Al final creá tus <b>cuentas</b> con el saldo de hoy.</li><li>Cada día anotá en <b>Hoy</b>: Uber, combustible y gastos.</li></ol></section>';
  const items = orderList(t), first = items.filter((x) => !x.covered)[0];
  let call: string;
  if (!items.length) call = '<div class="callout ok">No queda nada por pagar este mes.</div>';
  else if (!first) call = '<div class="callout ok">Con lo que ya cobraste alcanza para todo lo que queda por pagar.</div>';
  else {
    const cover = t.incPend > 0 ? (first.short <= t.incPend ? ' Si cobrás lo pendiente, este tramo queda cubierto.' : ' Aun cobrando lo pendiente faltarían ' + ars(first.short - t.incPend) + '.') : '';
    call = '<div class="callout bad">Lo primero: conseguí <b class="num">' + ars(first.short) + '</b> para <b>' + esc(first.label) + '</b> (' + when(first.dt).t + '), contando solo lo ya cobrado.' + cover + '</div>';
  }
  const done = t.e.filter((x) => x.done);
  h += '<section class="card" ' + st('accent') + '>' + cardHead('accent', 'Por pagar', '<span class="sub"><b class="num">' + ars(t.expDue) + '</b></span>') + call
    + (items.length ? '<div class="list">' + items.map((x) => entryRow(x, x)).join('') + '</div>' : '')
    + (done.length ? '<details><summary>Ya pagado (' + done.length + ')</summary><div class="list">' + done.map((x) => entryRow(x)).join('') + '</div></details>' : '') + '</section>';
  const pend = mo(ctx.key).income.filter((i) => !i.done);
  h += '<section class="card" ' + st('inc') + '>' + cardHead('inc', 'Por cobrar', '<span class="sub"><b class="num">' + ars(t.incPend) + '</b></span>')
    + (pend.length ? '<div class="list">' + pend.map((i) => itemRow('income', i)).join('') + '</div>' : '<p class="empty">No tenés ingresos pendientes de cobrar.</p>')
    + '<p class="sub">Uber de este mes: <b class="num">' + ars(t.u.net) + '</b> netos, ya sumados como cobrados. <button class="link" type="button" data-act="go" data-tab="uber" ' + st('uber') + '>Abrir Uber ›</button></p></section>';
  const pi = t.incAll > 0 ? Math.round(t.incIn / t.incAll * 100) : 0, pe = t.expAll > 0 ? Math.round(t.expPaid / t.expAll * 100) : 0;
  h += '<section class="card">' + cardHead('accent', 'Cómo vas')
    + '<div class="pbar" ' + st('inc') + '><span>Cobrado</span><div class="bar"><i style="width:' + pi + '%"></i></div><span class="num">' + pi + '%</span></div>'
    + '<div class="pbar" ' + st('fix') + '><span>Pagado</span><div class="bar"><i style="width:' + pe + '%"></i></div><span class="num">' + pe + '%</span></div></section>';
  return h;
}
