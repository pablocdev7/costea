import { accBal, ars, dueCal, loanInfo, mlab, money, num, r2, splitLoanPayment, stmtOf } from '../calc';
import { ctx, mo, pk, tot, type SheetCtx } from '../app/ctx';
import { $, esc, note, st } from '../app/dom';
import { CATS } from '../state';
import { nid } from '../calc/util';
import type { Account, Cur, Debt } from '../types';
import { SC } from '../views/rows';

type Opt = [string, string];

/* ---------- campos ---------- */
function fi(label: string, name: string, type: string, val: unknown, extra?: string): string {
  return '<label class="fld"><span>' + label + '</span><input name="' + name + '" type="' + type + '" value="' + esc(val == null ? '' : val) + '"' + (type === 'number' ? ' step="any" inputmode="decimal"' : '') + (extra || '') + '></label>';
}
function fs(label: string, name: string, opts: Opt[], val: string | undefined): string {
  return '<label class="fld"><span>' + label + '</span><select name="' + name + '">' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>';
}
const CUR: Opt[] = [['ARS', 'Pesos (ARS)'], ['USD', 'Dólares (USD)']];
function accSel(label: string, name: string, val?: string): string {
  return fs(label, name, ([['', 'Cuenta por defecto']] as Opt[]).concat(ctx.S.accounts.map((a) => [a.id, esc(a.name)] as Opt)), val || '');
}
function catSel(list: string[], val?: string): string {
  return fs('Categoría', 'cat', ([['', 'Sin categoría']] as Opt[]).concat(list.map((c) => [c, esc(c)] as Opt)), val || '');
}

/* ---------- abrir / cerrar ---------- */
function openSheet(c: SheetCtx, title: string, fields: string, okLabel: string, del: boolean | string, preview: boolean, color?: string): void {
  ctx.sheet = c;
  $('#sh-title')!.textContent = title;
  $('#sh-body')!.innerHTML = '<form id="sform" ' + st(color || 'accent') + '>' + fields + (preview ? '<p class="prev" id="prev"></p>' : '')
    + '<div class="btns"><button class="btn pri" style="flex:1" type="submit">' + okLabel + '</button>' + (del ? '<button class="btn danger" type="button" data-act="sheet-del">' + (typeof del === 'string' ? del : 'Eliminar') + '</button>' : '') + '</div></form>';
  $('#sheet')!.hidden = false;
  const f = $<HTMLInputElement>('#sh-body input,#sh-body select');
  if (f && matchMedia('(min-width:640px)').matches) f.focus();
  if (preview) updPrev();
}
export function closeSheet(): void {
  ctx.sheet = null;
  $('#sheet')!.hidden = true;
  $('#sh-body')!.innerHTML = '';
}

const debtById = (id: string | null | undefined): Debt | undefined => ctx.S.debts.find((x) => x.id === id);

/* ---------- hojas ---------- */
export function itemSheet(sec: 'income' | 'fixed', id: string | null, mk?: string): void {
  mk = mk || ctx.key;
  const it = id ? mo(mk)[sec].find((x) => x.id === id) : null, t = { income: 'ingreso', fixed: 'gasto fijo' }[sec];
  openSheet({ kind: 'item', sec, id, mk }, (id ? 'Editar ' : 'Agregar ') + t,
    fi('Concepto', 'name', 'text', it ? it.name : '', ' placeholder="Ej: ' + (sec === 'income' ? 'Sueldo' : 'Alquiler') + '" required')
    + '<div class="pair">' + fi('Monto', 'amt', 'number', it ? it.amt : '', ' min="0" required') + fs('Moneda', 'cur', CUR, it ? it.cur : 'ARS') + '</div>'
    + (sec === 'fixed' ? fi('Día en que lo pagás', 'day', 'number', it ? it.day : '', ' min="1" max="31"') : '')
    + catSel(sec === 'income' ? CATS.ing : CATS.fijo, it ? it.cat : '')
    + accSel(sec === 'income' ? 'Entra a' : 'Se paga desde', 'acc', it ? it.acc : '')
    + (sec === 'fixed' ? '<p class="hint">El día cuenta para el período que corresponda según tu mes (ver Datos).</p>' : ''),
    'Guardar', !!id, false, SC[sec]);
}

