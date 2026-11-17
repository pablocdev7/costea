import { ars, dueCal, mlab, num, periodKey, shiftKey, stmtOf } from '../calc';
import { nid } from '../calc/util';
import { accountSheet, cardSheet, cashSheet, closeSheet, consumoSheet, debtSheet, itemSheet, payFixedSheet, payLoanSheet, stmtSheet, submitSheet, transferSheet, updPrev } from '../sheets';
import { parseImport } from '../state';
import { flush, hasPending, persist as persistState, pull } from '../storage/sync';
import { render } from '../views';
import { fillUForm } from '../views/uber';
import { csvCons, csvDebts, csvMonth, csvUber, saveFile } from './export';
import { ctx, mo, refreshToday, setState, type Tab, type UType } from './ctx';
import { $, esc, note } from './dom';

export function persist(): void { persistState(ctx.S); }

function debtOf(el: Element) {
  const c = el.closest<HTMLElement>('[data-debt]');
  return c ? ctx.S.debts.find((d) => d.id === c.dataset.debt) : undefined;
}
function secId(el: HTMLElement): { sec: 'income' | 'fixed'; id: string; mk: string } {
  const r = el.closest<HTMLElement>('[data-id]') || el;
  return { sec: r.dataset.sec as 'income' | 'fixed', id: r.dataset.id!, mk: r.dataset.mk || ctx.key };
}

function importFile(file: File): void {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const s = parseImport(String(fr.result));
      if (!confirm('Esto reemplaza todos tus datos actuales, en este dispositivo y en la nube, por los del archivo. ¿Seguimos?')) return;
      setState(s);
      persist();
      render();
      note('Respaldo importado.');
    } catch (e) {
      note(esc((e as Error).message || 'Ese archivo no parece un respaldo de Cuentas.'));
    }
  };
  fr.readAsText(file);
}

function go(d: number): void { ctx.key = shiftKey(ctx.key, d); mo(ctx.key); render(); }

