import { ars, debtBalance, fixedInfo, fmt1, fmtRate, loanInfo, money, num, paidIn, secOf, usd } from '../calc';
import { ctx, tot } from '../app/ctx';
import { cardHead, esc, st } from '../app/dom';
import type { Debt } from '../types';

function histRows(d: Debt): string {
  if (!d.payments.length) return '<p class="empty">Todavía no registraste pagos.</p>';
  return d.payments.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((p) => {
    const det = d.kind === 'loan'
      ? '<span class="num">' + money(d.cur, num(p.paid)) + '</span> <small>· interés ' + money(d.cur, num(p.interest)) + ' · capital ' + money(d.cur, num(p.capital)) + '</small>'
      : '<span class="num">' + money(d.cur, num(p.paid)) + '</span>';
    return '<div class="hrow" data-pid="' + esc(p.id) + '"><span class="num">' + esc(p.date) + '</span><div>' + det + '</div><button class="x" type="button" data-act="del-pay" aria-label="Quitar pago">×</button></div>';
  }).join('');
}

function debtCard(d: Debt): string {
  const paid = paidIn(d, ctx.key, ctx.S.startDay) > 0;
  const chip = paid ? '<span class="chip ok">Pagado este mes</span>' : '<span class="chip wn">Pendiente este mes' + (num(d.day) ? ' · día ' + esc(d.day) : '') + '</span>';
  let body: string;
  if (d.kind === 'loan') {
    const li = loanInfo(d), p = num(d.principal) > 0 ? li.cap / num(d.principal) * 100 : 0;
    body = '<div class="stat"><span class="hint">Saldo de capital</span><span class="v">' + money(d.cur, li.bal) + '</span></div>' + chip
      + '<div class="kpis"><div class="kpi"><span>Interés del próximo pago</span><b>' + money(d.cur, li.nextInt) + '</b></div><div class="kpi"><span>Capital devuelto</span><b>' + money(d.cur, li.cap) + '</b></div><div class="kpi"><span>Interés pagado</span><b>' + money(d.cur, li.int) + '</b></div></div>'
      + '<div><div class="bar"><i style="width:' + Math.min(100, p) + '%"></i></div><p class="hint" style="margin-top:4px">Devolviste el ' + fmt1(p) + '% de ' + money(d.cur, num(d.principal)) + '.' + (num(d.rate) ? ' Interés ' + fmtRate(num(d.rate)) + '% ' + (d.ratePer === 'y' ? 'anual' : 'mensual') + '.' : '') + '</p></div>'
      + '<button class="btn pri block" type="button" data-act="pay-loan">Registrar pago</button>';
  } else {
    const fi = fixedInfo(d), pp = fi.tot > 0 ? fi.n / fi.tot * 100 : 0;
    body = '<div class="stat"><span class="hint">Cuotas pagadas</span><span class="v">' + fi.n + (fi.tot > 0 ? ' de ' + fi.tot : '') + '</span></div>' + chip
      + '<div class="kpis"><div class="kpi"><span>Cuota</span><b>' + money(d.cur, num(d.amount)) + '</b></div><div class="kpi"><span>Faltan</span><b>' + (fi.left == null ? '—' : fi.left + ' cuotas') + '</b></div><div class="kpi"><span>Falta pagar</span><b>' + (fi.remain == null ? '—' : money(d.cur, fi.remain)) + '</b></div></div>'
      + (fi.tot > 0 ? '<div class="bar"><i style="width:' + Math.min(100, pp) + '%"></i></div>' : '')
      + '<button class="btn pri block" type="button" data-act="pay-fixed">Registrar pago de la cuota</button>';
  }
  return '<section class="card" ' + st('debt') + ' data-debt="' + esc(d.id) + '"><div class="card-h"><div class="dtitle"><h2>' + esc(d.name || 'Deuda sin nombre') + '</h2><span class="kind">' + (d.kind === 'loan' ? 'Préstamo con interés' : 'Cuotas fijas') + '</span>' + (d.ex ? '<span class="ex">ejemplo</span>' : '') + '</div><button class="link" type="button" data-act="edit-debt">Editar</button></div>'
    + (d.who ? '<p class="hint">Le debés a ' + esc(d.who) + '</p>' : '') + body
    + '<details><summary>Pagos registrados (' + d.payments.length + ')</summary>' + histRows(d) + '</details></section>';
}

export function vDebts(): string {
  const S = ctx.S;
  let ou = 0, oa = 0;
  S.debts.forEach((d) => { const b = debtBalance(d); if (b == null) return; if (d.cur === 'USD') ou += b; else oa += b; });
  const sd = secOf(tot(ctx.key), 'debts');
  return '<section class="card" ' + st('debt') + '>' + cardHead('debt', 'Lo que debés')
    + '<div class="kpis"><div class="kpi c"><span>En dólares</span><b>' + usd(ou) + '</b></div><div class="kpi c"><span>En pesos</span><b>' + ars(oa) + '</b></div><div class="kpi"><span>Cuotas de este mes</span><b>' + ars(sd.pd) + ' de ' + ars(sd.tot) + '</b></div></div>'
    + '<div class="btns"><button class="add" style="flex:1" type="button" data-act="add-loan">+ Préstamo con interés</button><button class="add" style="flex:1" type="button" data-act="add-fixed">+ Deuda en cuotas fijas</button></div></section>'
    + (S.debts.length ? S.debts.map(debtCard).join('') : '<p class="empty">No cargaste deudas todavía.</p>');
}