export function debtSheet(id: string | null, dkind?: 'loan' | 'fixed'): void {
  const d = id ? debtById(id) : null, k = d ? d.kind : dkind!;
  let f = fi('Nombre', 'name', 'text', d ? d.name : '', ' placeholder="Ej: ' + (k === 'loan' ? 'Préstamo de Juan' : 'Celular en cuotas') + '" required');
  if (k === 'loan') {
    f += fi('A quién le debés (opcional)', 'who', 'text', d ? d.who : '') + '<div class="pair">' + fi('Monto prestado', 'principal', 'number', d ? d.principal : '', ' min="0" required') + fs('Moneda', 'cur', CUR, d ? d.cur : 'USD') + '</div>'
      + '<div class="pair">' + fi('Interés (%)', 'rate', 'number', d ? d.rate : '', ' min="0"') + fs('Período', 'ratePer', [['m', 'por mes'], ['y', 'por año']], d ? d.ratePer : 'm') + '</div>'
      + fi('Pago mensual previsto', 'planned', 'number', d ? d.planned : '', ' min="0"') + fi('Día de pago', 'day', 'number', d ? d.day : '', ' min="1" max="31"');
  } else {
    f += '<div class="pair">' + fi('Monto de la cuota', 'amount', 'number', d ? d.amount : '', ' min="0" required') + fs('Moneda', 'cur', CUR, d ? d.cur : 'ARS') + '</div>'
      + fi('Cuotas totales (opcional)', 'total', 'number', d ? d.total : '', ' min="0"') + fi('Día de pago', 'day', 'number', d ? d.day : '', ' min="1" max="31"');
  }
  openSheet({ kind: 'debt', id, dkind: k }, id ? 'Editar deuda' : (k === 'loan' ? 'Nuevo préstamo con interés' : 'Nueva deuda en cuotas'), f, 'Guardar', !!id, false, 'debt');
}

export function payLoanSheet(id: string): void {
  const d = debtById(id)!, li = loanInfo(d);
  openSheet({ kind: 'payloan', id }, 'Registrar pago · ' + (d.name || 'Préstamo'),
    fi('Fecha', 'date', 'date', ctx.todayD) + fi('Monto que pagaste (' + d.cur + ')', 'paid', 'number', num(d.planned) || '', ' min="0" required')
    + fi('Interés a cobrar (editable)', 'int', 'number', r2(li.nextInt), ' min="0"') + accSel('Se paga desde', 'acc', ''), 'Registrar pago', false, true, 'debt');
}

export function payFixedSheet(id: string): void {
  const d = debtById(id)!;
  openSheet({ kind: 'payfixed', id }, 'Registrar cuota · ' + (d.name || 'Deuda'), fi('Fecha', 'date', 'date', ctx.todayD) + fi('Monto pagado (' + d.cur + ')', 'paid', 'number', num(d.amount) || '', ' min="0" required') + accSel('Se paga desde', 'acc', ''), 'Registrar pago', false, false, 'debt');
}

export function cardSheet(id: string | null): void {
  const c = id ? ctx.S.cards.find((x) => x.id === id) : null;
  openSheet({ kind: 'card', id }, id ? 'Editar tarjeta' : 'Nueva tarjeta',
    fi('Nombre', 'name', 'text', c ? c.name : '', ' placeholder="Ej: Naranja X" required')
    + '<div class="pair" style="grid-template-columns:1fr 1fr">' + fi('Día de cierre', 'closeDay', 'number', c ? c.closeDay : '', ' min="1" max="31" required') + fi('Día de vencimiento', 'dueDay', 'number', c ? c.dueDay : '', ' min="1" max="31" required') + '</div>'
    + '<p class="hint">El cierre decide a qué resumen va cada consumo según su fecha. El vencimiento es cuando lo pagás.</p>', 'Guardar', !!id, false, 'card');
}

