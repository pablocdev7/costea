import { MONTHS, num, periodRange } from '../calc';
import { ctx, type Tab } from '../app/ctx';
import { $, st } from '../app/dom';
import { vAnalisis } from './analisis';
import { vDatos } from './datos';
import { vDebts } from './debts';
import { vExpenses } from './expenses';
import { vIncome } from './income';
import { vResumen } from './resumen';
import { vUber } from './uber';

const SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const NAV: [Tab, string, string, string][] = [
  ['resumen', 'Resumen', 'accent', SVG + '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 8h6V4h-6z"/></svg>'],
  ['income', 'Ingresos', 'inc', SVG + '<path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14"/></svg>'],
  ['uber', 'Hoy', 'uber', SVG + '<path d="M5 15l1.6-5h10.8L19 15M4 15h16v4H4zM7 19v1.5M17 19v1.5"/></svg>'],
  ['expenses', 'Gastos', 'fix', SVG + '<path d="M12 20V8m0 0l-4 4m4-4l4 4M5 4h14"/></svg>'],
  ['debts', 'Deudas', 'debt', SVG + '<path d="M3 9l9-5 9 5M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/></svg>'],
  ['analisis', 'Análisis', 'accent', SVG + '<path d="M5 20V11M12 20V4M19 20v-6"/></svg>'],
];
const VIEWS: Record<Tab, () => string> = { resumen: vResumen, income: vIncome, uber: vUber, expenses: vExpenses, debts: vDebts, analisis: vAnalisis, datos: vDatos };

export function render(): void {
  const S = ctx.S, key = ctx.key;
  $('#mlabel')!.textContent = MONTHS[+key.split('-')[1] - 1] + ' ' + key.split('-')[0];
  const mr = $('#mrange')!, range = periodRange(key, S.startDay);
  mr.textContent = range || '';
  mr.hidden = !range;
  const ri = $<HTMLInputElement>('#rate')!;
  if (document.activeElement !== ri) ri.value = String(num(S.rate) || '');
  $('#nav')!.innerHTML = NAV.map((n) => '<button type="button" class="nv" data-act="tab" data-tab="' + n[0] + '" aria-current="' + (ctx.tab === n[0] ? 'page' : 'false') + '" ' + st(n[2]) + '>' + n[3] + '<span>' + n[1] + '</span></button>').join('');
  $('#view')!.innerHTML = VIEWS[ctx.tab]();
  const anyEx = S.uber.some((x) => x.ex) || S.debts.some((x) => x.ex)
    || Object.keys(S.months).some((k) => { const m = S.months[k]; return [...m.income, ...m.fixed].some((x) => x.ex); })
    || S.cards.some((x) => x.ex) || S.consumos.some((x) => x.ex);
  const b = $('#banner')!;
  b.hidden = !anyEx;
  if (anyEx) b.innerHTML = '<span>Lo marcado como <b>ejemplo</b> es de muestra.</span><button type="button" data-act="clear-ex">Borrar todos los ejemplos</button>';
  if (ctx.refocus) { ctx.refocus = false; $<HTMLInputElement>('#u-amt')?.focus(); }
}
