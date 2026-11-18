import { accBal, accTotal, ars, availAccounts, linkedTarget, pendingAccounts, pendingTotal } from '../calc';
import { ctx } from '../app/ctx';
import { cardHead, esc, st } from '../app/dom';
import type { Account } from '../types';

function availRow(a: Account): string {
  const S = ctx.S;
  return '<div class="item noleft"><button class="body" type="button" data-act="edit-account" data-acc="' + esc(a.id) + '"><span class="nm">' + esc(a.name)
    + (a.id === S.defAcc ? '<span class="chip nn" style="margin-left:6px">por defecto</span>' : '') + '</span><span class="meta">Tocá para editar</span></button><div class="amt">' + ars(accBal(S, a)) + '</div></div>';
}

function pendRow(a: Account): string {
  const S = ctx.S, to = linkedTarget(S, a);
  return '<div class="item noleft" data-acc="' + esc(a.id) + '"><button class="body" type="button" data-act="edit-pending" data-acc="' + esc(a.id) + '"><span class="nm">' + esc(a.name) + '</span><span class="meta">'
    + (to ? 'Se retira a ' + esc(to.name) : 'Sin cuenta destino vinculada') + '</span></button><div class="amt">' + ars(accBal(S, a)) + '</div>'
    + '<div class="btns acc-acts"><button class="btn" style="flex:1" type="button" data-act="withdraw" data-acc="' + esc(a.id) + '">Retirar</button><button class="btn" style="flex:1" type="button" data-act="adjust-pending" data-acc="' + esc(a.id) + '">Actualizar saldo</button></div></div>';
}

/** Pantalla "Cuentas": se abre desde el encabezado y desde los números de Resumen (no está en la barra de abajo). */
export function vCuentas(): string {
  const S = ctx.S, av = availAccounts(S), pe = pendingAccounts(S);
  return '<section class="card" ' + st('accent') + '>' + cardHead('accent', 'Disponibles', '<span class="sub"><b class="num">' + ars(accTotal(S)) + '</b></span>')
    + (av.length ? '<div class="list">' + av.map(availRow).join('') + '</div>'
      : '<p class="empty">Creá una cuenta por cada lugar donde tenés plata (banco, billetera, efectivo, cuenta del auto). Cada cobro, pago y gasto que registres mueve su saldo.</p>')
    + '</section>'
    + '<section class="card" ' + st('accent') + '>' + cardHead('accent', 'Pendientes de retiro', '<span class="sub"><b class="num">' + ars(pendingTotal(S)) + '</b></span>')
    + '<p class="hint">No cuenta como plata disponible.</p>'
    + (pe.length ? '<div class="list">' + pe.map(pendRow).join('') + '</div>'
      : '<p class="empty">Ninguna. Usalas para la plata que juntás en Uber, Didi o Cabify y todavía no retiraste.</p>')
    + '</section>'
    + '<div class="btns"><button class="add" style="flex:1" type="button" data-act="add-account">+ Cuenta</button><button class="add" style="flex:1" type="button" data-act="add-pending">+ Cuenta pendiente</button>'
    + (S.accounts.length > 1 ? '<button class="add" style="flex:1 1 100%" type="button" data-act="transfer">Transferir</button>' : '') + '</div>';
}