export function consumoSheet(id: string | null, cardId: string | null): void {
  const S = ctx.S;
  if (!S.cards.length) { note('Primero agregá una tarjeta.'); return; }
  const x = id ? S.consumos.find((y) => y.id === id) : null, cid = x ? x.cardId : (cardId || S.cards[0].id);
  openSheet({ kind: 'consumo', id }, id ? 'Editar consumo' : 'Nuevo consumo',
    fs('Tarjeta', 'card', S.cards.map((c) => [c.id, esc(c.name)] as Opt), cid)
    + fi('Fecha', 'date', 'date', x ? x.date : ctx.todayD) + fi('Concepto', 'name', 'text', x ? x.name : '', ' placeholder="Ej: Supermercado"') + catSel(CATS.gasto, x ? x.cat : '')
    + '<div class="pair">' + fi('Monto', 'amt', 'number', x ? x.amt : '', ' min="0" required') + fs('Moneda', 'cur', CUR, x ? x.cur : 'ARS') + '</div>', 'Guardar', !!id, true, 'card');
}

export function stmtSheet(cardId: string): void {
  const S = ctx.S, c = S.cards.find((x) => x.id === cardId)!, s = stmtOf(S, c, ctx.key), sv = S.stmts[c.id + '|' + ctx.key] || {};
  openSheet({ kind: 'stmt', cardId }, 'Resumen de ' + (c.name || 'tarjeta') + ' · ' + mlab(ctx.key).toLowerCase(),
    fi('Monto total del resumen ($ ARS)', 'real', 'number', sv.real || '', ' min="0"') + accSel('Se paga desde', 'acc', sv.acc), 'Guardar', s.real > 0 ? 'Quitar monto' : false, true, 'card');
}

export function accountSheet(id: string | null): void {
  const S = ctx.S, a = id ? S.accounts.find((x) => x.id === id) : null;
  openSheet({ kind: 'account', id }, id ? 'Editar cuenta' : 'Nueva cuenta',
    fi('Nombre', 'name', 'text', a ? a.name : '', ' placeholder="Ej: Cuenta del auto" required') + fi('Saldo hoy ($ ARS)', 'bal', 'number', a ? r2(accBal(S, a)) : '', ' required')
    + fs('Tipo', 'pending', [['0', 'Disponible'], ['1', 'Pendiente de retiro']], a && a.pending ? '1' : '0')
    + ((a || S.accounts.length) ? fs('¿Cuenta por defecto?', 'def', [['0', 'No'], ['1', 'Sí, usarla por defecto']], a && a.id === S.defAcc ? '1' : '0') : '')
    + '<p class="hint">El saldo que pongas es el de este momento. Desde acá se mueve solo con lo que registres.</p>', 'Guardar', !!id, false, 'accent');
}

export function transferSheet(): void {
  const S = ctx.S, o = S.accounts.map((a) => [a.id, esc(a.name)] as Opt), from = S.defAcc || o[0][0], to = (o.find((x) => x[0] !== from) || o[0])[0];
  openSheet({ kind: 'transfer' }, 'Transferir entre cuentas', fs('Desde', 'from', o, from) + fs('Hacia', 'to', o, to) + fi('Monto ($ ARS)', 'amt', 'number', '', ' min="0" required') + fi('Nota (opcional)', 'note', 'text', ''), 'Transferir', false, false, 'accent');
}

export function cashSheet(): void {
  const t = tot(ctx.key);
  openSheet({ kind: 'cash' }, '¿Cuánta plata tenés hoy?',
    fi('Plata disponible ahora ($ ARS)', 'cash', 'number', r2(t.cash), ' required')
    + '<p class="hint">Contá lo que tenés en cuenta y en mano. Desde acá, cada cobro, pago y movimiento de Uber que registres lo mueve solo.</p>', 'Guardar', false, false, 'accent');
}

/* ---------- vista previa ---------- */
const str = (fd: FormData, k: string): string => String(fd.get(k) ?? '');

function payVals(form: HTMLFormElement) {
  const d = debtById(ctx.sheet!.id)!, fd = new FormData(form);
  const v = splitLoanPayment(d, num(str(fd, 'paid')), num(str(fd, 'int')));
  return { d, date: str(fd, 'date') || ctx.todayD, ...v };
}

