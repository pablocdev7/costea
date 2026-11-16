import { csvNum as cn, dueKeyFor, num, toARS } from '../calc';
import { ctx, mo, tot } from './ctx';
import { $, esc, note } from './dom';

function csvOut(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
}

export function csvMonth(): string {
  const S = ctx.S, m = mo(ctx.key), t = tot(ctx.key), rows: unknown[][] = [['Sección', 'Concepto', 'Monto', 'Moneda', 'Día', 'Estado', 'Monto en ARS']];
  m.income.forEach((i) => { rows.push(['Ingreso', i.name, cn(num(i.amt)), i.cur, '', i.done ? 'Cobrado' : 'Por cobrar', cn(toARS(num(i.amt), i.cur, S.rate))]); });
  rows.push(['Uber', 'Neto del mes', '', '', '', 'Cobrado', cn(t.u.net)]);
  t.e.forEach((x) => { rows.push([{ debts: 'Deuda', fixed: 'Gasto fijo', card: 'Tarjeta' }[x.sec], x.label, x.orig != null ? cn(x.orig) : '', x.orig != null ? 'USD' : '', x.day === 99 ? '' : x.day, x.done ? 'Pagado' : 'Por pagar', cn(x.ars)]); });
  rows.push([], ['Resumen', 'Cotización del dólar', cn(num(S.rate))], ['Resumen', 'Ingresos totales', '', '', '', '', cn(t.incAll)], ['Resumen', 'Gastos totales', '', '', '', '', cn(t.expAll)], ['Resumen', 'Cierre proyectado', '', '', '', '', cn(t.close)]);
  return csvOut(rows);
}

export function csvUber(): string {
  const rows: unknown[][] = [['Fecha', 'Tipo', 'Categoría', 'Monto ARS', 'Nota']];
  ctx.S.uber.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((e) => { rows.push([e.date, e.type === 'in' ? 'Ingreso' : 'Gasto', e.cat, cn(num(e.amt)), e.note]); });
  return csvOut(rows);
}

export function csvDebts(): string {
  const rows: unknown[][] = [['Deuda', 'Tipo', 'Moneda', 'Fecha', 'Pagado', 'Interés', 'Capital']];
  ctx.S.debts.forEach((d) => {
    d.payments.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((p) => {
      rows.push([d.name, d.kind === 'loan' ? 'Préstamo' : 'Cuotas fijas', d.cur, p.date, cn(num(p.paid)), d.kind === 'loan' ? cn(num(p.interest)) : '', d.kind === 'loan' ? cn(num(p.capital)) : '']);
    });
  });
  return csvOut(rows);
}

export function csvCons(): string {
  const S = ctx.S, rows: unknown[][] = [['Tarjeta', 'Fecha', 'Concepto', 'Monto', 'Moneda', 'Resumen que vence']];
  S.consumos.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((x) => {
    const c = S.cards.find((y) => y.id === x.cardId);
    rows.push([c ? c.name : '', x.date, x.name, cn(num(x.amt)), x.cur, c ? dueKeyFor(c, x.date, S.startDay) : '']);
  });
  return csvOut(rows);
}

function showText(title: string, text: string): void {
  const ov = document.createElement('div');
  ov.className = 'ov';
  ov.innerHTML = '<div class="box" role="dialog" aria-label="' + esc(title) + '"><strong>' + esc(title) + '</strong><p class="hint">No se pudo descargar el archivo desde acá. Copiá este texto y pegalo en un archivo nuevo.</p><textarea id="ovta" readonly></textarea><div class="btns"><button class="btn pri" type="button" data-act="copy">Copiar</button><button class="btn" type="button" data-act="close">Cerrar</button></div></div>';
  document.body.appendChild(ov);
  const ta = $<HTMLTextAreaElement>('#ovta', ov)!;
  ta.value = text; ta.focus(); ta.select();
}

export function saveFile(name: string, text: string, mime: string): void {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    note('Descargando ' + esc(name));
  } catch { showText(name, text); }
}
