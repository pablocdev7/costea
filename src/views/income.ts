import { ars } from '../calc';
import { ctx, mo, tot } from '../app/ctx';
import { cardHead, st } from '../app/dom';
import { itemRow } from './rows';

export function vIncome(): string {
  const m = mo(ctx.key), t = tot(ctx.key);
  return '<section class="card" ' + st('inc') + '>' + cardHead('inc', 'Sueldo e ingresos fijos', '<span class="sub"><b class="num">' + ars(t.salIn) + '</b> de <b class="num">' + ars(t.salAll) + '</b></span>')
    + (m.income.length ? '<div class="list">' + m.income.map((i) => itemRow('income', i)).join('') + '</div>' : '<p class="empty">Todavía no cargaste ingresos.</p>')
    + '<button class="add" type="button" data-act="add" data-sec="income">+ Agregar ingreso</button></section>'
    + '<section class="card" ' + st('uber') + '>' + cardHead('uber', 'Uber del mes', '<button class="link" type="button" data-act="go" data-tab="uber">Abrir ›</button>')
    + '<div class="kpis"><div class="kpi c"><span>Neto</span><b>' + ars(t.u.net) + '</b></div><div class="kpi"><span>Días trabajados</span><b>' + t.u.days + '</b></div></div>'
    + '<p class="hint">El neto de Uber se suma solo como ingreso ya cobrado.</p></section>';
}