export function updPrev(): void {
  const sheet = ctx.sheet;
  if (!sheet) return;
  const el = $('#prev'), form = $<HTMLFormElement>('#sform');
  if (!el || !form) return;
  const fd = new FormData(form), S = ctx.S;
  if (sheet.kind === 'payloan') {
    const v = payVals(form), c = v.d.cur;
    el.innerHTML = v.paid > 0
      ? 'De <b class="num">' + money(c, v.paid) + '</b>: <b class="num">' + money(c, v.interest) + '</b> van a interés y <b class="num">' + money(c, v.capital) + '</b> a capital. El saldo queda en <b class="num">' + money(c, v.left) + '</b>.' + (v.over > 0.005 ? ' Sobran ' + money(c, v.over) + ' que no se aplican.' : '')
      : 'Escribí el monto para ver cuánto va a interés y cuánto a capital.';
  } else if (sheet.kind === 'consumo') {
    const cd = S.cards.find((x) => x.id === str(fd, 'card')), ds = str(fd, 'date');
    if (cd && ds) el.innerHTML = 'Va al resumen de <b>' + esc(cd.name) + '</b> que vence el <b>' + esc(cd.dueDay) + ' de ' + mlab(dueCal(cd, ds)).toLowerCase() + '</b>.';
    else el.textContent = '';
  } else if (sheet.kind === 'stmt') {
    const c2 = S.cards.find((x) => x.id === sheet.cardId)!, s = stmtOf(S, c2, ctx.key), real = num(str(fd, 'real'));
    el.innerHTML = (s.reg > 0 ? 'Registraste <b class="num">' + ars(s.reg) + '</b> en consumos para este resumen.' : 'No registraste consumos para este resumen.')
      + (real > 0 && s.reg > 0 ? (Math.abs(real - s.reg) < 1 ? ' Coincide con el resumen.' : ' El resumen dice <b class="num">' + ars(real) + '</b>: diferencia de <b class="num">' + ars(real - s.reg) + '</b>.') : '');
  }
}

