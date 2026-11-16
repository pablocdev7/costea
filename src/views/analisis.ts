import { ars, num, shiftKey, spendByCat, toARS, uberReal } from '../calc';
import { ctx } from '../app/ctx';
import { cardHead, esc, st } from '../app/dom';

export function vAnalisis(): string {
  const S = ctx.S, key = ctx.key, u = uberReal(S, key), sp = spendByCat(S, key), pv = spendByCat(S, shiftKey(key, -1));
  let h = '';
  const keep = u.inn > 0 ? Math.round(u.profit / u.inn * 100) : 0;
  h += '<section class="card" ' + st('uber') + '>' + cardHead('uber', 'Cuánto te deja Uber')
    + '<div class="kpis"><div class="kpi"><span>Ingresos</span><b>' + ars(u.inn) + '</b></div><div class="kpi c"><span>Ganancia real</span><b>' + ars(u.profit) + '</b></div><div class="kpi"><span>Te queda</span><b>' + keep + '%</b></div><div class="kpi"><span>Ganancia por día</span><b>' + ars(u.perDay) + '</b></div><div class="kpi"><span>Combustible</span><b>' + ars(u.fuel) + '</b></div><div class="kpi"><span>Combustible por día</span><b>' + ars(u.fuelDay) + '</b></div></div>';
  if (u.rows.length) {
    const mx = Math.max(...u.rows.map((r) => Math.max(r.in, 1)));
    const dm = (d: string) => esc(d.slice(8) + '/' + d.slice(5, 7));
    h += '<h3>Día por día</h3>' + u.rows.slice().reverse().map((r) => {
      const p = Math.max(0, r.profit);
      return '<div class="sbar dd" ' + st('uber') + '><span>' + dm(r.date) + '</span><div class="bar"><i style="width:' + Math.round(p / mx * 100) + '%"></i></div><span class="pc num">' + (r.in > 0 ? 'ingresó ' + ars(r.in) + ' · ganó ' + ars(r.profit) : 'gastó ' + ars(r.out)) + '</span></div>';
    }).join('');
    const wd = u.rows.filter((r) => r.in > 0).sort((a, b) => b.profit - a.profit);
    if (wd.length > 1) h += '<p class="hint">Mejor día: ' + dm(wd[0].date) + ' (' + ars(wd[0].profit) + '). Peor día: ' + dm(wd[wd.length - 1].date) + ' (' + ars(wd[wd.length - 1].profit) + ').</p>';
  } else h += '<p class="empty">Anotá tus ingresos y gastos del auto en Hoy para ver este análisis.</p>';
  h += '</section>';
  const ks = Object.keys(sp.m).sort((a, b) => sp.m[b] - sp.m[a]), mxc = ks.length ? sp.m[ks[0]] : 1;
  h += '<section class="card" ' + st('fix') + '>' + cardHead('fix', 'En qué se va la plata', '<span class="sub"><b class="num">' + ars(sp.tot) + '</b></span>')
    + (ks.length ? ks.map((c) => '<div class="sbar" ' + st(/^Auto/.test(c) ? 'uber' : 'fix') + '><span>' + esc(c) + '</span><div class="bar"><i style="width:' + Math.round(sp.m[c] / mxc * 100) + '%"></i></div><span class="pc num">' + ars(sp.m[c]) + ' · ' + Math.round(sp.m[c] / sp.tot * 100) + '%</span></div>').join('') : '<p class="empty">Todavía no hay gastos en este período.</p>')
    + (pv.tot > 0 && sp.tot > 0 ? '<p class="hint">Período anterior: ' + ars(pv.tot) + ' (' + (sp.tot >= pv.tot ? '+' : '−') + Math.abs(Math.round((sp.tot - pv.tot) / pv.tot * 100)) + '% este período).</p>' : '')
    + '<p class="hint">Incluye gastos fijos, consumos de tarjeta por fecha de compra, gastos diarios, costos del auto e intereses. No incluye lo que va a capital de una deuda.</p></section>';
  const sal = (S.months[key] ? S.months[key].income : []).reduce((a, i) => a + toARS(num(i.amt), i.cur, S.rate), 0);
  h += '<section class="card" ' + st('inc') + '>' + cardHead('inc', 'De dónde entra la plata')
    + '<div class="kpis"><div class="kpi c"><span>Sueldo e ingresos fijos</span><b>' + ars(sal) + '</b></div><div class="kpi c"><span>Uber (ganancia real)</span><b>' + ars(u.profit) + '</b></div><div class="kpi"><span>Total</span><b>' + ars(sal + u.profit) + '</b></div></div></section>';
  return h;
}