export function bindEvents(onLogout: () => void): void {
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'rate') { ctx.S.rate = num(t.value); persist(); if (ctx.tab !== 'uber') render(); return; }
    if (t.closest && t.closest('#sform') && ctx.sheet && ['payloan', 'consumo', 'stmt'].includes(ctx.sheet.kind)) updPrev();
  });

  document.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'imp') { if (t.files && t.files[0]) importFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'startDay') { ctx.S.startDay = Math.min(28, Math.max(1, Math.round(num(t.value)) || 1)); refreshToday(); ctx.key = ctx.todayKey; persist(); render(); return; }
    if (t.name === 'utype') { ctx.uType = t.value as UType; fillUForm(); return; }
    if (t.id === 'carDaily') { ctx.S.carDaily = num(t.value); persist(); render(); return; }
    if (t.dataset && t.dataset.act === 'toggle') {
      const r = secId(t), it = mo(r.mk)[r.sec].find((x) => x.id === r.id);
      if (!it) return;
      it.done = t.checked; it.doneAt = t.checked ? Date.now() : 0;
      persist(); render();
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target as HTMLFormElement;
    if (f.id === 'sform') {
      e.preventDefault();
      if (submitSheet(f)) { closeSheet(); persist(); render(); }
      return;
    }
    if (f.id !== 'uform') return;
    e.preventDefault();
    const S = ctx.S, val = (s: string) => $<HTMLInputElement>(s)!.value;
    const amt = num(val('#u-amt')), date = val('#u-date') || ctx.todayD, cat = val('#u-cat'), med = val('#u-med'), nt = val('#u-note').trim();
    if (!(amt > 0)) { note('Poné un monto mayor a cero.'); $<HTMLInputElement>('#u-amt')!.focus(); return; }
    let msg: string;
    if (ctx.uType === 'exp' && med.indexOf('card:') === 0) {
      const cd = S.cards.find((x) => x.id === med.slice(5))!;
      S.consumos.push({ id: nid(), cardId: cd.id, date, name: nt || cat, cat, amt, cur: 'ARS' });
      msg = 'Gasto con ' + esc(cd.name) + ' anotado: va al resumen que vence el ' + esc(cd.dueDay) + ' de ' + mlab(dueCal(cd, date)).toLowerCase() + '.';
    } else if (ctx.uType === 'exp') {
      S.gastos.push({ id: nid(), date, cat, name: nt, amt, acc: med, ts: Date.now() });
      msg = 'Gasto anotado: ' + ars(amt);
    } else {
      S.uber.push({ id: nid(), date, type: ctx.uType, cat, amt, note: nt, acc: med, ts: Date.now() });
      msg = (ctx.uType === 'in' ? 'Ingreso' : 'Gasto del auto') + ' anotado: ' + ars(amt);
    }
    ctx.key = periodKey(date, S.startDay);
    persist(); ctx.refocus = true; render(); note(msg);
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ctx.sheet) closeSheet(); });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'sheet') { closeSheet(); return; }
    const b = target.closest<HTMLElement>('[data-act]');
    if (!b) return;
    const act = b.dataset.act, S = ctx.S, key = ctx.key;
    if (act === 'tab' || act === 'go') { ctx.tab = b.dataset.tab as Tab; render(); window.scrollTo(0, 0); return; }
    if (act === 'prev') return go(-1);
    if (act === 'next') return go(1);
    if (act === 'sheet-close') return closeSheet();
    if (act === 'add') return itemSheet(b.dataset.sec as 'income' | 'fixed', null);
    if (act === 'edit') { const r = secId(b); return itemSheet(r.sec, r.id, r.mk); }
    if (act === 'add-card') return cardSheet(null);
    if (act === 'edit-card') return cardSheet(b.closest<HTMLElement>('[data-card]')!.dataset.card!);
    if (act === 'add-consumo') return consumoSheet(null, b.dataset.card || null);
    if (act === 'edit-consumo') return consumoSheet(b.closest<HTMLElement>('[data-cid]')!.dataset.cid!, null);
    if (act === 'stmt-sheet') return stmtSheet(b.dataset.card!);
    if (act === 'set-cash') return cashSheet();
    if (act === 'add-account') return accountSheet(null);
    if (act === 'edit-account') return accountSheet(b.dataset.acc!);
    if (act === 'transfer') return transferSheet();
    if (act === 'toggle-stmt') {
      const sk = b.dataset.card + '|' + key, so = (S.stmts[sk] = S.stmts[sk] || {}), cd0 = S.cards.find((x) => x.id === b.dataset.card)!;
      if (!so.paid) { so.paid = true; so.paidAt = Date.now(); so.amt = stmtOf(S, cd0, key).toPay; } else { so.paid = false; so.paidAt = 0; }
      persist(); render(); return;
    }
    if (act === 'add-loan') return debtSheet(null, 'loan');
    if (act === 'add-fixed') return debtSheet(null, 'fixed');
    if (act === 'edit-debt') return debtSheet(debtOf(b)!.id);
    if (act === 'pay-loan') return payLoanSheet(debtOf(b)!.id);
    if (act === 'pay-fixed') return payFixedSheet(debtOf(b)!.id);
    if (act === 'pay-entry') {
      e.preventDefault();
      const dd = S.debts.find((x) => x.id === b.dataset.debt);
      if (!dd) return;
      return dd.kind === 'loan' ? payLoanSheet(dd.id) : payFixedSheet(dd.id);
    }
    if (act === 'sheet-del') {
      const c = ctx.sheet!;
      if (c.kind === 'item') { const arr = mo(c.mk!)[c.sec!], ix = arr.findIndex((x) => x.id === c.id); if (ix >= 0) { ctx.last = { k: 'item', key: c.mk!, sec: c.sec!, item: arr[ix], ix }; arr.splice(ix, 1); } }
      else if (c.kind === 'debt') { const di = S.debts.findIndex((x) => x.id === c.id); if (di >= 0) { ctx.last = { k: 'debt', item: S.debts[di], ix: di }; S.debts.splice(di, 1); } }
      else if (c.kind === 'consumo') { const ci = S.consumos.findIndex((x) => x.id === c.id); if (ci >= 0) { ctx.last = { k: 'consumo', item: S.consumos[ci], ix: ci }; S.consumos.splice(ci, 1); } }
      else if (c.kind === 'card') {
        const ki = S.cards.findIndex((x) => x.id === c.id);
        if (ki >= 0) {
          const cs = S.consumos.filter((x) => x.cardId === c.id), sts: typeof S.stmts = {};
          Object.keys(S.stmts).forEach((k2) => { if (k2.indexOf(c.id + '|') === 0) { sts[k2] = S.stmts[k2]; delete S.stmts[k2]; } });
          ctx.last = { k: 'card', item: S.cards[ki], ix: ki, cons: cs, sts };
          S.consumos = S.consumos.filter((x) => x.cardId !== c.id);
          S.cards.splice(ki, 1);
        }
      } else if (c.kind === 'account') {
        const ai = S.accounts.findIndex((x) => x.id === c.id);
        if (ai >= 0) { ctx.last = { k: 'account', item: S.accounts[ai], ix: ai, def: S.defAcc }; S.accounts.splice(ai, 1); if (S.defAcc === c.id) S.defAcc = S.accounts[0] ? S.accounts[0].id : ''; }
      } else if (c.kind === 'stmt') { const sk2 = c.cardId + '|' + key; if (S.stmts[sk2]) S.stmts[sk2].real = ''; }
      closeSheet(); persist(); render();
      note(c.kind === 'stmt' ? 'Quité el monto del resumen.' : 'Eliminado. <button type="button" data-act="undo">Deshacer</button>', 8000);
      return;
    }
    if (act === 'del-uber') {
      const id3 = b.closest<HTMLElement>('[data-uid]')!.dataset.uid, i3 = S.uber.findIndex((x) => x.id === id3);
      if (i3 < 0) return;
      ctx.last = { k: 'uber', item: S.uber[i3], ix: i3 }; S.uber.splice(i3, 1); persist(); render();
      note('Quitaste un movimiento. <button type="button" data-act="undo">Deshacer</button>', 8000); return;
    }
    if (act === 'del-gasto') {
      const gid = b.closest<HTMLElement>('[data-gid]')!.dataset.gid, gi = S.gastos.findIndex((x) => x.id === gid);
      if (gi < 0) return;
      ctx.last = { k: 'gasto', item: S.gastos[gi], ix: gi }; S.gastos.splice(gi, 1); persist(); render();
      note('Quitaste un gasto. <button type="button" data-act="undo">Deshacer</button>', 8000); return;
    }
    if (act === 'del-pay') {
      const dp = debtOf(b)!, pid = b.closest<HTMLElement>('[data-pid]')!.dataset.pid, pi = dp.payments.findIndex((x) => x.id === pid);
      if (pi < 0) return;
      ctx.last = { k: 'pay', debt: dp.id, item: dp.payments[pi], ix: pi }; dp.payments.splice(pi, 1); persist(); render();
      note('Quitaste un pago. <button type="button" data-act="undo">Deshacer</button>', 8000); return;
    }
    if (act === 'undo') {
      const last = ctx.last;
      if (!last) return;
      if (last.k === 'item') mo(last.key)[last.sec].splice(last.ix, 0, last.item);
      else if (last.k === 'uber') S.uber.splice(last.ix, 0, last.item);
      else if (last.k === 'debt') S.debts.splice(last.ix, 0, last.item);
      else if (last.k === 'consumo') S.consumos.splice(last.ix, 0, last.item);
      else if (last.k === 'gasto') S.gastos.splice(last.ix, 0, last.item);
      else if (last.k === 'account') { S.accounts.splice(last.ix, 0, last.item); S.defAcc = last.def; }
      else if (last.k === 'card') { S.cards.splice(last.ix, 0, last.item); S.consumos = S.consumos.concat(last.cons); Object.assign(S.stmts, last.sts); }
      else if (last.k === 'pay') { const d2 = S.debts.find((x) => x.id === last.debt); if (d2) d2.payments.splice(last.ix, 0, last.item); }
      ctx.last = null; $('#note')!.hidden = true; persist(); render(); return;
    }
    if (act === 'clear-ex') {
      Object.keys(S.months).forEach((k) => { const m = S.months[k]; m.income = m.income.filter((x) => !x.ex); m.fixed = m.fixed.filter((x) => !x.ex); });
      S.cards = S.cards.filter((x) => !x.ex); S.consumos = S.consumos.filter((x) => !x.ex);
      S.uber = S.uber.filter((x) => !x.ex); S.debts = S.debts.filter((x) => !x.ex);
      persist(); render(); note('Borré los ejemplos.'); return;
    }
    if (act === 'csv-month') return saveFile('cuentas-' + key + '.csv', csvMonth(), 'text/csv');
    if (act === 'csv-uber') return saveFile('uber.csv', csvUber(), 'text/csv');
    if (act === 'csv-debts') return saveFile('pagos-deudas.csv', csvDebts(), 'text/csv');
    if (act === 'csv-cons') return saveFile('consumos-tarjeta.csv', csvCons(), 'text/csv');
    if (act === 'json') return saveFile('respaldo-cuentas.json', JSON.stringify(S, null, 2), 'application/json');
    if (act === 'close') { b.closest('.ov')?.remove(); return; }
    if (act === 'copy') {
      const ta = $<HTMLTextAreaElement>('#ovta')!;
      (navigator.clipboard?.writeText ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => note('Copiado.'), () => { ta.focus(); ta.select(); note('Seleccioná el texto y copialo.'); });
      return;
    }
    if (act === 'sync-now') { void pull().then(flush); return; }
    if (act === 'logout') {
      if (hasPending() && !confirm('Hay cambios que todavía no se subieron a la nube. Si cerrás sesión ahora se pierden. ¿Cerrar igual?')) return;
      onLogout();
    }
  });
}