/* ---------- guardar ---------- */
/** Aplica el formulario abierto al estado. Devuelve false si faltan datos (la hoja queda abierta). */
export function submitSheet(form: HTMLFormElement): boolean {
  const fd = new FormData(form), c = ctx.sheet!, S = ctx.S;
  const numOrEmpty = (k: string) => (str(fd, k) === '' ? '' : num(str(fd, k)));
  if (c.kind === 'item') {
    const home = c.mk || ctx.key;
    const list = mo(home)[c.sec!], it = c.id ? list.find((x) => x.id === c.id) : null, name = str(fd, 'name').trim();
    if (!name) { note('Poné un concepto.'); return false; }
    const data: Partial<typeof list[number]> = { name, amt: num(str(fd, 'amt')), cur: (str(fd, 'cur') || 'ARS') as Cur, cat: str(fd, 'cat'), acc: str(fd, 'acc') };
    if (c.sec === 'fixed') data.day = numOrEmpty('day');
    if (!c.id && home !== ctx.key) data.early = true;
    if (it) { Object.assign(it, data); it.ex = 0; } else list.push({ id: nid(), done: false, ...data } as typeof list[number]);
    if (!c.id && home !== ctx.key) note('Quedó como pago de ' + mlab(home).toLowerCase() + ' que hacés este mes.');
  } else if (c.kind === 'debt') {
    const name2 = str(fd, 'name').trim();
    if (!name2) { note('Poné un nombre.'); return false; }
    const d = c.id ? debtById(c.id) : null, k = d ? d.kind : c.dkind!;
    const nd: Partial<Debt> = { name: name2, cur: (str(fd, 'cur') || 'ARS') as Cur, day: numOrEmpty('day') };
    if (k === 'loan') { nd.who = str(fd, 'who').trim(); nd.principal = num(str(fd, 'principal')); nd.rate = num(str(fd, 'rate')); nd.ratePer = (str(fd, 'ratePer') || 'm') as 'm' | 'y'; nd.planned = num(str(fd, 'planned')); }
    else { nd.amount = num(str(fd, 'amount')); nd.total = numOrEmpty('total'); }
    if (d) { Object.assign(d, nd); d.ex = 0; } else S.debts.push({ id: nid(), kind: k, payments: [], ...nd } as Debt);
  } else if (c.kind === 'payloan') {
    const v = payVals(form);
    if (!(v.paid > 0)) { note('Poné el monto que pagaste.'); return false; }
    v.d.payments.push({ id: nid(), date: v.date, paid: r2(v.interest + v.capital), interest: r2(v.interest), capital: r2(v.capital), acc: str(fd, 'acc'), ts: Date.now() });
    const pk0 = pk(v.date);
    if (pk0 !== ctx.key && pk0 >= ctx.todayKey) ctx.key = pk0;
    note('Pago registrado. Saldo: ' + money(v.d.cur, v.left) + '.');
  } else if (c.kind === 'payfixed') {
    const dd = debtById(c.id)!, paid = num(str(fd, 'paid'));
    if (!(paid > 0)) { note('Poné el monto pagado.'); return false; }
    dd.payments.push({ id: nid(), date: str(fd, 'date') || ctx.todayD, paid, acc: str(fd, 'acc'), ts: Date.now() });
    note('Cuota registrada.');
  } else if (c.kind === 'cash') {
    const t = tot(ctx.key);
    mo(ctx.key).opening = r2(num(str(fd, 'cash')) - (t.cash - t.opening));
    note('Plata de hoy actualizada.');
  } else if (c.kind === 'card') {
    const cn0 = str(fd, 'name').trim(), cl = num(str(fd, 'closeDay')), du = num(str(fd, 'dueDay'));
    if (!cn0 || cl < 1 || cl > 31 || du < 1 || du > 31) { note('Poné nombre, cierre y vencimiento (días del 1 al 31).'); return false; }
    const cd = c.id ? S.cards.find((x) => x.id === c.id) : null;
    if (cd) { cd.name = cn0; cd.closeDay = cl; cd.dueDay = du; cd.ex = 0; } else S.cards.push({ id: nid(), name: cn0, closeDay: cl, dueDay: du });
  } else if (c.kind === 'consumo') {
    const amt = num(str(fd, 'amt')), cdd = S.cards.find((x) => x.id === str(fd, 'card'));
    if (!(amt > 0) || !cdd) { note('Poné tarjeta y un monto mayor a cero.'); return false; }
    const cx = { cardId: cdd.id, date: str(fd, 'date') || ctx.todayD, name: str(fd, 'name').trim(), amt, cur: (str(fd, 'cur') || 'ARS') as Cur, cat: str(fd, 'cat') };
    const ex0 = c.id ? S.consumos.find((x) => x.id === c.id) : null;
    if (ex0) { Object.assign(ex0, cx); ex0.ex = 0; } else S.consumos.push({ id: nid(), ...cx });
    note('Va al resumen de ' + esc(cdd.name) + ' que vence el ' + esc(cdd.dueDay) + ' de ' + mlab(dueCal(cdd, cx.date)).toLowerCase() + '.');
  } else if (c.kind === 'stmt') {
    const sk = c.cardId + '|' + ctx.key, so = (S.stmts[sk] = S.stmts[sk] || {});
    so.real = numOrEmpty('real');
    so.acc = str(fd, 'acc');
  } else if (c.kind === 'account') {
    const an = str(fd, 'name').trim();
    if (!an) { note('Poné un nombre.'); return false; }
    const bal = num(str(fd, 'bal')), ac = c.id ? S.accounts.find((x) => x.id === c.id) : null;
    const pend = str(fd, 'pending') === '1';
    if (ac) { ac.name = an; ac.base = bal; ac.baseAt = Date.now(); if (pend) ac.pending = true; else delete ac.pending; if (str(fd, 'def') === '1') S.defAcc = ac.id; }
    else { const na: Account = { id: nid(), name: an, base: bal, baseAt: Date.now() }; if (pend) na.pending = true; S.accounts.push(na); if (!S.defAcc || str(fd, 'def') === '1') S.defAcc = na.id; }
  } else if (c.kind === 'transfer') {
    const tf = str(fd, 'from'), tt = str(fd, 'to'), ta = num(str(fd, 'amt'));
    if (tf === tt || !(ta > 0)) { note('Elegí dos cuentas distintas y un monto mayor a cero.'); return false; }
    S.transfers.push({ id: nid(), from: tf, to: tt, amt: ta, note: str(fd, 'note').trim(), ts: Date.now() });
    note('Transferencia registrada.');
  }
  return true;
}
